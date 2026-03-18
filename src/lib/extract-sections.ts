/**
 * Client-side extraction of Sophos Config Viewer HTML exports.
 * Uses the browser's native DOMParser to handle even massive files.
 */

// Maps camelCase sidebar keys → HTML section IDs used in the export
const SECTION_ID_MAP: Record<string, string> = {
  macHosts: "mac-hosts",
  portsWithVlans: "ports-vlans-aliases",
  firewallRules: "firewall-rules",
  NATRule: "nat-rules",
  LocalServiceACL: "local-service-acl",
  sslTlsInspectionRules: "ssl-tls-inspection-rules",
  groups: "groups",
  Country: "countries",
  IntrusionPrevention: "intrusion-prevention",
  VirusScanning: "virus-scanning",
  WebFilter: "web-filters",
  Zone: "zones",
  Network: "networks",
  REDDevice: "red-devices",
  WirelessAccessPoint: "wireless-access-points",
  WebFilterPolicy: "webfilter-policies",
  IPSPolicy: "ips-policies",
  // OTP & auth sections use "additional-<Key>" in Sophos HTML
  OTPSettings: "additional-OTPSettings",
};

export interface ExtractedSections {
  [sectionName: string]: SectionData;
}

export interface SectionData {
  tables: TableData[];
  text: string;
  details: DetailBlock[];
}

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface DetailBlock {
  title: string;
  fields: Record<string, string>;
}

function extractTable(tableEl: Element): TableData {
  const headerCells = tableEl.querySelectorAll("thead tr th, tr:first-child th");
  const headers: string[] = [];

  // Try explicit headers first
  if (headerCells.length > 0) {
    headerCells.forEach((th) => {
      headers.push((th.textContent ?? "").replace(/\s+/g, " ").trim());
    });
  } else {
    const firstRow = tableEl.querySelector("tr");
    if (firstRow) {
      const hdrCells = firstRow.querySelectorAll(".sophos-table-header");
      if (hdrCells.length > 0) {
        hdrCells.forEach((c) => headers.push((c.textContent ?? "").replace(/\s+/g, " ").trim()));
      }
    }
  }

  const rows: Record<string, string>[] = [];
  // Only keep rows that belong directly to this table (not nested sub-tables).
  // Uses closest("table") which is O(1) — far cheaper than the old
  // closest('[id^="details-"]') attribute selector that had to climb the full tree.
  const allRows = Array.from(tableEl.querySelectorAll("tr")).filter(
    (tr) => tr.closest("table") === tableEl
  );

  allRows.forEach((tr, idx) => {
    // Skip header row
    if (idx === 0 && headers.length > 0) return;
    // Skip detail/expansion rows (direct children of this table)
    if (tr.id?.startsWith("details-") || tr.id?.startsWith("rule-content-")) return;

    const cells = tr.querySelectorAll("td, .sophos-table-cell");
    if (cells.length === 0) return;

    // If we have headers, map cells by index (first N to headers, any extra to colN) so we never drop rows or columns
    if (headers.length > 0) {
      const row: Record<string, string> = {};
      cells.forEach((cell, i) => {
        const key = i < headers.length ? (headers[i] || `col${i}`) : `col${i}`;
        row[key] = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
      });
      if (Object.values(row).some((v) => v)) rows.push(row);
    } else if (cells.length === 2) {
      // Key-value table
      const key = (cells[0].textContent ?? "").replace(/\s+/g, " ").trim();
      const val = (cells[1].textContent ?? "").replace(/\s+/g, " ").trim();
      if (key) rows.push({ [key]: val });
    } else {
      const row: Record<string, string> = {};
      cells.forEach((cell, i) => {
        row[`col${i}`] = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
      });
      if (Object.values(row).some((v) => v)) rows.push(row);
    }
  });

  return { headers, rows };
}

/** Merge tables that have the same headers (or compatible) into one table with all rows. Ensures no firewall rules are lost when HTML has multiple tables. */
function mergeTablesWithSameHeaders(tables: TableData[]): TableData[] {
  if (tables.length <= 1) return tables;
  const byHeaderKey = new Map<string, TableData>();

  function headerKey(headers: string[]): string {
    return headers.map((h) => h.trim().toLowerCase()).join("|");
  }

  for (const t of tables) {
    const key = headerKey(t.headers);
    const existing = byHeaderKey.get(key);
    if (existing) {
      existing.rows.push(...t.rows);
    } else {
      byHeaderKey.set(key, { headers: t.headers, rows: [...t.rows] });
    }
  }

  return Array.from(byHeaderKey.values());
}

