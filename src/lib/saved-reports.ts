import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AnalysisResult } from "./analyse-config";
import { computeRiskScore } from "./risk-score";

export interface SavedReportEntry {
  id: string;
  label: string;
  markdown: string;
}

export interface AnalysisSummary {
  totalFindings: number;
  overallScore: number;
  overallGrade: string;
  categories: { label: string; pct: number }[];
  totalRules: number;
  /** Assessment labels / hostnames at save time (for Report Centre and pre-AI viewer). */
  firewallLabels?: string[];
}

export interface SavedReportPackage {
  id: string;
  customerName: string;
  environment: string;
  reportType: "full" | "pre-ai";
  reports: SavedReportEntry[];
  analysisSummary: AnalysisSummary;
  createdAt: number;
  createdBy?: string | null;
}

function buildAnalysisSummary(analysisResults: Record<string, AnalysisResult>): AnalysisSummary {
  const allFindings = Object.values(analysisResults).flatMap((r) => r.findings);
  const scores = Object.values(analysisResults).map((r) => computeRiskScore(r));
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length) : 0;
  const grade =
    avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 40 ? "D" : "F";
  const totalRules = Object.values(analysisResults).reduce((s, r) => s + r.stats.totalRules, 0);

  const catMap = new Map<string, number[]>();
  for (const s of scores) {
    for (const c of s.categories) {
      if (!catMap.has(c.label)) catMap.set(c.label, []);
      catMap.get(c.label)!.push(c.pct);
    }
  }
  const categories = [...catMap.entries()].map(([label, vals]) => ({
    label,
    pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));

  const firewallLabels = Object.entries(analysisResults).map(([key, r]) => {
    const h = (r.hostname || "").trim();
    return h || key;
  });

  return {
    totalFindings: allFindings.length,
    overallScore: avgScore,
    overallGrade: grade,
    categories,
    totalRules,
    firewallLabels: firewallLabels.length > 0 ? firewallLabels : undefined,
  };
}

/** Normalise JSONB `reports` from Supabase (handles null / wrong shape). */
export function normalizeReportEntries(raw: unknown): SavedReportEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is SavedReportEntry =>
      x != null && typeof x === "object" && typeof (x as SavedReportEntry).id === "string",
  );
}

/** HTML-safe id for in-page scroll targets (saved report viewer). */
export function savedReportJumpTargetId(entryId: string): string {
  const safe = entryId
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `saved-doc-${safe || "report"}`;
}

/** Strip leading emoji / icon noise from report tab labels for firewall column. */
function displayLabelForSavedTechnicalReport(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "").trim() || label;
}

/** Firewalls column: prefer analysis_summary; fall back to technical report labels in the package. */
export function formatFirewallSummaryFromPackage(pkg: SavedReportPackage): string {
  const fromSummary = pkg.analysisSummary?.firewallLabels?.filter(Boolean) ?? [];
  if (fromSummary.length > 0) {
    if (fromSummary.length <= 2) return fromSummary.join(", ");
    return `${fromSummary.length} firewalls`;
  }
  const reps = normalizeReportEntries(pkg.reports);
  const techLabels = reps
    .filter(
      (r) =>
        r.id !== "report-compliance" &&
        r.id !== "report-executive" &&
        r.id !== "report-executive-one-pager",
    )
    .map((r) => displayLabelForSavedTechnicalReport(r.label))
    .filter(Boolean);
  if (techLabels.length === 0) return "—";
  if (techLabels.length <= 2) return techLabels.join(", ");
  return `${techLabels.length} firewalls`;
}

