import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { escapeHtml, isValidSophosXml } from "./email.ts";

Deno.test("escapeHtml escapes ampersand", () => {
  assertEquals(escapeHtml("A & B"), "A &amp; B");
});

Deno.test("escapeHtml escapes angle brackets", () => {
  assertEquals(escapeHtml("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
});

Deno.test("escapeHtml escapes quotes", () => {
  assertEquals(escapeHtml('He said "hello"'), "He said &quot;hello&quot;");
});

Deno.test("escapeHtml escapes single quotes", () => {
  assertEquals(escapeHtml("it's"), "it&#39;s");
});

Deno.test("escapeHtml handles empty string", () => {
  assertEquals(escapeHtml(""), "");
});

Deno.test("escapeHtml handles plain text unchanged", () => {
  assertEquals(escapeHtml("Hello World 123"), "Hello World 123");
});

Deno.test("escapeHtml handles multiple special chars", () => {
  assertEquals(
    escapeHtml('<img src="x" onerror="alert(1)">'),
    "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
  );
});

Deno.test("isValidSophosXml accepts valid XML with Response tag", () => {
  assertEquals(isValidSophosXml('<?xml version="1.0"?><Response><FirewallRule/></Response>'), true);
});

Deno.test("isValidSophosXml accepts XML starting with Response", () => {
  assertEquals(isValidSophosXml("<Response><NATRule/></Response>"), true);
});

Deno.test("isValidSophosXml rejects non-XML input", () => {
  assertEquals(isValidSophosXml("just some text"), false);
});

Deno.test("isValidSophosXml rejects XML without Sophos tags", () => {
  assertEquals(isValidSophosXml('<?xml version="1.0"?><Root><Item/></Root>'), false);
});

Deno.test("isValidSophosXml rejects empty input", () => {
  assertEquals(isValidSophosXml(""), false);
});