function extractDetailBlocks(container: Element): DetailBlock[] {
  const blocks: DetailBlock[] = [];

  // Look for detail/expansion rows (hidden rows with rule details)
  const detailRows = container.querySelectorAll('[id^="details-"]');
  detailRows.forEach((detailRow) => {
    const h4s = detailRow.querySelectorAll("h4");
    h4s.forEach((h4) => {
      const title = (h4.textContent ?? "").replace(/\s+/g, " ").trim();
      const fields: Record<string, string> = {};

      // Get the table right after this h4
      const parent = h4.parentElement;
      if (parent) {
        const table = parent.querySelector("table");
        if (table) {
          table.querySelectorAll("tr").forEach((tr) => {
            const cells = tr.querySelectorAll("td");
            if (cells.length === 2) {
              const key = (cells[0].textContent ?? "").replace(/\s+/g, " ").trim();
              const val = (cells[1].textContent ?? "").replace(/\s+/g, " ").trim();
              if (key) fields[key] = val;
            }
          });
        }
      }

      if (title && Object.keys(fields).length > 0) {
        blocks.push({ title, fields });
      }
    });
  });

  return blocks;
}

/**
 * Extract key-value pairs from Sophos OTP/settings sections that use grid divs
 * (display:grid with two columns) instead of tables. Used for OTPSettings.
 */
function extractKeyValueGrids(container: Element): TableData | null {
  const rows: Record<string, string>[] = [];
  const gridRows = container.querySelectorAll(
    'div[style*="display"][style*="grid"], div[style*="grid-template-columns"]'
  );
  gridRows.forEach((row) => {
    // Skip grids inside rule detail/expansion rows to avoid
    // inflating settings-style data with per-rule config fields
    if (row.closest('[id^="details-"]') || row.closest('[id^="rule-content-"]')) return;
    const children = row.querySelectorAll(":scope > div");
    if (children.length !== 2) return;
    const key = (children[0].textContent ?? "").replace(/\s+/g, " ").trim();
    let val = (children[1].textContent ?? "").replace(/\s+/g, " ").trim();
    if (!val) {
      const span = children[1].querySelector("span");
      if (span) val = (span.textContent ?? "").trim();
    }
    if (key) rows.push({ Setting: key, Value: val });
  });
  if (rows.length === 0) return null;
  return { headers: ["Setting", "Value"], rows };
}

const KNOWN_OTP_KEYS = [
  "otp", "allUsers", "tokenAutoCreation", "otpUserPortal", "otpVPNPortal",
  "otpSSLVPN", "otpWebAdmin", "otpIPsec"
];

/** Fallback: find OTP key-value pairs when grid structure varies (e.g. otpIPsec in different layout). */
function extractOtpKeyValueFallback(container: Element): TableData | null {
  const rows: Record<string, string>[] = [];
  const seen = new Set<string>();
  // (1) Any div with exactly two direct children where first looks like an OTP key
  container.querySelectorAll("div").forEach((div) => {
    const children = div.querySelectorAll(":scope > div");
    if (children.length !== 2) return;
    const key = (children[0].textContent ?? "").replace(/\s+/g, " ").trim();
    const keyNorm = key.replace(/\s+/g, "");
    if (!KNOWN_OTP_KEYS.some((k) => keyNorm.toLowerCase().includes(k.toLowerCase()))) return;
    if (seen.has(keyNorm)) return;
    seen.add(keyNorm);
    let val = (children[1].textContent ?? "").replace(/\s+/g, " ").trim();
    if (!val) {
      const span = children[1].querySelector("span");
      if (span) val = (span.textContent ?? "").trim();
    }
    if (key && val) rows.push({ Setting: key, Value: val });
  });
  // (2) Text scan: look for "otpIPsec" etc. followed by Enabled/Disabled (handles spans or inline layout)
  const text = (container.textContent ?? "").replace(/\s+/g, " ");
  KNOWN_OTP_KEYS.forEach((key) => {
    const keyNorm = key.replace(/\s+/g, "");
    if (seen.has(keyNorm)) return;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped + "\\s*[:\\s]+(Enabled|Disabled|On|Off|Yes|No)", "i");
    const m = text.match(re);
    if (m) {
      seen.add(keyNorm);
      rows.push({ Setting: key, Value: m[1] });
    }
  });
  if (rows.length === 0) return null;
  return { headers: ["Setting", "Value"], rows };
}

const INTERFACES_HEADERS = ["Interface / VLAN", "VLAN", "Zone", "IP Address", "Description"];

