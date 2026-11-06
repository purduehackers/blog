import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

test("a fresh installation generates and reuses a private encryption key", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mail-crypto-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "lib"));
  const modulePath = join(root, "lib", "crypto.mjs");
  await copyFile(new URL("../lib/crypto.mjs", import.meta.url), modulePath);
  const source = `
    import assert from 'node:assert/strict';
    import {encrypt, decrypt} from ${JSON.stringify(pathToFileURL(modulePath).href)};
    const value = encrypt('private-refresh-token');
    assert.equal(decrypt(value), 'private-refresh-token');
    assert.ok(!value.includes('private-refresh-token'));
    const changed = Buffer.from(value, 'base64'); changed[15] ^= 1;
    assert.throws(() => decrypt(changed.toString('base64')), /decrypt/);
    console.log(value);
  `;
  const environment = { ...process.env };
  delete environment.MAIL_ENCRYPTION_KEY;
  const first = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    { env: environment, encoding: "utf8" },
  );
  assert.equal(first.status, 0, first.stderr);
  const keyPath = join(root, ".mail-accounts", "private.key");
  const key = await readFile(keyPath);
  assert.equal(key.length, 32);
  if (process.platform !== "win32")
    assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
  const second = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import {decrypt} from ${JSON.stringify(pathToFileURL(modulePath).href)};
    assert.equal(decrypt(${JSON.stringify(first.stdout.trim())}), 'private-refresh-token');
  `,
    ],
    { env: environment, encoding: "utf8" },
  );
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(await readFile(keyPath), key);
});
