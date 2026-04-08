import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { saveAs } from "file-saver";
import { FileText, Download } from "lucide-react";
import { loadSharedReport, type SharedReport as SharedReportType } from "@/lib/share-report";
import { extractTocHeadings, buildReportHtml } from "@/lib/report-html";
import { buildPdfHtml, generateWordBlob, openHtmlForPrint } from "@/lib/report-export";
import { sanitizePdfFilenamePart } from "@/lib/pdf-utils";
import type { BrandingData } from "@/components/BrandingSetup";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/SafeHtml";

const SharedReport = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportType | null | undefined>(undefined);
  const [loadFailure, setLoadFailure] = useState<
    "not_found" | "expired" | "server_error" | "network" | null
  >(null);
  const [tocOpen, setTocOpen] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setReport(null);
      setLoadFailure(null);
      return;
    }
    let cancelled = false;
    setLoadFailure(null);
    loadSharedReport(token).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setReport(result.report);
        setLoadFailure(null);
      } else {
        setReport(null);
        setLoadFailure(result.reason);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Hooks must run unconditionally (before any early return) to avoid React error #310
  const markdown = report?.markdown ?? "";
  const html = useMemo(() => buildReportHtml(markdown), [markdown]);
  const headings = useMemo(() => extractTocHeadings(markdown), [markdown]);

  if (!token) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
        data-tour="tour-shared-error"
      >
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Invalid link</h1>
          <p className="text-muted-foreground">
            This share link is invalid. Please request a new link from the report owner.
          </p>
          <a href="/" className="text-brand-accent hover:underline font-medium">
            Return to Sophos FireComply
          </a>
        </div>
      </div>
    );
  }

  if (report === undefined) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
        data-tour="tour-shared-error"
      >
        <p className="text-muted-foreground text-sm">Loading report…</p>
      </div>
    );
  }

  if (!report) {
    const copy =
      loadFailure === "expired"
        ? {
            title: "This report has expired",
            body: "Shared reports are available for 7 days. Please request a new link from the report owner.",
          }
        : loadFailure === "not_found"
          ? {
              title: "Report not found",
              body: "This link does not match a shared report. It may be wrong, the link may be for a library report (open it from Report Centre instead), or the share was removed.",
            }
          : {
              title: "Could not load this report",
              body:
                loadFailure === "network"
                  ? "Check your network connection and try again."
                  : "The server returned an error. Try again in a moment.",
            };
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
        data-tour="tour-shared-error"
      >
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.body}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center text-sm">
            <a href="/reports" className="text-brand-accent hover:underline font-medium">
              Report Centre
            </a>
            <a href="/" className="text-brand-accent hover:underline font-medium">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const branding: BrandingData = {
    companyName: report.customerName || "Customer",
    customerName: report.customerName || "",
    logoUrl: null,
    environment: "",
    country: "",
    selectedFrameworks: [],
  };

  const baseTitle = "Firewall Configuration Assessment Report";
  const wordFilename = `${report.customerName || "Report"}-${baseTitle.replace(/\s+/g, "-")}.docx`;
  const pdfFilename = `${sanitizePdfFilenamePart(report.customerName || "Report")}-${baseTitle.replace(/\s+/g, "-")}.pdf`;

  const handleWord = async () => {
    if (!report.markdown) return;
    const blob = await generateWordBlob(report.markdown, branding);
    saveAs(blob, wordFilename);
  };

  const handlePdf = async () => {
    if (!markdown.trim()) return;
    const el = reportContentRef.current;
    if (!el) return;
    const themedHtml = buildPdfHtml(el.innerHTML, baseTitle, branding, { theme: "light" });

    try {
      const { renderPdfViaServer } = await import("@/lib/pdf-render-client");
      const blob = await renderPdfViaServer(themedHtml, { landscape: true });
      saveAs(blob, pdfFilename);
    } catch (serverErr) {
      console.warn("FireComply: server PDF render failed, trying pdfmake", serverErr);
      try {
        const coverLines = [
          report.customerName ? `Customer: ${report.customerName}` : "",
          new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        ].filter(Boolean);
        const { generateMarkdownReportPdfBlob } = await import("@/lib/assessment-report-pdfmake");
        const blob = await generateMarkdownReportPdfBlob(markdown, {
          title: baseTitle,
          coverLines,
        });
        saveAs(blob, pdfFilename);
      } catch (pdfmakeErr) {
        console.warn("FireComply: pdfmake also failed, falling back to print", pdfmakeErr);
        openHtmlForPrint(themedHtml);
      }
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-background">
      {/* Match main doc shell exactly: same classes and structure as DocumentPreview ReportContent */}
      <div className="max-w-full w-full mx-auto px-4 py-8">
        <div className="rounded-xl border border-border shadow-sm overflow-hidden doc-section">
          <div
            className="bg-[#001A47] dark:bg-[#000d24] px-6 md:px-10 py-3 flex flex-wrap items-center justify-between gap-2"
            data-tour="tour-shared-header"
          >
            <div className="flex items-center gap-3">
              <img
                src="/sophos-icon-white.svg"
                alt=""
                className="h-5 w-5 opacity-60"
                loading="lazy"
                decoding="async"
              />
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">
                Sophos FireComply — Document
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3" data-tour="tour-shared-downloads">
              {report.allowDownload !== false && (
                <div className="no-print flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleWord}
                    className="gap-1.5 h-8 shrink-0 whitespace-nowrap text-white/90 bg-white/10 border-white/20 hover:bg-white/20"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" /> Download Word
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handlePdf()}
                    className="gap-1.5 h-8 shrink-0 whitespace-nowrap bg-[#2006F7] hover:bg-[#2006F7]/90 text-white border-0"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" /> Download PDF
                  </Button>
                </div>
              )}
              <span className="text-[10px] text-white/40">
                {new Date().toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · Link expires "}
                {new Date(report.expiresAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <div className="bg-card p-8 md:p-12" data-tour="tour-shared-body">
            {/* Same title block as main doc: company name + report subtitle only */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-brand-accent/20 dark:border-brand-accent/30">
              <div className="flex-1">
                {report.customerName && (
                  <p className="text-lg font-display font-bold text-foreground">
                    {report.customerName}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Firewall Configuration Assessment Report
                </p>
              </div>
            </div>

            {report.advisorNotes?.trim() && (
              <div className="mb-8 rounded-xl border-l-4 border-[#2006F7]/50 dark:border-[#00EDFF]/50 bg-muted/40 dark:bg-muted/25 px-5 py-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2006F7] dark:text-[#009CFB]">
                  Note from your advisor
                </p>
                <blockquote className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-0 m-0 pl-0">
                  {report.advisorNotes.trim()}
                </blockquote>
              </div>
            )}

            {/* TOC: same as main doc — collapsed by default, same button and nav styles */}
            {headings.length >= 3 && (
              <div className="no-print mb-4">
                <button
                  type="button"
                  onClick={() => setTocOpen(!tocOpen)}
                  className="text-xs font-semibold text-[#2006F7] dark:text-[#009CFB] hover:underline flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-brand-accent" />
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
                          h.level === 2
                            ? "font-semibold text-foreground py-1"
                            : "text-muted-foreground pl-4 py-0.5"
                        }`}
                      >
                        {h.text}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            )}

            {report.allowDownload === false && (
              <div className="no-print mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
                View only — export and download are disabled by the report owner.
              </div>
            )}
            {/* Report body: no prose class so it matches main doc styling exactly */}
            <div ref={reportContentRef}>
              <SafeHtml html={html} className="report-body-html" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SharedReport;