/**
 * Extract Interfaces & Network table from the ports-vlans-aliases section.
 * The HTML uses cards (divs with h4 + nested VLANs/Aliases) instead of a table,
 * so we parse the card layout into one row per interface/VLAN/alias.
 */
function extractPortsVlansTable(container: Element): TableData | null {
  const rows: Record<string, string>[] = [];
  // V2 reports wrap cards in a div with data-table-id="interfaces" after a search bar;
  // V1 reports use the first child div directly
  const wrapper =
    container.querySelector('[data-table-id="interfaces"]') ??
    container.querySelector('div[style*="flex-direction"][style*="column"]') ??
    container.querySelector(":scope > div");
  if (!wrapper) return null;
  const cards = wrapper.querySelectorAll(":scope > div[style*='border']");
  if (cards.length === 0) return null;

  function getGridPairs(parent: Element): Record<string, string> {
    const out: Record<string, string> = {};
    const grid = parent.querySelector("div[style*='grid']");
    if (grid) {
      grid.querySelectorAll(":scope > div").forEach((d) => {
        const t = (d.textContent ?? "").trim();
        const m = t.match(/^(IP|Zone|IPv4|Hardware|Speed)\s*:\s*(.+)$/i);
        if (m) out[m[1]] = m[2].trim();
      });
    }
    if (Object.keys(out).length === 0) {
      parent.querySelectorAll("div").forEach((d) => {
        const t = (d.textContent ?? "").trim();
        const m = t.match(/^(IP|Zone|IPv4|Hardware|Speed)\s*:\s*(.+)$/i);
        if (m) out[m[1]] = m[2].trim();
      });
    }
    return out;
  }

  cards.forEach((card) => {
    const h4 = card.querySelector("h4");
    const baseName = (h4?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!baseName) return;

    // VLANs subsection: divs with purple border-left (VLAN blocks)
    const vlanSection = Array.from(card.querySelectorAll("h5")).find((h) =>
      (h.textContent ?? "").toLowerCase().includes("vlan")
    );
    if (vlanSection) {
      const vlanContainer = vlanSection.parentElement?.nextElementSibling ?? vlanSection.closest("div")?.nextElementSibling;
      const vlanBlocks = vlanContainer
        ? vlanContainer.querySelectorAll('[style*="border-left"][style*="solid"]')
        : card.querySelectorAll('[style*="border-left"][style*="a855f7"]');
      vlanBlocks.forEach((block) => {
        const text = (block.textContent ?? "").replace(/\s+/g, " ");
        const idMatch = text.match(/ID:\s*(\d+)/i);
        const vlanId = idMatch ? idMatch[1] : "-";
        const nameSpan = block.querySelector('span[style*="font-weight"]');
        const desc = (nameSpan?.textContent ?? "").trim() || (text.match(/^([^I]+?)(?=\s*ID:|\s*ON\s|$)/)?.[1]?.trim() ?? "").replace(/\s+/g, " ") || baseName + "." + vlanId;
        const pairs = getGridPairs(block);
        const ip = pairs["IP"] ?? pairs["IPv4"] ?? "";
        const zone = pairs["Zone"] ?? "";
        const ifName = vlanId !== "-" ? `${baseName}.${vlanId}` : baseName;
        rows.push({
          "Interface / VLAN": ifName,
          VLAN: vlanId,
          Zone: zone,
          "IP Address": ip,
          Description: desc,
        });
      });
    }

    // Aliases subsection
    const aliasSection = Array.from(card.querySelectorAll("h5")).find((h) =>
      (h.textContent ?? "").toLowerCase().includes("alias")
    );
    if (aliasSection) {
      const aliasContainer = aliasSection.parentElement?.nextElementSibling ?? aliasSection.closest("div")?.nextElementSibling;
      const aliasBlocks = aliasContainer
        ? aliasContainer.querySelectorAll('[style*="border-left"][style*="solid"]')
        : [];
      aliasBlocks.forEach((block) => {
        const text = (block.textContent ?? "").replace(/\s+/g, " ");
        const nameEl = block.querySelector("div[style*='font-weight']") ?? block.querySelector("span[style*='font-weight']") ?? block.firstElementChild;
        const aliasName = (nameEl?.textContent ?? "").trim() || text.split("IPv4")[0]?.trim() || baseName + ":0";
        const ipMatch = text.match(/IPv4:\s*([\d./]+)/i) ?? text.match(/IP:\s*([\d./]+)/i);
        const ip = ipMatch ? ipMatch[1].trim() : "";
        rows.push({
          "Interface / VLAN": aliasName,
          VLAN: "-",
          Zone: "-",
          "IP Address": ip,
          Description: "Alias",
        });
      });
    }

    // Port-level only (no VLANs/Aliases): single row from card header grid
    if (!vlanSection && !aliasSection) {
      const headerArea = card.querySelector("[style*='linear-gradient']");
      const pairs = headerArea ? getGridPairs(headerArea) : getGridPairs(card);
      const ip = pairs["IP"] ?? pairs["IPv4"] ?? "";
      const zone = pairs["Zone"] ?? "-";
      // Skip duplicate sub-interface cards (e.g. Port1.99 XFRM card when we already have Port1.99 from Port1 VLANs)
      if (baseName.includes(".") && !ip) return;
      rows.push({
        "Interface / VLAN": baseName,
        VLAN: "-",
        Zone: zone,
        "IP Address": ip,
        Description: baseName === "HA link" ? "HA link" : "",
      });
    }
  });

  if (rows.length === 0) return null;
  return { headers: INTERFACES_HEADERS, rows };
}

