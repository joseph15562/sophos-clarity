import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { saveAs } from "file-saver";
import { FileText, Download, ArrowLeft } from "lucide-react";
import {
  loadSavedReportPackageById,
  savedPackageToMarkdown,
  buildSavedPackNavItems,
  type SavedReportPackage,
} from "@/lib/saved-reports";
import { displayCustomerNameForUi } from "@/lib/sophos-central";
import { extractTocHeadings, buildReportHtml } from "@/lib/report-html";
import { buildPdfHtml, generateWordBlob, openHtmlForPrint } from "@/lib/report-export";
import { sanitizePdfFilenamePart } from "@/lib/pdf-utils";
import type { BrandingData } from "@/components/BrandingSetup";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/SafeHtml";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";

function SavedReportViewerInner() {
  const { id } = useParams<{ id: string }>();
  const { user, org, isGuest } = useAuth();
  const [pkg, setPkg] = useState<SavedReportPackage | null | undefined>(undefined);
  const [tocOpen, setTocOpen] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user || isGuest || !org) {
      setPkg(null);
      return;
    }
    let cancelled = false;
    loadSavedReportPackageById(id).then((p) => {
      if (!cancelled) setPkg(p);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user, isGuest, org]);

  const markdown = pkg ? savedPackageToMarkdown(pkg) : "";
  const html = useMemo(() => buildReportHtml(markdown), [markdown]);
  const headings = useMemo(() => extractTocHeadings(markdown), [markdown]);
  const packNavItems = useMemo(() => (pkg ? buildSavedPackNavItems(pkg.reports) : []), [pkg]);

  if (!user || isGuest || !org) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FireComplyWorkspaceHeader loginShell />
        <WorkspacePrimaryNav />
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Sign in required</h1>
            <p className="text-muted-foreground">
              Open saved reports from Report Centre while signed in to your organisation.
            </p>
            <Link to="/" className="text-brand-accent hover:underline font-medium inline-block">
              Return to Sophos FireComply
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FireComplyWorkspaceHeader loginShell={isGuest} />
        <WorkspacePrimaryNav />
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">Invalid link.</p>
          <Link to="/reports" className="mt-4 text-brand-accent hover:underline text-sm">
            Report Centre
          </Link>
        </div>
      </div>
    );
  }

  if (pkg === undefined) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FireComplyWorkspaceHeader />
        <WorkspacePrimaryNav />
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FireComplyWorkspaceHeader />
        <WorkspacePrimaryNav />
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Report not found</h1>
            <p className="text-muted-foreground">
              This saved report is missing or you do not have access. It may have been deleted.
            </p>
            <Link to="/reports" className="text-brand-accent hover:underline font-medium">
              Back to Report Centre
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const customerTitle = displayCustomerNameForUi(pkg.customerName, org?.name);

  const branding: BrandingData = {
    companyName: customerTitle || "Customer",
    customerName: customerTitle || "",
    logoUrl: null,
    environment: pkg.environment || "",
    country: "",
    selectedFrameworks: [],
  };

  const baseTitle = "Firewall Configuration Assessment Report";
  const wordFilename = `${customerTitle || "Report"}-${baseTitle.replace(/\s+/g, "-")}.docx`;
  const pdfFilename = `${sanitizePdfFilenamePart(customerTitle || "Report")}-${baseTitle.replace(/\s+/g, "-")}.pdf`;
  const savedLabel = new Date(pkg.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleWord = async () => {
    if (!markdown.trim()) return;
    const blob = await generateWordBlob(markdown, branding);
    saveAs(blob, wordFilename);
  };

  const handlePdf = async () => {
    if (!markdown.trim()) return;
    const coverLines = [
      customerTitle ? `Customer: ${customerTitle}` : "",
      pkg.environment ? `Environment: ${pkg.environment}` : "",
      new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ].filter(Boolean);
    try {
      const { generateMarkdownReportPdfBlob } = await import("@/lib/assessment-report-pdfmake");
      const blob = await generateMarkdownReportPdfBlob(markdown, { title: baseTitle, coverLines });
      saveAs(blob, pdfFilename);
    } catch (err) {
      console.warn("FireComply: saved report PDF fell back to print", err);
      const el = reportContentRef.current;
      if (!el) return;
      const html = buildPdfHtml(el.innerHTML, baseTitle, branding, { theme: "light" });
      openHtmlForPrint(html);
    }
  };

  const scrollTo = (elementId: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background"
      data-tour="tour-page-saved-report"
    >
      <FireComplyWorkspaceHeader />
      <WorkspacePrimaryNav />
      <div
        className="border-b border-border/60 bg-card/40 px-4 py-3"
        data-tour="tour-saved-breadcrumb"
      >
        <div className="mx-auto max-w-4xl flex items-center gap-3 text-sm">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Report Centre
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium truncate">Saved report</span>
        </div>
      </div>

      <div
        className="max-w-full w-full mx-auto px-4 pt-8 assist-chrome-pad-bottom"
        data-tour="tour-saved-document"
      >
        <div className="rounded-xl border border-border shadow-sm overflow-hidden doc-section">
          <div className="bg-[#001A47] dark:bg-[#000d24] px-6 md:px-10 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <img
                src="/sophos-icon-white.svg"
                alt=""
                className="h-5 w-5 opacity-60"
                loading="lazy"
                decoding="async"
              />
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">
                Sophos FireComply — Saved library
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="no-print flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleWord()}
                  disabled={!markdown.trim()}
                  className="gap-1.5 h-8 shrink-0 whitespace-nowrap text-white/90 bg-white/10 border-white/20 hover:bg-white/20"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" /> Download Word
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handlePdf()}
                  disabled={!markdown.trim()}
                  className="gap-1.5 h-8 shrink-0 whitespace-nowrap bg-[#2006F7] hover:bg-[#2006F7]/90 text-white border-0"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" /> Download PDF
                </Button>
              </div>
              <span className="text-[10px] text-white/40">Saved {savedLabel}</span>
            </div>
          </div>
          <div className="bg-card p-8 md:p-12">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-brand-accent/20 dark:border-brand-accent/30">
              <div className="flex-1">
                {customerTitle && (
                  <p className="text-lg font-display font-bold text-foreground">{customerTitle}</p>
                )}
                <p className="text-sm text-muted-foreground">{baseTitle}</p>
              </div>
            </div>

            {packNavItems.length > 0 && (
              <div className="no-print mb-4 flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Jump to report
                </p>
                <div className="flex flex-wrap gap-2">
                  {packNavItems.map((item) => (
                    <button
                      key={item.domId}
                      type="button"
                      onClick={() => scrollTo(item.domId)}
                      className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-[#2006F7]/30 hover:bg-[#2006F7]/10 dark:hover:border-[#00EDFF]/20 dark:hover:bg-[#00EDFF]/10"
                    >
                      {item.shortTitle}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                        className={`block w-full text-left text-xs hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors truncate cursor-pointer ${
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

            <div ref={reportContentRef}>
              <SafeHtml html={html} className="report-body-html" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SavedReportViewer() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <SavedReportViewerInner />
    </AuthProvider>
  );
}