/** Short cell text for Report Centre “firewalls” column (summary only — prefer formatFirewallSummaryFromPackage). */
export function formatFirewallSummaryForRow(summary: AnalysisSummary | undefined): string {
  const labels = summary?.firewallLabels?.filter(Boolean) ?? [];
  if (labels.length === 0) return "—";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} firewalls`;
}

/** Merge saved report bodies with jump anchors so the viewer can scroll to each document. */
export function packageReportsToMarkdown(reports: SavedReportEntry[]): string {
  const reps = normalizeReportEntries(reports);
  if (reps.length === 0) return "";
  return reps
    .map((r) => {
      const jid = savedReportJumpTargetId(r.id);
      return `<div id="${jid}" class="saved-report-jump-target scroll-mt-28" aria-hidden="true"></div>\n\n## ${r.label}\n\n${r.markdown}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Primary nav pills: Technical (→ first per-firewall doc), Executive, Compliance — canonical order.
 */
export function buildSavedPackNavItems(
  reps: SavedReportEntry[],
): { domId: string; shortTitle: string }[] {
  const list = normalizeReportEntries(reps);
  if (list.length === 0) return [];

  const tech = list.filter(
    (r) =>
      r.id !== "report-compliance" &&
      r.id !== "report-executive" &&
      r.id !== "report-executive-one-pager",
  );
  const execFull = list.find((r) => r.id === "report-executive");
  const onePager = list.find((r) => r.id === "report-executive-one-pager");
  const comp = list.find((r) => r.id === "report-compliance");

  const out: { domId: string; shortTitle: string }[] = [];
  if (tech.length > 0) {
    out.push({
      domId: savedReportJumpTargetId(tech[0].id),
      shortTitle: tech.length === 1 ? "Technical" : `Technical (${tech.length})`,
    });
  }
  const execEntry = execFull ?? onePager;
  if (execEntry) {
    out.push({ domId: savedReportJumpTargetId(execEntry.id), shortTitle: "Executive" });
  }
  if (comp) {
    out.push({ domId: savedReportJumpTargetId(comp.id), shortTitle: "Compliance" });
  }
  return out;
}

/** Human-readable pack description from stored report entries. */
export function describeSavedReportRowType(pkg: SavedReportPackage): string {
  const reps = normalizeReportEntries(pkg.reports);
  if (reps.length === 0) {
    return pkg.reportType === "pre-ai" ? "Pre-AI assessment" : "No AI documents in save";
  }
  const tech = reps.filter((r) => {
    const id = r.id;
    if (
      id === "report-executive" ||
      id === "report-executive-one-pager" ||
      id === "report-compliance"
    ) {
      return false;
    }
    return id.startsWith("report-");
  }).length;
  const hasExecFull = reps.some((r) => r.id === "report-executive");
  const hasOnePager = reps.some((r) => r.id === "report-executive-one-pager");
  const hasComp = reps.some((r) => r.id === "report-compliance");
  const parts: string[] = [];
  if (tech > 0) parts.push(tech === 1 ? "Technical" : `${tech}× technical`);
  if (hasExecFull) parts.push("Executive");
  else if (hasOnePager) parts.push("One-pager");
  if (hasComp) parts.push("Compliance");
  return parts.join(" · ") || `${reps.length} document(s)`;
}

// ── Cloud (Supabase) ──

