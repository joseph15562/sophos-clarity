/**
 * SE Health Check PDF via pdfmake (structured layout, headers/footers, tables).
 * Avoids HTML → canvas → jsPDF for this report.
 */

import pdfMake from "pdfmake/build/pdfmake";
import pdfVfs from "pdfmake/build/vfs_fonts";
import type {
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import type { SEHealthCheckReportParams } from "@/lib/se-health-check-report-html";
import { getActiveModules, MODULES } from "@/lib/sophos-licence";
import type { LicenceSelection, SophosBPScore } from "@/lib/sophos-licence";

/** Data URLs for PNGs (fetched from `/public` at PDF generation time). */
export type SeHealthCheckPdfImageAssets = {
  wordmark?: string;
  /** Dark wordmark for white-background page headers. */
  wordmarkDark?: string;
  shield?: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Render an SVG string to a high-resolution PNG data URL via offscreen canvas.
 * Scale factor 3x ensures crisp rendering in PDF viewers.
 */
function svgToHighResPng(
  svgText: string,
  width: number,
  height: number,
  scale = 3,
): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Load Sophos artwork for the PDF cover + overview header.
 * Wordmark is rendered from SVG at 3x resolution for crisp PDF output.
 * Shield is loaded from a pre-rendered PNG.
 */
export async function loadSeHealthCheckPdfImageAssets(): Promise<SeHealthCheckPdfImageAssets> {
  if (typeof fetch === "undefined") return {};
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
  const out: SeHealthCheckPdfImageAssets = {};

  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      try {
        const url = `${base}/sophos-logo-white.svg`.replace(/([^:])\/{2,}/g, "$1/");
        const res = await fetch(url);
        if (!res.ok) return;
        const svgText = await res.text();
        const dataUrl = await svgToHighResPng(svgText, 600, 65);
        if (dataUrl) out.wordmark = dataUrl;
      } catch {
        /* ignore */
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const url = `${base}/sophos-logo.svg`.replace(/([^:])\/{2,}/g, "$1/");
        const res = await fetch(url);
        if (!res.ok) return;
        const svgText = await res.text();
        const dataUrl = await svgToHighResPng(svgText, 600, 65);
        if (dataUrl) out.wordmarkDark = dataUrl;
      } catch {
        /* ignore */
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const url = `${base}/sophos-icon-white.svg`.replace(/([^:])\/{2,}/g, "$1/");
        const res = await fetch(url);
        if (!res.ok) return;
        const svgText = await res.text();
        const dataUrl = await svgToHighResPng(svgText, 65, 65, 12);
        if (dataUrl) out.shield = dataUrl;
      } catch {
        /* ignore */
      }
    })(),
  );

  await Promise.all(tasks);
  return out;
}

function th(label: string): TableCell {
  return {
    text: label,
    bold: true,
    fontSize: 9,
    color: "#111827",
    font: "ZalandoSans",
  };
}

/** Clean table: bold header, alternating white/light-gray rows, thin dividers, no vertical lines. */
const LAYOUT_TABLE_REPORT: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => "#e5e7eb",
  vLineColor: () => "#e5e7eb",
  paddingLeft: () => 14,
  paddingRight: () => 14,
  paddingTop: () => 10,
  paddingBottom: () => 10,
  fillColor: (rowIndex) => (rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb"),
};

let vfsAttached = false;

function ensurePdfMakeVfs(): void {
  if (vfsAttached) return;
  const pm = pdfMake as typeof pdfMake & { vfs: Record<string, string> };
  pm.vfs = pdfVfs as Record<string, string>;
  vfsAttached = true;
}

/** TTFs vendored under `public/fonts/se-pdf/` (Zalando Sans, SIL OFL — github.com/zalando/sans). */
const SE_PDF_ZALANDO_TTF = [
  "ZalandoSans-Regular.ttf",
  "ZalandoSans-Bold.ttf",
  "ZalandoSans-Italic.ttf",
  "ZalandoSans-BoldItalic.ttf",
  "ZalandoSans-Expanded.ttf",
  "ZalandoSans-ExpandedSemiBold.ttf",
  "ZalandoSans-ExpandedItalic.ttf",
  "ZalandoSans-ExpandedSemiBoldItalic.ttf",
] as const;

