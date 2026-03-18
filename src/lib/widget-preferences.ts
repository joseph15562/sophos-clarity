const STORAGE_KEY = "firecomply_widget_preferences";

export interface WidgetDef {
  id: string;
  label: string;
  tab: "overview" | "security" | "compliance" | "optimisation" | "tools" | "remediation";
  isDefault: boolean;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  // ── Overview ──
  { id: "quick-actions",        label: "Quick Actions",           tab: "overview",      isDefault: false },
  { id: "findings-by-age",      label: "Findings by Age",         tab: "overview",      isDefault: false },
  { id: "sla-compliance-gauge", label: "SLA Compliance Gauge",    tab: "overview",      isDefault: false },
  { id: "remediation-velocity", label: "Remediation Velocity",    tab: "overview",      isDefault: false },
  { id: "alert-feed",           label: "Alert Feed",              tab: "overview",      isDefault: false },
  { id: "assessment-countdown", label: "Assessment Countdown",    tab: "overview",      isDefault: false },
  { id: "mdr-status",           label: "MDR Status",              tab: "overview",      isDefault: false },
  { id: "firmware-tracker",     label: "Firmware Tracker",        tab: "overview",      isDefault: false },

  // ── Security ──
  { id: "category-score-bars",  label: "Category Score Bars",     tab: "security",      isDefault: false },
  { id: "coverage-matrix",      label: "Coverage Matrix",         tab: "security",      isDefault: false },
  { id: "category-trends",      label: "Category Trends",         tab: "security",      isDefault: false },
  { id: "risk-distribution",    label: "Risk Distribution",       tab: "security",      isDefault: false },
  { id: "encryption-overview",  label: "Encryption Overview",     tab: "security",      isDefault: false },
  { id: "admin-exposure-map",   label: "Admin Exposure Map",      tab: "security",      isDefault: false },
  { id: "vpn-security-summary", label: "VPN Security Summary",    tab: "security",      isDefault: false },
  { id: "network-zone-map",     label: "Network Zone Security",   tab: "security",      isDefault: false },
  { id: "protocol-service-usage",label: "Protocol & Service Usage", tab: "security",     isDefault: false },
  { id: "rule-action-dist",     label: "Rule Action Distribution",tab: "security",      isDefault: false },
  { id: "finding-heatmap-time", label: "Finding Heatmap",         tab: "security",      isDefault: false },
  { id: "threat-feed-timeline", label: "Threat Feed Timeline",    tab: "security",      isDefault: false },

  // ── Compliance ──
  { id: "compliance-summary",       label: "Compliance Summary (Posture & Coverage)", tab: "compliance", isDefault: false },
  { id: "compliance-gaps",           label: "Compliance Gaps & Control Map",           tab: "compliance", isDefault: false },
  { id: "evidence-collection",      label: "Evidence Collection",      tab: "compliance", isDefault: false },
  { id: "compliance-calendar",      label: "Compliance Calendar",      tab: "compliance", isDefault: false },
  { id: "attestation-workflow",     label: "Attestation Workflow",     tab: "compliance", isDefault: false },
  { id: "regulatory-tracker",       label: "Regulatory Tracker",       tab: "compliance", isDefault: false },

  // ── Optimisation ──
  { id: "config-complexity",    label: "Config & Policy Complexity", tab: "optimisation", isDefault: false },
  { id: "unused-objects",       label: "Unused Objects",          tab: "optimisation",  isDefault: false },
  { id: "rule-analysis",        label: "Rule Consolidation & Overlap", tab: "optimisation", isDefault: false },

  // ── Tools ──
  { id: "what-if-comparison",     label: "What-If Comparison",       tab: "tools",     isDefault: false },
  { id: "risk-roi",               label: "Risk & ROI Analysis",      tab: "tools",     isDefault: false },
  { id: "export-centre",          label: "Export Centre",             tab: "tools",     isDefault: false },
  { id: "geographic-fleet-map",   label: "Geographic Fleet Map",     tab: "tools",     isDefault: false },
  { id: "baseline-manager",       label: "Baseline Manager",         tab: "tools",     isDefault: false },
  { id: "compare-to-baseline",    label: "Compare to Saved Baseline", tab: "tools",   isDefault: true },
  { id: "findings-bulk",          label: "Findings bulk actions",     tab: "remediation", isDefault: false },

  // ── Remediation ──
  { id: "remediation-progress", label: "Remediation Progress",    tab: "remediation",   isDefault: false },
  { id: "remediation-roadmap",  label: "Remediation Roadmap",     tab: "remediation",   isDefault: false },
  { id: "fix-effort-breakdown", label: "Fix Effort Breakdown",    tab: "remediation",   isDefault: false },
  { id: "impact-effort-bubble", label: "Impact vs Effort Bubble", tab: "remediation",   isDefault: false },
];

export type WidgetPreferences = Record<string, boolean>;

export function loadWidgetPreferences(): WidgetPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WidgetPreferences;
  } catch { /* ignore */ }
  return {};
}

export function saveWidgetPreferences(prefs: WidgetPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export function isWidgetVisible(prefs: WidgetPreferences, id: string): boolean {
  if (id in prefs) return prefs[id];
  const def = WIDGET_REGISTRY.find((w) => w.id === id);
  return def?.isDefault ?? false;
}

export function getWidgetsForTab(tab: string): WidgetDef[] {
  return WIDGET_REGISTRY.filter((w) => w.tab === tab);
}

export function getEnabledCount(prefs: WidgetPreferences, tab: string): number {
  return getWidgetsForTab(tab).filter((w) => isWidgetVisible(prefs, w.id)).length;
}
