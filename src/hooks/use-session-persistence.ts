import { useEffect, useRef } from "react";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ReportEntry } from "@/components/DocumentPreview";

const STORAGE_KEY = "sophos-firecomply-session";
const DEBOUNCE_MS = 500;

interface PersistedSession {
  branding: Omit<BrandingData, "logoUrl">;
  reports: ReportEntry[];
  activeReportId: string;
  savedAt: number;
}

export function saveSession(
  branding: BrandingData,
  reports: ReportEntry[],
  activeReportId: string,
) {
  const { logoUrl: _logo, ...brandingWithoutLogo } = branding;
  const data: PersistedSession = {
    branding: brandingWithoutLogo,
    reports: reports.map((r) => ({
      id: r.id,
      label: r.label,
      markdown: r.markdown,
    })),
    activeReportId,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[saveSession]", err);
  }
}

export function loadSession(): {
  branding: BrandingData;
  reports: ReportEntry[];
  activeReportId: string;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: PersistedSession = JSON.parse(raw);

    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - data.savedAt > maxAge) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (!data.reports?.length) return null;

    return {
      branding: { ...data.branding, logoUrl: null },
      reports: data.reports,
      activeReportId: data.activeReportId || data.reports[0]?.id || "",
    };
  } catch (err) {
    console.warn("[loadSession]", err);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAutoSave(
  branding: BrandingData,
  reports: ReportEntry[],
  activeReportId: string,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (reports.length === 0) return;
    const hasContent = reports.some((r) => r.markdown);
    if (!hasContent) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveSession(branding, reports, activeReportId);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [branding, reports, activeReportId]);
}
