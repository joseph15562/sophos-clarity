import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handlePortalDataRequest } from "./index.ts";

Deno.test("portal-data: OPTIONS returns 200 ok", async () => {
  const req = new Request(
    "https://example.com/functions/v1/portal-data?slug=demo",
    {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    },
  );
  const res = await handlePortalDataRequest(req);
  assertEquals(res.status, 200);
});

Deno.test("portal-data: GET without slug or org_id returns 400", async () => {
  const req = new Request("https://example.com/functions/v1/portal-data", {
    method: "GET",
    headers: { Origin: "http://localhost:5173" },
  });
  const res = await handlePortalDataRequest(req);
  assertEquals(res.status, 400);
});

Deno.test("portal-data: POST returns 405", async () => {
  const req = new Request(
    "https://example.com/functions/v1/portal-data?slug=x",
    {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    },
  );
  const res = await handlePortalDataRequest(req);
  assertEquals(res.status, 405);
});

Deno.test("portal-data: slug longer than 200 chars returns 400", async () => {
  const longSlug = "a".repeat(201);
  const req = new Request(
    `https://example.com/functions/v1/portal-data?slug=${
      encodeURIComponent(longSlug)
    }`,
    {
      method: "GET",
      headers: { Origin: "http://localhost:5173" },
    },
  );
  const res = await handlePortalDataRequest(req);
  assertEquals(res.status, 400);
});
