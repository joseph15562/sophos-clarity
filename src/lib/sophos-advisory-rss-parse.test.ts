import { describe, expect, it } from "vitest";
import {
  inferSophosAdvisoryCategory,
  parseSophosAdvisoryRssXml,
} from "./sophos-advisory-rss-parse";

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item>
<title>Resolved … Sophos AP6 Series Wireless Access Points …</title>
<link>https://www.sophos.com/en-us/security-advisories/sophos-sa-20250909-ap6</link>
<description><![CDATA[<div><strong>Severity:</strong> critical</div><div><strong>CVE:</strong> CVE-2025-10159</div><div><strong>First Published:</strong> <time datetime="2025-09-09T14:38:18.000Z">Tue, 09 Sep 2025 14:38:18 GMT</time></div>]]></description>
<pubDate>Tue, 09 Sep 2025 00:00:00 GMT</pubDate>
<guid>sophos-sa-20250909-ap6</guid>
</item>
</channel></rss>`;

describe("sophos-advisory-rss-parse", () => {
  it("infers Network for AP / wireless titles", () => {
    expect(inferSophosAdvisoryCategory("Sophos AP6 Wireless Access Points")).toBe("Network");
  });

  it("parses severity, CVE, and category from RSS item", () => {
    const items = parseSophosAdvisoryRssXml(SAMPLE, 10);
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("Network");
    expect(items[0].severity).toBe("CRITICAL");
    expect(items[0].cve).toBe("CVE-2025-10159");
  });
});