let zalandoPdfFontsLoaded = false;

/**
 * Register Zalando Sans + Zalando Sans Expanded in pdfmake vfs (required for embedded fonts).
 * Safe to call multiple times. Returns false without `fetch` or if any TTF is missing (e.g. tests).
 */
export async function loadSeHealthCheckPdfFonts(): Promise<boolean> {
  ensurePdfMakeVfs();
  if (zalandoPdfFontsLoaded) return true;
  if (typeof fetch === "undefined") return false;

  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
  const entries: Record<string, string> = {};

  await Promise.all(
    SE_PDF_ZALANDO_TTF.map(async (name) => {
      try {
        const url = `${base}/fonts/se-pdf/${name}`.replace(/([^:])\/{2,}/g, "$1/");
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        entries[name] = arrayBufferToBase64(buf);
      } catch {
        /* ignore */
      }
    }),
  );

  if (Object.keys(entries).length < SE_PDF_ZALANDO_TTF.length) {
    return false;
  }

  pdfMake.addVirtualFileSystem(entries);
  pdfMake.addFonts({
    ZalandoSans: {
      normal: "ZalandoSans-Regular.ttf",
      bold: "ZalandoSans-Bold.ttf",
      italics: "ZalandoSans-Italic.ttf",
      bolditalics: "ZalandoSans-BoldItalic.ttf",
    },
    ZalandoSansExpanded: {
      normal: "ZalandoSans-Expanded.ttf",
      bold: "ZalandoSans-ExpandedSemiBold.ttf",
      italics: "ZalandoSans-ExpandedItalic.ttf",
      bolditalics: "ZalandoSans-ExpandedSemiBoldItalic.ttf",
    },
  });
  zalandoPdfFontsLoaded = true;
  return true;
}

const SEVERITY_ORDER: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];

