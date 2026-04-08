/** Top-level management drawer tabs (matches ManagementDrawer TabId). */
export const MANAGE_PANEL_TABS = ["dashboard", "reports", "history", "settings"] as const;
export type ManagePanelTab = (typeof MANAGE_PANEL_TABS)[number];

/** Settings accordion slugs (matches ManagementDrawer section ids). */
export const MANAGE_SETTINGS_SECTIONS = [
  "branding",
  "central",
  "agents",
  "team",
  "portal",
  "security",
  "audit",
  "alerts",
  "webhooks",
  "scheduled-reports",
  "report-template",
  "api-docs",
  "data-governance",
  "partner-automation",
  "regulatory-digest",
] as const;
export type ManageSettingsSection = (typeof MANAGE_SETTINGS_SECTIONS)[number];

/** Settings sections that require org admin (`canManageTeam`). Align with ManagementDrawer. */
export const ADMIN_ONLY_MANAGE_SETTINGS_SECTIONS: readonly ManageSettingsSection[] = [
  "branding",
  "team",
  "portal",
  "webhooks",
  "report-template",
  "partner-automation",
] as const;

const ADMIN_ONLY_SETTINGS_SET = new Set<string>(ADMIN_ONLY_MANAGE_SETTINGS_SECTIONS);

/** Mirrors ManagementDrawer: who may auto-expand a settings section from a deep link. */
export function settingsSectionExpandAllowed(
  sectionId: string,
  opts: { canManageTeam: boolean; isViewerOnly: boolean; localMode: boolean },
): boolean {
  if (opts.localMode && (sectionId === "central" || sectionId === "agents")) return false;
  if (opts.isViewerOnly && sectionId === "agents") return false;
  if (ADMIN_ONLY_SETTINGS_SET.has(sectionId) && !opts.canManageTeam) return false;
  return true;
}

/** @deprecated Prefer settingsSectionExpandAllowed with full auth context */
export function settingsSectionBlockedForViewer(section: string | undefined): boolean {
  if (!section) return false;
  if (section === "agents") return true;
  return (ADMIN_ONLY_MANAGE_SETTINGS_SECTIONS as readonly string[]).includes(section);
}

export function isManagePanelTab(s: string | null | undefined): s is ManagePanelTab {
  return !!s && (MANAGE_PANEL_TABS as readonly string[]).includes(s);
}

export function isManageSettingsSection(s: string | null | undefined): s is ManageSettingsSection {
  return !!s && (MANAGE_SETTINGS_SECTIONS as readonly string[]).includes(s);
}

const QUERY_PANEL = "panel";
const QUERY_SECTION = "section";

/** Build search string for `/?panel=…&section=…` (section only when panel is settings). */
export function buildManagePanelSearch(opts: {
  panel: ManagePanelTab;
  section?: ManageSettingsSection;
}): string {
  const p = new URLSearchParams();
  p.set(QUERY_PANEL, opts.panel);
  if (opts.panel === "settings" && opts.section) {
    p.set(QUERY_SECTION, opts.section);
  }
  return p.toString();
}

/** Read and consume panel/section from URLSearchParams; returns null if nothing to apply. */
export function readManagePanelParams(searchParams: URLSearchParams): {
  panel: ManagePanelTab;
  section?: ManageSettingsSection;
} | null {
  const panelRaw = searchParams.get(QUERY_PANEL)?.trim().toLowerCase();
  if (!panelRaw || !isManagePanelTab(panelRaw)) return null;
  const sectionRaw = searchParams.get(QUERY_SECTION)?.trim().toLowerCase();
  const section =
    panelRaw === "settings" && sectionRaw && isManageSettingsSection(sectionRaw)
      ? sectionRaw
      : undefined;
  return { panel: panelRaw, section };
}

export function stripManagePanelParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(QUERY_PANEL);
  next.delete(QUERY_SECTION);
  return next;
}

/** Merge panel/section into existing query (keeps other params). Used when opening workspace controls from hub routes without leaving the page. */
export function mergeManagePanelIntoCurrentSearch(
  current: URLSearchParams,
  opts: { panel: ManagePanelTab; section?: ManageSettingsSection },
): string {
  const next = new URLSearchParams(current);
  next.set(QUERY_PANEL, opts.panel);
  if (opts.panel === "settings" && opts.section) {
    next.set(QUERY_SECTION, opts.section);
  } else {
    next.delete(QUERY_SECTION);
  }
  return next.toString();
}