/**
 * For firewall rules sections: extract the key-value pairs from each rule's
 * expandable detail block and merge them into the corresponding main table row.
 * Real Sophos exports store Source Zones, Destination Zones, Web Filter, IPS,
 * Application Control, Log Traffic, etc. inside detail blocks, not in the main table.
 */
function mergeRuleDetails(container: Element, mainTable: TableData): TableData {
  const enrichedRows: Record<string, string>[] = [];
  const enrichedHeaders = new Set(mainTable.headers);

  function addField(row: Record<string, string>, rawKey: string, val: string) {
    const key = rawKey.replace(/:$/, "").trim();
    if (key && val && !row[key]) {
      row[key] = val;
      enrichedHeaders.add(key);
    }
  }

  for (let i = 0; i < mainTable.rows.length; i++) {
    const row = { ...mainTable.rows[i] };

    // Detail rows have IDs like "details-fw-rule-0", "details-fw-rule-1", etc.
    const detailRow = container.querySelector(`[id="details-fw-rule-${i}"]`);
    if (!detailRow) {
      enrichedRows.push(row);
      continue;
    }

    // 1. Extract from sub-tables (older HTML format)
    const subTables = detailRow.querySelectorAll("table");
    subTables.forEach((table) => {
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = tr.querySelectorAll("td");
        if (cells.length === 2) {
          addField(row,
            (cells[0].textContent ?? "").replace(/\s+/g, " ").trim(),
            (cells[1].textContent ?? "").replace(/\s+/g, " ").trim(),
          );
        }
      });
    });

    // 2. Extract from div-based flex key-value layouts (newer HTML format)
    //    Pattern: <div style="display: flex; ..."><div>Label:</div><div>Value</div></div>
    const flexPairs = detailRow.querySelectorAll('div[style*="display: flex"][style*="space-between"]');
    flexPairs.forEach((pair) => {
      const children = pair.children;
      if (children.length === 2) {
        const rawKey = (children[0].textContent ?? "").replace(/\s+/g, " ").trim();
        const val = (children[1].textContent ?? "").replace(/\s+/g, " ").trim();
        addField(row, rawKey, val);
      }
    });

    enrichedRows.push(row);
  }

  return { headers: Array.from(enrichedHeaders), rows: enrichedRows };
}

function extractSectionContent(doc: Document, htmlId: string): SectionData | null {
  const container = doc.getElementById(`section-content-${htmlId}`);
  if (!container) return null;

  const tables: TableData[] = [];
  const isFirewallRules = htmlId === "firewall-rules";

  // Interfaces & Network: parse card layout into a single table (no <table> in HTML)
  if (htmlId === "ports-vlans-aliases") {
    const ifTable = extractPortsVlansTable(container);
    if (ifTable) tables.push(ifTable);
  }

  // Extract all tables in this section
  const mainTables = container.querySelectorAll(":scope > div > table, :scope > table, .sophos-table");
  const allTables = mainTables.length > 0 ? mainTables : container.querySelectorAll("table");

  const processedTables = new Set<Element>();
  allTables.forEach((table) => {
    if (table.closest('[id^="details-"]') || table.closest('[id^="rule-content-"]')) return;
    if (processedTables.has(table)) return;
    processedTables.add(table);

    let data = extractTable(table);
    if (data.rows.length > 0) {
      // For firewall rules: merge detail block data into each row
      if (isFirewallRules) {
        data = mergeRuleDetails(container, data);
      }
      tables.push(data);
    }
  });

  // OTP/settings sections use grid divs (not tables); extract as Setting/Value table
  const gridTable = extractKeyValueGrids(container);
  if (gridTable) tables.push(gridTable);
  // OTP fallback: capture keys like otpIPsec when in a different grid/layout
  if (htmlId === "additional-OTPSettings" || htmlId === "OTPSettings") {
    const otpFallback = extractOtpKeyValueFallback(container);
    if (otpFallback?.rows.length) {
      const existingKeys = new Set(
        (gridTable?.rows ?? []).map((r) => (r.Setting ?? (r as Record<string, string>)["Setting"] ?? "").toString().toLowerCase())
      );
      const newRows = otpFallback.rows.filter(
        (r) => !existingKeys.has((r.Setting ?? "").toString().toLowerCase())
      );
      if (newRows.length) tables.push({ headers: otpFallback.headers, rows: newRows });
    }
  }

  // Extract detail blocks (expanded rule details)
  const details = extractDetailBlocks(container);

  // Merge tables with identical headers so we don't lose rows (e.g. firewall rules split across multiple tables)
  const mergedTables = mergeTablesWithSameHeaders(tables);

  // Get plain text as fallback
  const text = mergedTables.length === 0 && details.length === 0
    ? (container.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 5000)
    : "";

  if (mergedTables.length === 0 && details.length === 0 && !text) return null;

  return { tables: mergedTables, text, details };
}

