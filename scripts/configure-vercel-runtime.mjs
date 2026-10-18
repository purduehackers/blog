import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// @astrojs/vercel 7 supports Astro 4 but defaults to Node 18 when built on
// Node 22. Update its Build Output API metadata to the supported runtime.
// Remove this step when upgrading Astro and its Vercel adapter together.
const functionsDirectory = ".vercel/output/functions";
const files = await readdir(functionsDirectory, { recursive: true });
let updated = 0;
for (const file of files) {
  if (!file.endsWith(".vc-config.json")) continue;
  const path = join(functionsDirectory, file);
  const config = JSON.parse(await readFile(path, "utf8"));
  if (!config.runtime?.startsWith("nodejs")) continue;
  config.runtime = "nodejs22.x";
  config.maxDuration = 60;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  updated++;
}
if (updated === 0) {
  throw new Error("Expected a Vercel Node.js function for newsletter signup.");
}
console.log(`Configured ${updated} Vercel function(s) for Node.js 22.`);
