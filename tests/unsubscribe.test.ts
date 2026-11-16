import test from "node:test";
import assert from "node:assert/strict";
import { unsubscribe } from "../src/lib/unsubscribe.ts";

const config = {
  apiKey: "test-key",
  databaseId: "database",
  dataSourceId: "mailing-source",
};
const request = (email: unknown = " Hacker@Example.com ") =>
  new Request("https://blog.example.com/api/unsubscribe", {
    method: "POST",
    headers: {
      origin: "https://blog.example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
function mockNotion(
  pages: string[][] = [["person"]],
  failPatch = false,
  validSchema = true,
) {
  const calls: { url: string; method: string | undefined; body: any }[] = [];
  let query = 0;
  const mock = (async (url: string | URL | Request, init?: RequestInit) => {
    const address = String(url);
    calls.push({
      url: address,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (init?.method === "PATCH")
      return Response.json({}, { status: failPatch ? 403 : 200 });
    if (address.endsWith("/query")) {
      const results = (pages[query] || []).map((id) => ({ id }));
      query++;
      return Response.json({
        results,
        has_more: query < pages.length,
        next_cursor: query < pages.length ? "next-page" : null,
      });
    }
    return Response.json({
      properties: {
        Email: { type: "email" },
        Unsubscribed: { type: validSchema ? "checkbox" : "rich_text" },
        "Unsubscribed At": { type: "date" },
      },
    });
  }) as typeof fetch;
  return { mock, calls };
}

test("marks matching contacts unsubscribed with a timestamp and preserves their other properties", async () => {
  const { mock, calls } = mockNotion();
  assert.equal((await unsubscribe(request(), config, mock)).status, 200);
  assert.deepEqual(calls[1]?.body.filter, {
    and: [
      { property: "Email", email: { equals: "hacker@example.com" } },
      { property: "Unsubscribed", checkbox: { equals: false } },
    ],
  });
  assert.equal(calls[2]?.method, "PATCH");
  assert.ok(calls[2]?.url.endsWith("/pages/person"));
  assert.equal(calls[2]?.body.properties.Unsubscribed.checkbox, true);
  assert.ok(
    Number.isFinite(
      Date.parse(calls[2]?.body.properties["Unsubscribed At"].date.start),
    ),
  );
  assert.deepEqual(Object.keys(calls[2]?.body.properties), [
    "Unsubscribed",
    "Unsubscribed At",
  ]);
});

test("updates all matching rows across query pages before reporting success", async () => {
  const { mock, calls } = mockNotion([["first"], ["second"]]);
  assert.equal((await unsubscribe(request(), config, mock)).status, 200);
  assert.equal(calls[2]?.body.start_cursor, "next-page");
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 2);
});

test("unknown and already-unsubscribed addresses succeed without writing or replacing timestamps", async () => {
  const { mock, calls } = mockNotion([[]]);
  const result = await unsubscribe(request(), config, mock);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  const active = mockNotion();
  assert.equal(
    await result.text(),
    await (await unsubscribe(request(), config, active.mock)).text(),
  );
});

test("GET, invalid emails and cross-origin requests never contact Notion", async () => {
  const { mock, calls } = mockNotion();
  assert.equal(
    (
      await unsubscribe(
        new Request(
          "https://blog.example.com/unsubscribe?email=hacker@example.com",
        ),
        config,
        mock,
      )
    ).status,
    405,
  );
  for (const email of [null, "", "invalid", "a".repeat(255) + "@example.com"]) {
    assert.equal((await unsubscribe(request(email), config, mock)).status, 400);
  }
  const crossOrigin = new Request(request(), {
    headers: {
      origin: "https://other.example.com",
      "content-type": "application/json",
    },
  });
  assert.equal((await unsubscribe(crossOrigin, config, mock)).status, 403);
  assert.equal(calls.length, 0);
});

test("configuration, schema and Notion write failures never report success", async () => {
  const { mock, calls } = mockNotion([["person"]], true);
  assert.equal(
    (await unsubscribe(request(), { ...config, apiKey: "" }, mock)).status,
    503,
  );
  assert.equal(calls.length, 0);
  assert.equal((await unsubscribe(request(), config, mock)).status, 502);
  const invalidSchema = mockNotion([["person"]], false, false);
  assert.equal(
    (await unsubscribe(request(), config, invalidSchema.mock)).status,
    502,
  );
  assert.equal(invalidSchema.calls.length, 1);
});
