import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  inferSophosAdvisoryCategory,
  parseSophosAdvisoryRssXml,
} from "./sophos_advisory_rss.ts";

const SAMPLE_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Resolved Authentication Bypass Vulnerability in Sophos AP6 Series Wireless Access Points Firmware (CVE-2025-10159)</title>
      <link>https://www.sophos.com/en-us/security-advisories/sophos-sa-20250909-ap6</link>
      <description><![CDATA[<div><strong>Severity:</strong> critical</div><div><strong>CVE:</strong> CVE-2025-10159</div><div><strong>First Published:</strong> <time datetime="2025-09-09T14:38:18.000Z">Tue, 09 Sep 2025 14:38:18 GMT</time></div>]]></description>
      <pubDate>Tue, 09 Sep 2025 00:00:00 GMT</pubDate>
      <guid isPermaLink="false">sophos-sa-20250909-ap6</guid>
    </item>
    <item>
      <title>Resolved Multiple Vulnerabilities in Sophos Endpoint for Windows (CVE-2024-13972)</title>
      <link>https://www.sophos.com/en-us/security-advisories/sophos-sa-20250717-cix-lpe</link>
      <description><![CDATA[<div><strong>Severity:</strong> High</div><div><strong>CVE:</strong> CVE-2024-13972, CVE-2025-7433</div><div><strong>First Published:</strong> <time datetime="2025-07-17T18:00:00.000Z">Thu, 17 Jul 2025 18:00:00 GMT</time></div>]]></description>
      <pubDate>Wed, 06 Aug 2025 00:00:00 GMT</pubDate>
      <guid>sophos-sa-20250717-cix-lpe</guid>
    </item>
    <item>
      <title>Resolved Multiple Vulnerabilities in Sophos Firewall (CVE-2025-6704)</title>
      <link>https://www.sophos.com/en-us/security-advisories/sophos-sa-20250721-sfos-rce</link>
      <description><![CDATA[<div><strong>Severity:</strong> Critical</div><div><strong>CVE:</strong> CVE-2025-6704</div><div><strong>First Published:</strong> <time datetime="2025-07-21T11:00:00.000Z">Mon, 21 Jul 2025 11:00:00 GMT</time></div>]]></description>
      <pubDate>Mon, 21 Jul 2025 00:00:00 GMT</pubDate>
      <guid>sophos-sa-20250721-sfos-rce</guid>
    </item>
  </channel>
</rss>`;

Deno.test("inferSophosAdvisoryCategory — AP / wireless → Network", () => {
  assertEquals(
    inferSophosAdvisoryCategory(
      "Resolved … Sophos AP6 Series Wireless Access Points …",
    ),
    "Network",
  );
});

Deno.test("inferSophosAdvisoryCategory — Endpoint", () => {
  assertEquals(
    inferSophosAdvisoryCategory(
      "Resolved Multiple Vulnerabilities in Sophos Endpoint for Windows",
    ),
    "Endpoint",
  );
});

Deno.test("inferSophosAdvisoryCategory — Firewall / SFOS", () => {
  assertEquals(
    inferSophosAdvisoryCategory(
      "Resolved Multiple Vulnerabilities in Sophos Firewall",
    ),
    "Firewall",
  );
});

Deno.test("parseSophosAdvisoryRssXml — severity, CVE, category order", () => {
  const items = parseSophosAdvisoryRssXml(SAMPLE_RSS, 10);
  assertEquals(items.length, 3);

  assertEquals(items[0].category, "Network");
  assertEquals(items[0].severity, "CRITICAL");
  assertEquals(items[0].cve, "CVE-2025-10159");
  assertEquals(items[0].published, "2025-09-09");

  assertEquals(items[1].category, "Endpoint");
  assertEquals(items[1].severity, "HIGH");
  assertEquals(items[1].cve, "CVE-2024-13972");

  assertEquals(items[2].category, "Firewall");
  assertEquals(items[2].severity, "CRITICAL");
  assertEquals(items[2].cve, "CVE-2025-6704");
});
