import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { loadSharedReport, type SharedReport as SharedReportType } from "@/lib/share-report";

const SharedReport = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportType | null | undefined>(undefined);

  useEffect(() => {
    if (!token) { setReport(null); return; }
    let cancelled = false;
    loadSharedReport(token).then((r) => { if (!cancelled) setReport(r); });
    return () => { cancelled = true; };
  }, [token]);

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

  const html = (() => {
    const rawHtml = marked.parse(report.markdown, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-[#001A47] dark:bg-[#000d24] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5 opacity-60" />
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">
              Sophos FireComply — Shared Report
            </span>
          </div>
          <span className="text-[10px] text-white/40">
            {report.customerName && `${report.customerName} · `}
            Expires {new Date(report.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </header>
      <main id="main-content" className="max-w-4xl mx-auto px-6 py-8">
        <div
          className="prose prose-slate dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
};

export default SharedReport;