export async function saveReportCloud(
  orgId: string,
  customerName: string,
  environment: string,
  reports: SavedReportEntry[],
  analysisResults: Record<string, AnalysisResult>,
): Promise<SavedReportPackage | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const reportType: "full" | "pre-ai" = reports.length > 0 ? "full" : "pre-ai";
  const analysisSummary = buildAnalysisSummary(analysisResults);

  const { data, error } = await supabase
    .from("saved_reports")
    .insert({
      org_id: orgId,
      created_by: user.user.id,
      customer_name: customerName || "Unnamed",
      environment: environment || "",
      report_type: reportType,
      reports: reports as unknown as Json,
      analysis_summary: analysisSummary as unknown as Json,
    })
    .select("id, created_at")
    .single();

  if (error || !data) return null;

  const result = {
    id: data.id,
    customerName: customerName || "Unnamed",
    environment: environment || "",
    reportType,
    reports,
    analysisSummary,
    createdAt: new Date(data.created_at).getTime(),
    createdBy: user.user.id,
  };

  // Notify org webhook if configured (fire-and-forget)
  void Promise.resolve(
    supabase.from("organisations").select("webhook_url, webhook_secret").eq("id", orgId).single(),
  )
    .then(async ({ data: org }) => {
      const url = (org as { webhook_url?: string; webhook_secret?: string } | null)?.webhook_url;
      if (!url?.trim()) return;
      const payload = {
        event: "report.saved",
        org_id: orgId,
        customer_name: customerName || "Unnamed",
        environment: environment || "",
        report_count: reports.length,
        saved_at: new Date().toISOString(),
        package_id: data.id,
      };
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Sophos-FireComply-Webhook/1",
      };
      const secret = (org as { webhook_secret?: string }).webhook_secret;
      if (secret?.trim()) {
        try {
          const enc = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw",
            enc.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
          headers["X-Webhook-Signature"] = Array.from(new Uint8Array(sig))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        } catch {
          // Skip signature on error
        }
      }
      fetch(url, { method: "POST", headers, body }).catch((err) =>
        console.warn("[saved-reports] webhook failed", err),
      );
    })
    .catch(() => {});

  return result;
}

export async function loadSavedReportsCloud(): Promise<SavedReportPackage[]> {
  const { data, error } = await supabase
    .from("saved_reports")
    .select(
      "id, customer_name, environment, report_type, reports, analysis_summary, created_at, created_by",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    environment: row.environment,
    reportType: row.report_type as "full" | "pre-ai",
    reports: normalizeReportEntries(row.reports),
    analysisSummary: (row.analysis_summary || {}) as unknown as AnalysisSummary,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by,
  }));
}

/** Single package by id (RLS: org members only). Used by Report Centre “open saved report”. */
export async function loadSavedReportPackageById(id: string): Promise<SavedReportPackage | null> {
  const { data, error } = await supabase
    .from("saved_reports")
    .select(
      "id, customer_name, environment, report_type, reports, analysis_summary, created_at, created_by",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    customerName: data.customer_name,
    environment: data.environment,
    reportType: data.report_type as "full" | "pre-ai",
    reports: normalizeReportEntries(data.reports),
    analysisSummary: (data.analysis_summary || {}) as unknown as AnalysisSummary,
    createdAt: new Date(data.created_at).getTime(),
    createdBy: data.created_by,
  };
}

export async function deleteSavedReportCloud(id: string): Promise<void> {
  await supabase.from("saved_reports").delete().eq("id", id);
}

// ── Local (IndexedDB) ──

const LOCAL_DB_NAME = "sophos-firecomply";
const LOCAL_STORE = "saved_reports";
const LOCAL_DB_VERSION = 2;

function openLocalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("assessments")) {
        const store = db.createObjectStore("assessments", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("customerName", "customerName", { unique: false });
      }
      if (!db.objectStoreNames.contains(LOCAL_STORE)) {
        const store = db.createObjectStore(LOCAL_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("customerName", "customerName", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReportLocal(
  customerName: string,
  environment: string,
  reports: SavedReportEntry[],
  analysisResults: Record<string, AnalysisResult>,
): Promise<SavedReportPackage> {
  const reportType: "full" | "pre-ai" = reports.length > 0 ? "full" : "pre-ai";
  const analysisSummary = buildAnalysisSummary(analysisResults);
  const pkg: SavedReportPackage = {
    id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    customerName: customerName || "Unnamed",
    environment: environment || "",
    reportType,
    reports,
    analysisSummary,
    createdAt: Date.now(),
  };

  const db = await openLocalDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).put(pkg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return pkg;
}

export async function loadSavedReportsLocal(): Promise<SavedReportPackage[]> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readonly");
    const req = tx.objectStore(LOCAL_STORE).index("createdAt").getAll();
    req.onsuccess = () => resolve((req.result as SavedReportPackage[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSavedReportLocal(id: string): Promise<void> {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
