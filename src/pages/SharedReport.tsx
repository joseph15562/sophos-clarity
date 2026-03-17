import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { loadSharedReport, type SharedReport as SharedReportType } from "@/lib/share-report";
import { extractTocHeadings, buildReportHtml } from "@/lib/report-html";

const SharedReport = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportType | null | undefined>(undefined);
  const [tocOpen, setTocOpen] = useState(true);

  useEffect(() => {
    if (!token) { setReport(null); return; }
    let cancelled = false;
    loadSharedReport(token).then((r) => { if (!cancelled) setReport(r); });
    return () => { cancelled = true; };
  }, [token]);

  // Hooks must run unconditionally (before any early return) to avoid React error #310
  const markdown = report?.markdown ?? "";
  const html = useMemo(() => buildReportHtml(markdown), [markdown]);
  const headings = useMemo(() => extractTocHeadings(markdown), [markdown]);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Invalid link</h1>
          <p className="text-muted-foreground">This share link is invalid. Please request a new link from the report owner.</p>
          <a href="/" className="text-[#2006F7] dark:text-[#00EDFF] hover:underline font-medium">
            Return to Sophos FireComply
          </a>
        </div>
      </div>
    );
  }

  if (report === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Loading report…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">This report has expired</h1>
          <p className="text-muted-foreground">
            Shared reports are available for 7 days. Please request a new link from the report owner.
          </p>
          <a href="/" className="text-[#2006F7] dark:text-[#00EDFF] hover:underline font-medium">
            Return to Sophos FireComply
          </a>
        </div>
      </div>
    );
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Same document shell as MSP report layout */}
      <div className="max-w-4xl mx-auto rounded-xl border border-border shadow-sm overflow-hidden my-6">
        <div className="bg-[#001A47] dark:bg-[#000d24] px-6 md:px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5 opacity-60" />
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">
              Sophos FireComply — Firewall Configuration Assessment
            </span>
          </div>
          <span className="text-[10px] text-white/40">
            {report.customerName && `${report.customerName} · `}
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {" · Expires "}
            {new Date(report.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="bg-card p-8 md:p-12">
          <div className="mb-6 pb-6 border-b-2 border-[#2006F7]/20 dark:border-[#2006F7]/30">
            <p className="text-sm text-muted-foreground">Results should be validated by a qualified security professional.</p>
            {report.customerName && (
              <p className="text-lg font-display font-bold text-foreground mt-1">{report.customerName}</p>
            )}
            <p className="text-sm font-semibold text-foreground mt-1">Firewall Configuration Assessment Report</p>
          </div>

          {headings.length >= 3 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setTocOpen(!tocOpen)}
                className="text-xs font-semibold text-[#2006F7] dark:text-[#009CFB] hover:underline flex items-center gap-1.5"
              >
                <img src="/icons/sophos-document.svg" alt="" className="h-3.5 w-3.5 sophos-icon" />
                {tocOpen ? "Hide" : "Show"} Table of Contents ({headings.length} sections)
              </button>
              {tocOpen && (
                <nav className="mt-2 rounded-lg border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto space-y-0.5">
                  {headings.map((h, i) => (
                    <button
                      key={`${h.id}-${i}`}
                      type="button"
                      onClick={() => scrollTo(h.id)}
                      className={`block w-full text-left text-xs hover:text-[#2006F7] dark:hover:text-[#009CFB] transition-colors truncate cursor-pointer ${
                        h.level === 2 ? "font-semibold text-foreground py-1" : "text-muted-foreground pl-4 py-0.5"
                      }`}
                    >
                      {h.text}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          )}

          <div className="prose prose-slate dark:prose-invert max-w-none report-content" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
};

export default SharedReport;
