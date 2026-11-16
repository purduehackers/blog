import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { authorAvatarUrl, identiconSvg } from "../src/lib/id-avatar.ts";
import { parseMarkdownLink } from "../src/lib/utils.ts";

test("generated avatars match the original Purdue Hackers ID generator", () => {
  // Captured from ID's pixel.ts at 2500796bb4d77b2de49c2a6bbb2e3d8c20d1e682.
  const vectors = {
    neil: "916234102e1dde1af4f8882da3fa2b38260ba5bc93e430ff8083feafa66cf47b",
    "sean choi":
      "192675a5a96298e295da3176773776afe4bfbc45143430a2ee801b090d12d57c",
  };
  for (const [seed, expected] of Object.entries(vectors)) {
    assert.equal(
      createHash("sha256").update(identiconSvg(seed)).digest("hex"),
      expected,
    );
  }
});

test("an author keeps the same avatar across name formatting differences", () => {
  const avatar = authorAvatarUrl("Reece Ausmus");
  assert.equal(authorAvatarUrl("  REECE   AUSMUS  "), avatar);
  assert.notEqual(authorAvatarUrl("Sean Choi"), avatar);
});

test("missing photos and plain names use local generated avatars", () => {
  for (const input of ["[Sean Choi]()", "Sean Choi"]) {
    assert.deepEqual(parseMarkdownLink(input), {
      author: "Sean Choi",
      avatarUrl: authorAvatarUrl("Sean Choi"),
    });
  }
  assert.equal(parseMarkdownLink("").author, "Unknown");
});

test("real photo URLs, including query parameters, are preserved", () => {
  const photo = "https://github.com/ImTheSquid.png?size=96&v=4";
  assert.deepEqual(parseMarkdownLink(`[Jack Hogan](${photo})`), {
    author: "Jack Hogan",
    avatarUrl: photo,
  });
});