function sortedFindings(result: AnalysisResult): Finding[] {
  return [...result.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

function countBySeverity(findings: Finding[]): Record<Finding["severity"], number> {
  const m: Record<Finding["severity"], number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) {
    m[f.severity] = (m[f.severity] ?? 0) + 1;
  }
  return m;
}

function licenceAssumptionLabel(licence: SEHealthCheckReportParams["licence"]): string {
  if (licence.tier === "xstream") return "Xstream Protection";
  if (licence.tier === "standard") return "Standard Protection";
  return "Individual modules";
}

function clipCell(s: string, max = 2500): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Cover + brand (aligned with `se-health-check-pdf-layout` HTML/CSS). */
const COVER_NAVY = "#001A47";
const OVERVIEW_HEADER_NAVY = "#001b44";
const TEAL_ACCENT = "#00F2B3";
const BODY_HEADING = "#001A47";
const BODY_TEXT = "#111827";

function p(text: string, marginBottom = 6): Content {
  return {
    text,
    font: "ZalandoSans",
    fontSize: 10,
    lineHeight: 1.5,
    color: BODY_TEXT,
    margin: [0, 0, 0, marginBottom],
  };
}

/** Paragraph with inline bold segments (matches HTML `<strong>`). */
function pRich(parts: (string | { t: string; b?: boolean })[], marginBottom = 6): Content {
  const text = parts.map((part) =>
    typeof part === "string" ? part : { text: part.t, bold: part.b ?? true, font: "ZalandoSans" },
  );
  return {
    text,
    font: "ZalandoSans",
    fontSize: 10,
    lineHeight: 1.5,
    color: BODY_TEXT,
    margin: [0, 0, 0, marginBottom],
  };
}

function coverMetaLine(
  label: string,
  value: string,
  marginBottom: number,
  fontSize: number,
): Content {
  return {
    text: [
      { text: label, font: "ZalandoSans", bold: true },
      { text: value, font: "ZalandoSans", bold: false },
    ],
    fontSize,
    color: "#ffffff",
    lineHeight: 1.35,
    margin: [0, 0, 0, marginBottom],
  };
}

/** Letter portrait content height ≈ 792 − top/bottom margins; band below header block for centered shield. */
const COVER_SHIELD_ROW_MIN_PT = 420;

function buildCoverPage(
  meta: {
    coverCustomer: string;
    coverPreparedFor: string;
    coverPrepared: string;
    dateLocal: string;
    serialNumbers: string[];
  },
  assets: SeHealthCheckPdfImageAssets,
): Content {
  const { coverCustomer, coverPreparedFor, coverPrepared, dateLocal, serialNumbers } = meta;
  const topBlock: Content[] = [];
  if (assets.wordmark) {
    topBlock.push({
      image: assets.wordmark,
      width: 104,
      alignment: "left",
      margin: [0, 4, 0, 0],
    });
  }
  topBlock.push({
    text: "Sophos Firewall Health Check",
    style: "coverTitle",
    alignment: "left",
    margin: [0, assets.wordmark ? 18 : 56, 0, 14],
  });
  const metaSize = 18;
  topBlock.push(
    coverMetaLine("Customer Name: ", coverCustomer, 5, metaSize),
    coverMetaLine("Prepared For: ", coverPreparedFor, 5, metaSize),
    coverMetaLine("Prepared By: ", coverPrepared, 5, metaSize),
    coverMetaLine(
      "Serial Number: ",
      serialNumbers.length > 0 ? serialNumbers.join(", ") : "—",
      5,
      metaSize,
    ),
    coverMetaLine("Date: ", dateLocal, 0, metaSize),
  );

  const shieldRow = (assets.shield != null
    ? {
        stack: [
          {
            image: assets.shield,
            width: 220,
            alignment: "center" as const,
          },
        ],
        border: [false, false, false, false] as const,
        verticalAlignment: "middle",
      }
    : {
        text: "",
        border: [false, false, false, false] as const,
        verticalAlignment: "middle",
      }) as unknown as TableCell;

  const coverTable: Content = {
    table: {
      widths: ["*"],
      heights: ["auto", COVER_SHIELD_ROW_MIN_PT],
      dontBreakRows: true,
      body: [
        [
          {
            stack: topBlock,
            border: [false, false, false, false],
          },
        ],
        [shieldRow],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };

  return { stack: [coverTable], pageBreak: "after" };
}

/** Navy band + wordmark image + teal title — matches Central-style overview. */
function overviewHeaderBand(assets: SeHealthCheckPdfImageAssets, title: string): Content {
  const top: Content[] = assets.wordmark
    ? [{ image: assets.wordmark, width: 112, alignment: "left", margin: [0, 0, 0, 28] }]
    : [
        {
          text: "SOPHOS",
          font: "ZalandoSansExpanded",
          fontSize: 13,
          bold: true,
          color: "#ffffff",
          margin: [0, 0, 0, 28],
        },
      ];
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              ...top,
              {
                text: title,
                font: "ZalandoSansExpanded",
                fontSize: 20,
                bold: false,
                lineHeight: 1.2,
                color: TEAL_ACCENT,
              },
            ],
            fillColor: OVERVIEW_HEADER_NAVY,
            border: [false, false, false, false],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 48,
      paddingTop: () => 40,
      paddingRight: () => 48,
      paddingBottom: () => 44,
    },
    margin: [-30, -56, -30, 20],
  };
}

/** Section heading starting a new page, with optional wordmark above. */
function h2Section(text: string, wordmarkDark?: string): Content {
  const items: Content[] = [];
  if (wordmarkDark) {
    items.push({ image: wordmarkDark, width: 80, margin: [0, 0, 0, 14] });
  }
  items.push({ text, style: "bodyH2", margin: [0, 0, 0, 10] });
  return { stack: items, pageBreak: "before", margin: [0, 0, 0, 0] };
}

/** Section heading that continues on the same page (no page break). */
function h2Continued(text: string): Content {
  return { text, style: "bodyH2", margin: [0, 20, 0, 10] };
}

function h3(text: string): Content {
  return { text, style: "h3", margin: [0, 10, 0, 6] };
}

function h4(text: string): Content {
  return { text, style: "h4", margin: [0, 8, 0, 4] };
}

