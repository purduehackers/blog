import test from "node:test";
import assert from "node:assert/strict";
import { imageLayout } from "../src/lib/admin/image-layout.ts";

const figure = (n: number) =>
  `<figure><img src="https://example.com/${n}.png" alt="Photo ${n}"><figcaption>Caption ${n}</figcaption></figure>`;

test("four adjacent images form a two-column gallery without losing order or captions", () => {
  const html = imageLayout(
    [1, 2, 3, 4].map(figure).join('<p style="margin:16px 0"></p>'),
  );
  assert.match(html, /notion-gallery-2/);
  assert.equal((html.match(/<tr>/g) || []).length, 2);
  assert.equal((html.match(/<figcaption>/g) || []).length, 4);
  assert.ok(html.indexOf("Caption 2") < html.indexOf("Caption 3"));
});

test("three images form one row, while text keeps separate image groups apart", () => {
  const html = imageLayout(
    [1, 2, 3].map(figure).join("") + "<p>Next event</p>" + figure(4),
  );
  assert.match(html, /notion-gallery-3/);
  assert.equal((html.match(/<tr>/g) || []).length, 1);
  assert.ok(html.includes("</table><p>Next event</p><figure>"));
  assert.equal(imageLayout(figure(1)), figure(1));
});

test("website images support the existing lightbox while email images remain ordinary images", () => {
  const html = imageLayout(figure(1), true);
  assert.match(
    html,
    /href="https:\/\/example.com\/1.png" data-fancybox="post" data-caption="Photo 1"/,
  );
  assert.ok(!imageLayout(figure(1)).includes("data-fancybox"));
});

test("text and headings between photo groups survive gallery formatting", () => {
  const between = "<h2>Upcoming events</h2><p>Do not lose this paragraph.</p>";
  for (const zoom of [false, true]) {
    const html = imageLayout(figure(1) + between + figure(2) + figure(3), zoom);
    assert.ok(html.includes(between));
    assert.equal((html.match(/<figure>/g) || []).length, 3);
    assert.equal((html.match(/<table /g) || []).length, 1);
    assert.ok(html.indexOf(between) < html.indexOf("<table "));
  }
});
