import test from "node:test";
import assert from "node:assert/strict";
import { subscribe } from "../src/lib/newsletter.ts";

const config = { apiKey: "test-key", databaseId: "test-database" };
const signup = { name: " Test Hacker ", email: " Hacker@Example.com " };
const request = (body: unknown = signup, origin = "https://blog.example.com") =>
  new Request("https://blog.example.com/api/subscribe", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function mockNotion(existing = false, nameType = "title", emailType = "email") {
  const calls: { url: string; body: any }[] = [];
  const mock = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-key",
    );
    const address = String(url);
    calls.push({
      url: address,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const value = address.includes("/databases/")
      ? { data_sources: [{ id: "mailing-source" }] }
      : address.endsWith("/query")
        ? { results: existing ? [{ id: "existing-person" }] : [] }
        : address.endsWith("/pages")
          ? { id: "new-person" }
          : {
              properties: {
                Name: { type: nameType },
                Email: { type: emailType },
              },
            };
    return Response.json(value);
  }) as typeof fetch;
  return { mock, calls };
}

test("creates a subscriber with trimmed name, normalized email and correct data source", async () => {
  const { mock, calls } = mockNotion();
  assert.equal((await subscribe(request(), config, mock)).status, 200);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[2]?.body.filter, {
    property: "Email",
    email: { equals: "hacker@example.com" },
  });
  assert.deepEqual(calls[3]?.body, {
    parent: { type: "data_source_id", data_source_id: "mailing-source" },
    properties: {
      Name: { title: [{ type: "text", text: { content: "Test Hacker" } }] },
      Email: { email: "hacker@example.com" },
    },
  });
});

test("existing subscribers get the same success without creating or changing a row", async () => {
  const { mock, calls } = mockNotion(true);
  const result = await subscribe(request(), config, mock);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 3);
});

test("supports rich text columns and an explicitly selected data source", async () => {
  const { mock, calls } = mockNotion(false, "rich_text", "rich_text");
  assert.equal(
    (
      await subscribe(
        request(),
        { ...config, dataSourceId: "selected-source" },
        mock,
      )
    ).status,
    200,
  );
  assert.equal(calls.length, 3);
  assert.ok(calls[0]?.url.endsWith("/data_sources/selected-source"));
  assert.deepEqual(calls[2]?.body.properties.Email, {
    rich_text: [{ type: "text", text: { content: "hacker@example.com" } }],
  });
});

test("rejects invalid fields and cross-origin requests before contacting Notion", async () => {
  const { mock, calls } = mockNotion();
  for (const body of [
    null,
    [],
    {},
    { name: "", email: "me@example.com" },
    { name: "Me", email: "invalid" },
    { name: "a".repeat(101), email: "me@example.com" },
  ]) {
    assert.equal((await subscribe(request(body), config, mock)).status, 400);
  }
  assert.equal(
    (
      await subscribe(
        request(signup, "https://other.example.com"),
        config,
        mock,
      )
    ).status,
    403,
  );
  assert.equal(
    (await subscribe(request({ ...signup, website: "spam" }), config, mock))
      .status,
    200,
  );
  assert.equal(
    (
      await subscribe(
        request({ ...signup, name: "a".repeat(5000) }),
        config,
        mock,
      )
    ).status,
    413,
  );
  assert.equal(calls.length, 0);
});

test("handles missing configuration, invalid schema and Notion failures without false success", async () => {
  const { mock, calls } = mockNotion(false, "number");
  assert.equal(
    (await subscribe(request(), { ...config, apiKey: "" }, mock)).status,
    503,
  );
  assert.equal((await subscribe(request(), config, mock)).status, 502);
  assert.equal(calls.length, 2);
  const failing = (async () =>
    Response.json(
      { message: "private upstream detail" },
      { status: 429 },
    )) as typeof fetch;
  const failed = await subscribe(request(), config, failing);
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("private upstream detail"));
  const multiple = (async () =>
    Response.json({
      data_sources: [{ id: "a" }, { id: "b" }],
    })) as typeof fetch;
  assert.equal((await subscribe(request(), config, multiple)).status, 502);
});