/**
 * Parse the full Sophos Config Viewer HTML in the browser and extract
 * all section data into a compact JSON structure.
 */
const SOPHOS_MARKERS = [
  "data-section-key",
  "section-content-firewall-rules",
  "sophos-table",
  "Sophos Firewall",
];

function isSophosConfigHtml(html: string): boolean {
  return SOPHOS_MARKERS.some((marker) => html.includes(marker));
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

export async function extractSections(html: string): Promise<ExtractedSections> {
  if (!html || typeof html !== "string" || html.length < 50) {
    console.warn("[extractSections] Input too short or invalid, returning empty");
    return {};
  }

  if (!isSophosConfigHtml(html)) {
    console.warn("[extractSections] Input does not appear to be a Sophos config export");
    return {};
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const sections: ExtractedSections = {};

    const checkboxes = Array.from(doc.querySelectorAll("input[data-section-key]"));

    for (let ci = 0; ci < checkboxes.length; ci++) {
      const cb = checkboxes[ci];
      const sectionKey = cb.getAttribute("data-section-key");
      if (!sectionKey) continue;

      const parent = cb.closest("[data-section-name]");
      const displayName = parent?.getAttribute("data-section-name") ?? sectionKey;

      const mappedId = SECTION_ID_MAP[sectionKey];
      let data: SectionData | null = null;

      try {
        if (mappedId) {
          data = extractSectionContent(doc, mappedId);
        }
        if (!data) {
          data = extractSectionContent(doc, sectionKey);
        }
        if (!data) {
          data = extractSectionContent(doc, `additional-${sectionKey}`);
        }
      } catch (err) {
        console.warn(`[extractSections] Failed to extract section "${sectionKey}":`, err);
      }

      if (data) {
        const readableName = displayName === sectionKey
          ? sectionKey.replace(/([A-Z])/g, " $1").trim()
          : displayName;
        sections[readableName] = data;
      }

      // Yield to the main thread every few sections so the UI stays responsive
      if (ci % 3 === 2) await yieldToMain();
    }

    const mapEntries = Object.entries(SECTION_ID_MAP);
    for (let ei = 0; ei < mapEntries.length; ei++) {
      const [key, htmlId] = mapEntries[ei];
      const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const alreadyFound = Object.keys(sections).some(
        (name) => normalise(name) === normalise(key)
      );
      if (alreadyFound) continue;

      try {
        const data = extractSectionContent(doc, htmlId);
        if (data) {
          const name = key.replace(/([A-Z])/g, " $1").trim();
          sections[name] = data;
        }
      } catch (err) {
        console.warn(`[extractSections] Failed fallback extraction for "${key}":`, err);
      }

      if (ei % 3 === 2) await yieldToMain();
    }

    const hasOtp = Object.keys(sections).some((name) =>
      /otpsettings|otp settings/i.test(name.replace(/\s+/g, ""))
    );
    if (!hasOtp) {
      try {
        const otpData = extractSectionContent(doc, "additional-OTPSettings");
        if (otpData) {
          sections["Authentication & OTP Settings"] = otpData;
        }
      } catch (err) {
        console.warn("[extractSections] OTP extraction failed:", err);
      }
    }

    return sections;
  } catch (err) {
    console.error("[extractSections] Fatal parsing error:", err);
    return {};
  }
}
