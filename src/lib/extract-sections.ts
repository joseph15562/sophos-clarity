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
    // Check if first row has sophos-table-header cells
    const firstRow = tableEl.querySelector("tr");
    if (firstRow) {
      const hdrCells = firstRow.querySelectorAll(".sophos-table-header");
      if (hdrCells.length > 0) {
        hdrCells.forEach((c) => headers.push((c.textContent ?? "").replace(/\s+/g, " ").trim()));
      }
    }
  }

  const rows: Record<string, string>[] = [];
  const allRows = tableEl.querySelectorAll("tr");

  allRows.forEach((tr, idx) => {
    // Skip header row
    if (idx === 0 && headers.length > 0) return;
    // Skip detail/expansion rows
    if (tr.id?.startsWith("details-")) return;

    const cells = tr.querySelectorAll("td, .sophos-table-cell");
    if (cells.length === 0) return;

    // If we have headers, map to them; otherwise use indices
    if (headers.length > 0 && cells.length <= headers.length) {
      const row: Record<string, string> = {};
      cells.forEach((cell, i) => {
        const key = headers[i] || `col${i}`;
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

function extractSectionContent(doc: Document, htmlId: string): SectionData | null {
  const container = doc.getElementById(`section-content-${htmlId}`);
  if (!container) return null;

  // Extract all tables in this section
  const tables: TableData[] = [];
  // Get the main table (direct child or first-level)
  const mainTables = container.querySelectorAll(":scope > div > table, :scope > table, .sophos-table");
  // Fallback: any table that isn't inside a details row
  const allTables = mainTables.length > 0 ? mainTables : container.querySelectorAll("table");

  const processedTables = new Set<Element>();
  allTables.forEach((table) => {
    // Skip tables inside detail expansion rows
    if (table.closest('[id^="details-"]') || table.closest('[id^="rule-content-"]')) return;
    if (processedTables.has(table)) return;
    processedTables.add(table);

    const data = extractTable(table);
    if (data.rows.length > 0) tables.push(data);
  });

  // OTP/settings sections use grid divs (not tables); extract as Setting/Value table
  const gridTable = extractKeyValueGrids(container);
  if (gridTable) tables.push(gridTable);

  // Extract detail blocks (expanded rule details)
  const details = extractDetailBlocks(container);

  // Get plain text as fallback
  const text = tables.length === 0 && details.length === 0
    ? (container.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 5000)
    : "";

  if (tables.length === 0 && details.length === 0 && !text) return null;

  return { tables, text, details };
}

/**
 * Parse the full Sophos Config Viewer HTML in the browser and extract
 * all section data into a compact JSON structure.
 */
export function extractSections(html: string): ExtractedSections {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const sections: ExtractedSections = {};

  // Use the sidebar checkboxes to discover available sections
  const checkboxes = doc.querySelectorAll("input[data-section-key]");

  checkboxes.forEach((cb) => {
    const sectionKey = cb.getAttribute("data-section-key");
    if (!sectionKey) return;

    // Get display name from parent element's data-section-name or label
    const parent = cb.closest("[data-section-name]");
    const displayName = parent?.getAttribute("data-section-name") ?? sectionKey;

    const mappedId = SECTION_ID_MAP[sectionKey];
    let data: SectionData | null = null;

    if (mappedId) {
      data = extractSectionContent(doc, mappedId);
    }
    if (!data) {
      data = extractSectionContent(doc, sectionKey);
    }
    if (!data) {
      data = extractSectionContent(doc, `additional-${sectionKey}`);
    }

    if (data) {
      const readableName = displayName === sectionKey
        ? sectionKey.replace(/([A-Z])/g, " $1").trim()
        : displayName;
      sections[readableName] = data;
    }
  });

  // Also try direct ID lookup for any sections we might have missed
  for (const [key, htmlId] of Object.entries(SECTION_ID_MAP)) {
    // Check if we already got this from sidebar
    const alreadyFound = Object.keys(sections).some(
      (name) => name.toLowerCase().replace(/\s+/g, "") === key.toLowerCase()
    );
    if (alreadyFound) continue;

    const data = extractSectionContent(doc, htmlId);
    if (data) {
      // Use the key as name, add spaces before capitals
      const name = key.replace(/([A-Z])/g, " $1").trim();
      sections[name] = data;
    }
  }

  // Ensure OTP section is present when HTML has it (section-content-additional-OTPSettings)
  const hasOtp = Object.keys(sections).some((name) =>
    /otpsettings|otp settings/i.test(name.replace(/\s+/g, ""))
  );
  if (!hasOtp) {
    const otpData = extractSectionContent(doc, "additional-OTPSettings");
    if (otpData) {
      sections["Authentication & OTP Settings"] = otpData;
    }
  }

  return sections;
}