/* ------------------------------------------------------------------ */
/*  Licence Selection section                                         */
/* ------------------------------------------------------------------ */

const TIER_CARD_COPY: Record<LicenceSelection["tier"], { title: string; blurb: string }> = {
  standard: {
    title: "Standard Protection",
    blurb: "Network Protection + Web Protection + Enhanced Support",
  },
  xstream: {
    title: "Xstream Protection",
    blurb: "Everything in Standard + Zero-Day + Central Orchestration + DNS Protection",
  },
  individual: {
    title: "Individual Modules",
    blurb: "Select specific modules licensed for this firewall",
  },
};

const TIER_KEYS: LicenceSelection["tier"][] = ["standard", "xstream", "individual"];

function buildLicenceSection(licence: LicenceSelection): Content[] {
  const cardCells: TableCell[] = TIER_KEYS.map((tier) => {
    const selected = tier === licence.tier;
    const c = TIER_CARD_COPY[tier];
    return {
      stack: [
        { text: c.title, font: "ZalandoSans", bold: true, fontSize: 10, color: BODY_TEXT },
        { text: c.blurb, font: "ZalandoSans", fontSize: 8, color: "#6b7280", margin: [0, 3, 0, 0] },
      ],
      fillColor: selected ? "#eef2ff" : "#ffffff",
      border: [true, true, true, true],
      borderColor: selected
        ? ["#4f46e5", "#4f46e5", "#4f46e5", "#4f46e5"]
        : ["#e5e7eb", "#e5e7eb", "#e5e7eb", "#e5e7eb"],
      margin: [0, 0, 0, 0],
    } as TableCell;
  });

  const activeNames = getActiveModules(licence).map((id) => MODULES[id].label);

  return [
    h4("Sophos Licence Selection"),
    {
      table: {
        widths: ["33%", "34%", "33%"],
        body: [cardCells],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => "#e5e7eb",
        vLineColor: () => "#e5e7eb",
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      } as CustomTableLayout,
      margin: [0, 4, 0, 6],
    } as Content,
    {
      text: activeNames.join("   ·   "),
      font: "ZalandoSans",
      fontSize: 8,
      color: "#4f46e5",
      margin: [0, 0, 0, 10],
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Score gauge renderer (Canvas 2D → base64 PNG)                     */
/* ------------------------------------------------------------------ */

const GAUGE_GRADE_COLORS: Record<string, string> = {
  A: "#34d399",
  B: "#34d399",
  C: "#fbbf24",
  D: "#f97316",
  F: "#ef4444",
};

const BP_STATUS_COLORS: Record<string, string> = {
  pass: "#34d399",
  fail: "#ef4444",
  warn: "#f97316",
  na: "#94a3b8",
  unknown: "#94a3b8",
};

function renderScoreGaugePng(score: number, grade: string): string | null {
  if (typeof document === "undefined") return null;
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const lineWidth = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const color = GAUGE_GRADE_COLORS[grade] ?? GAUGE_GRADE_COLORS.C;

  // Track circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(148,163,184,0.2)";
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Score arc (starts at 12 o'clock = -π/2)
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (score / 100) * 2 * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  // Score number
  ctx.fillStyle = color;
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(score), cx, cy - 8);

  // "Grade X" label
  ctx.font = "600 20px sans-serif";
  ctx.fillText(`Grade ${grade}`, cx, cy + 30);

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  Best Practice Score section                                       */
/* ------------------------------------------------------------------ */

function buildBPScoreSection(bp: SophosBPScore): Content[] {
  const gaugeDataUrl = renderScoreGaugePng(bp.overall, bp.grade);

  const statBlock = (count: number, label: string, color: string) => ({
    stack: [
      {
        text: String(count),
        font: "ZalandoSans",
        bold: true,
        fontSize: 20,
        color,
        alignment: "center" as const,
      },
      {
        text: label,
        font: "ZalandoSans",
        fontSize: 8,
        color: "#6b7280",
        alignment: "center" as const,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      },
    ],
    width: "auto" as const,
  });

  const gaugeCol = gaugeDataUrl
    ? {
        image: gaugeDataUrl,
        width: 120,
        alignment: "center" as const,
        margin: [0, 0, 16, 0] as [number, number, number, number],
      }
    : {
        text: `${bp.overall} / Grade ${bp.grade}`,
        font: "ZalandoSans",
        bold: true,
        fontSize: 18,
        width: 120,
      };

  const summaryRow: Content = {
    columns: [
      gaugeCol,
      statBlock(bp.passed, "Passed", "#34d399"),
      statBlock(bp.failed, "Failed", "#ef4444"),
      statBlock(bp.warnings, "Verify", "#f97316"),
      statBlock(bp.notApplicable, "N/A", "#94a3b8"),
    ] as Content[],
    columnGap: 14,
    margin: [0, 4, 0, 10],
  };

  // Expanded per-check listing grouped by category
  const byCat = new Map<string, typeof bp.results>();
  for (const row of bp.results) {
    const cat = row.check.category;
    let arr = byCat.get(cat);
    if (!arr) {
      arr = [];
      byCat.set(cat, arr);
    }
    arr.push(row);
  }

  const checkRows: Content[] = [];
  const BP_PAGE_BREAK_CATEGORIES = new Set(["Visibility & Monitoring", "Zero-Day Protection"]);
  for (const [cat, rows] of byCat) {
    checkRows.push({
      text: cat,
      font: "ZalandoSansExpanded",
      fontSize: 9,
      bold: false,
      color: BODY_HEADING,
      margin: [0, 6, 0, 2],
      ...(BP_PAGE_BREAK_CATEGORIES.has(cat) ? { pageBreak: "before" as const } : {}),
    });
    for (const row of rows) {
      const color = BP_STATUS_COLORS[row.status] ?? "#94a3b8";
      const detailParts: Content[] = [
        {
          text: row.check.title,
          font: "ZalandoSans",
          bold: true,
          fontSize: 8,
          color: BODY_TEXT,
          lineHeight: 1.15,
        },
      ];
      if (row.detail) {
        detailParts.push({
          text: row.detail,
          font: "ZalandoSans",
          fontSize: 7,
          color: "#6b7280",
          lineHeight: 1.15,
          margin: [0, 1, 0, 0],
        });
      }
      if (row.status === "fail" && row.check.recommendation) {
        detailParts.push({
          text: `Sophos recommendation: ${row.check.recommendation}`,
          font: "ZalandoSans",
          fontSize: 7,
          color: "#d97706",
          lineHeight: 1.15,
          margin: [0, 1, 0, 0],
        });
      }
      checkRows.push({
        columns: [
          {
            canvas: [{ type: "ellipse", x: 4, y: 5, r1: 4, r2: 4, color }],
            width: 14,
          },
          { stack: detailParts, width: "*" },
        ] as unknown as Content[],
        columnGap: 4,
        margin: [0, 0, 0, 3],
      });
    }
  }

  return [h4("Sophos Best Practice Score"), summaryRow, ...checkRows];
}

/** Build pdfmake document definition (for tests and createPdf). */
export function buildSeHealthCheckPdfDocDefinition(
  params: SEHealthCheckReportParams,
  assets: SeHealthCheckPdfImageAssets = {},
): TDocumentDefinitions {
  const {
    labels,
    analysisResults,
    baselineResults,
    bpByLabel,
    licence,
    customerName,
    preparedFor: preparedForParam,
    preparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seAckMdrThreatFeeds = false,
    seAckNdrEssentials = false,
    seAckDnsProtection = false,
    seExcludeSecurityHeartbeat = false,
    centralValidated,
    generatedAt,
    appVersion,
    seNotes,
  } = params;

  const dateLocal = generatedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateUtc = generatedAt.toISOString();
  const copyYear = String(generatedAt.getFullYear());

  const coverCustomer = customerName.trim() || "—";
  const coverPreparedFor = (preparedForParam ?? customerName).trim() || "—";
  const coverPrepared = preparedBy.trim() || "—";

  const serialNumbers = params.files
    .map((f) => f.serialNumber?.trim())
    .filter((s): s is string => !!s);

  const coverPage = buildCoverPage(
    {
      coverCustomer,
      coverPreparedFor,
      coverPrepared,
      dateLocal,
      serialNumbers,
    },
    assets,
  );

  const centralCopy = centralValidated
    ? "The Central API was used only for optional firewall discovery in this session. All findings are derived from uploaded configuration exports — not from Central Security Checkup or live telemetry."
    : "Not used. All content is derived from configuration exports only.";

  const overviewBody: Content[] = [
    overviewHeaderBand(assets, "Firewall health check overview"),
    pRich([
      "The ",
      { t: "Sophos Firewall Health Check" },
      " in ",
      { t: "Sophos FireComply" },
      " provides a structured, repeatable review of uploaded Sophos XGS / SFOS configuration exports (HTML or entities XML). The tool parses exported objects and rules, runs deterministic checks aligned with Sophos hardening guidance, and scores posture against a selectable licence tier. Outputs are designed for Sales Engineers and customers to prioritise remediation conversations — not as a pass/fail certification.",
    ]),
    pRich([
      { t: "Executive Summary:" },
      " For every analysed firewall, you will see the Sophos best-practice score and letter grade, baseline template score, counts of findings by severity (critical through info), and a short list of priority next steps derived from the highest-severity items. Use this view for stakeholder conversations and workshop planning.",
    ]),
    pRich([
      { t: "Provenance and limitations:" },
      " Timestamps, tool identity, and explicit limits of offline file analysis. This grounds the report in time and reminds readers that exports may be incomplete, redacted, or from non-production appliances.",
    ]),
    pRich([
      { t: "Assessment scope and exclusions:" },
      " Documents which zones or networks were excluded from DPI (SSL/TLS) gap checks, the web-filter compliance mode (informational vs strict), rule names excluded from missing-web-filter detection, SE acknowledgements for MDR threat feeds or NDR Essentials when those sections are missing from the export, and whether the Security Heartbeat best-practice check was excluded when the customer has no Sophos endpoint estate. These choices materially affect findings — keep them aligned with how the customer actually enforces policy.",
    ]),
    pRich([
      { t: "Baseline and findings:" },
      " Per-device baseline requirements with pass/fail detail, followed by the complete findings table (severity, title, configuration section, and truncated detail with remediation hints where available). This is the working depth behind the executive summary.",
    ]),
    pRich([
      { t: "Licence assumption for scoring:" },
      ` ${licenceAssumptionLabel(licence)}. Module-level scoring uses this assumption; if the customer's entitlement differs, reinterpret scores accordingly. `,
      { t: "Sophos Central data in this report:" },
      ` ${centralCopy}`,
    ]),
    pRich([
      { t: "Severity labels." },
      " ",
      { t: "Critical" },
      " and ",
      { t: "high" },
      " items typically indicate exposure or misconfiguration that should be addressed urgently. ",
      { t: "Medium" },
      " and ",
      { t: "low" },
      " reflect hardening gaps or policy drift. ",
      { t: "Info" },
      " highlights context or verification steps. Titles and remediation text are indicative — validate impact for the customer's topology and change controls.",
    ]),
  ];

  const provenance: Content[] = [
    h2Section("Provenance and limitations", assets.wordmarkDark),
    p(`Generated: ${dateUtc} (UTC) / ${dateLocal} (local)`),
    p(`Tool: Sophos FireComply — SE Firewall Health Check${appVersion ? ` (${appVersion})` : ""}.`),
    p(
      "This assessment is point in time and based solely on the configuration files supplied. It is not a penetration test. Completeness depends on export quality and parser coverage. Validate critical items in the live Sophos XGS / SFOS console before making architectural or contractual commitments.",
    ),
  ];

  const scope: Content[] = [
    h2Continued("Assessment scope and exclusions"),
    h3("DPI (SSL/TLS inspection) exclusions"),
    ...(dpiExemptZones.length === 0 && dpiExemptNetworks.length === 0
      ? [p("None selected.")]
      : [
          ...(dpiExemptZones.length > 0 ? [p(`Zones: ${dpiExemptZones.join(", ")}`)] : []),
          ...(dpiExemptNetworks.length > 0
            ? [p(`Source networks: ${dpiExemptNetworks.join(", ")}`)]
            : []),
        ]),
    h3("Active threat response (SE acknowledgement)"),
    p(
      `MDR threat feeds configured (export gap): ${seAckMdrThreatFeeds ? "Yes — SE confirmed on appliance" : "No"}`,
    ),
    p(
      `NDR Essentials enabled (export gap): ${seAckNdrEssentials ? "Yes — SE confirmed on appliance" : "No"}`,
    ),
    p(
      `DNS Protection configured (export gap): ${seAckDnsProtection ? "Yes — SE confirmed on appliance" : "No"}`,
    ),
    h3("Synchronized Security scope"),
    p(
      `Security Heartbeat check excluded (no Sophos endpoints): ${seExcludeSecurityHeartbeat ? "Yes" : "No"}`,
    ),
    h3("Web filter compliance"),
    p(`Mode: ${webFilterComplianceMode === "informational" ? "Informational" : "Strict"}`),
    p(
      webFilterExemptRuleNames.length === 0
        ? "Rule names excluded from missing-web-filter check: None."
        : `Rule names excluded from missing-web-filter check: ${webFilterExemptRuleNames.join(", ")}`,
    ),
  ];

  const executive: Content[] = [h2Section("Executive Summary", assets.wordmarkDark)];
  for (const label of labels) {
    const ar = analysisResults[label];
    const bp = bpByLabel[label];
    const bl = baselineResults[label];
    if (!ar || !bp || !bl) continue;

    const host = ar.hostname?.trim();
    executive.push(
      h3(`${label}${host ? ` — ${host}` : ""}`),
      ...buildLicenceSection(licence),
      ...buildBPScoreSection(bp),
      p(`Baseline alignment (${bl.template.name}): ${bl.score}%`),
    );

    const counts = countBySeverity(ar.findings);
    const countRow = SEVERITY_ORDER.map((sev) => String(counts[sev]));
    executive.push(h4("Finding counts by severity"), {
      table: {
        headerRows: 1,
        widths: ["20%", "20%", "20%", "20%", "20%"],
        body: [SEVERITY_ORDER.map((s) => th(s)), countRow],
      },
      layout: LAYOUT_TABLE_REPORT,
      margin: [0, 0, 0, 8],
    });

    const top = sortedFindings(ar)
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, 5);
    if (top.length > 0) {
      executive.push({
        text: `Priority next steps (top ${top.length} critical/high):`,
        font: "ZalandoSans",
        bold: true,
        margin: [0, 6, 0, 4],
      });
      executive.push({
        ul: top.map((f) => ({
          text: [
            { text: f.title, bold: true },
            f.remediation ? ` — ${clipCell(f.remediation, 800)}` : "",
          ],
        })),
        margin: [0, 0, 0, 8],
      });
    }
  }

  const seNotesBlock: Content[] = [];
  if (seNotes?.trim()) {
    seNotesBlock.push(h2Section("SE Engineer Notes", assets.wordmarkDark), {
      text: seNotes.trim(),
      style: "body",
      margin: [0, 0, 0, 10],
    });
  }

  const baselineFindingsBlocks: Content[] = [];
  labels.forEach((label, fwIndex) => {
    const ar = analysisResults[label];
    const bl = baselineResults[label];
    if (!ar || !bl) return;

    baselineFindingsBlocks.push(
      h2Section(`${label} — Baseline and findings`, assets.wordmarkDark),
      h3("Baseline checklist"),
      {
        table: {
          headerRows: 1,
          widths: ["10%", "32%", "58%"],
          body: [
            [th("Met"), th("Requirement"), th("Detail")],
            ...bl.requirements.map((req) => [
              req.met ? "Yes" : "No",
              clipCell(req.label, 400),
              clipCell(req.detail, 1200),
            ]),
          ],
        },
        layout: LAYOUT_TABLE_REPORT,
        margin: [0, 0, 0, 10],
      },
    );

    baselineFindingsBlocks.push({
      text: `Findings (${ar.findings.length})`,
      style: "h3",
      margin: [0, 10, 0, 6],
      pageBreak: "before",
    });
    if (ar.findings.length === 0) {
      baselineFindingsBlocks.push(p("No findings recorded."));
    } else {
      baselineFindingsBlocks.push({
        table: {
          headerRows: 1,
          widths: ["14%", "22%", "18%", "46%"],
          body: [
            [th("Severity"), th("Title"), th("Section"), th("Detail")],
            ...sortedFindings(ar).map((f) => [
              f.severity,
              clipCell(f.title, 500),
              clipCell(f.section, 200),
              clipCell(f.detail, 2200),
            ]),
          ],
        },
        layout: LAYOUT_TABLE_REPORT,
        margin: [0, 0, 0, 8],
      });
    }
  });

  const footerNote: Content = {
    text: "Generated by Sophos FireComply. Sophos and related marks are trademarks of Sophos Limited.",
    font: "ZalandoSans",
    fontSize: 8,
    color: "#666666",
    margin: [0, 16, 0, 0],
  };

  const content: Content[] = [
    coverPage,
    ...overviewBody,
    ...provenance,
    ...scope,
    ...executive,
    ...seNotesBlock,
    ...baselineFindingsBlocks,
    footerNote,
  ];

  return {
    pageMargins: [30, 56, 30, 56],
    defaultStyle: {
      font: "ZalandoSans",
      fontSize: 10,
      lineHeight: 1.5,
      color: BODY_TEXT,
    },
    styles: {
      coverTitle: {
        font: "ZalandoSansExpanded",
        fontSize: 28,
        bold: true,
        lineHeight: 1.2,
        color: "#ffffff",
      },
      bodyH2: {
        font: "ZalandoSansExpanded",
        fontSize: 18,
        bold: false,
        lineHeight: 1.2,
        color: BODY_HEADING,
        decoration: "underline",
        decorationColor: BODY_HEADING,
        decorationThickness: 0.5,
      },
      h3: {
        font: "ZalandoSansExpanded",
        fontSize: 12.5,
        bold: false,
        lineHeight: 1.2,
        color: BODY_HEADING,
      },
      h4: {
        font: "ZalandoSansExpanded",
        fontSize: 10,
        bold: false,
        lineHeight: 1.2,
        color: "#374151",
      },
    },
    background(currentPage, pageSize) {
      if (currentPage !== 1) return undefined;
      return [
        {
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: pageSize.width,
              h: pageSize.height,
              color: COVER_NAVY,
            },
          ],
        },
      ];
    },
    header() {
      return { text: "", margin: [0, 0, 0, 0] };
    },
    footer(currentPage) {
      if (currentPage !== 1) return { text: "", margin: [0, 0, 0, 0] };
      return {
        stack: [
          {
            text: `© Copyright ${copyYear}, Sophos Ltd. All Rights Reserved`,
            font: "ZalandoSans",
            fontSize: 7,
            color: "#e8e8e8",
            alignment: "center",
          },
          {
            text: "CONFIDENTIAL",
            font: "ZalandoSans",
            fontSize: 8,
            bold: true,
            alignment: "center",
            color: "#ffffff",
            margin: [0, 3, 0, 0],
          },
        ],
        margin: [30, 0, 30, 10],
      };
    },
    content,
  };
}

/** Generate PDF blob in the browser (initialises vfs fonts once). */
export async function buildSeHealthCheckPdfBlob(params: SEHealthCheckReportParams): Promise<Blob> {
  ensurePdfMakeVfs();
  const fontsOk = await loadSeHealthCheckPdfFonts();
  if (!fontsOk) {
    throw new Error(
      "SE Health Check PDF: Zalando font files are missing or unreachable. Expected TTFs under /fonts/se-pdf/.",
    );
  }
  const assets = await loadSeHealthCheckPdfImageAssets();
  const docDefinition = buildSeHealthCheckPdfDocDefinition(params, assets);
  const pdf = pdfMake.createPdf(docDefinition);
  // pdfmake 0.3+: getBlob() returns Promise<Blob> (callback form is not used).
  return pdf.getBlob();
}
