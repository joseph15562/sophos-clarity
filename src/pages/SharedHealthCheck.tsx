import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Download, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";

interface SharedHealthCheckData {
  html: string;
  customer_name: string | null;
  expires_at: string;
  checked_at: string;
}

type LoadState = "loading" | "loaded" | "expired" | "not-found" | "error";

async function fetchSharedHealthCheck(token: string): Promise<SharedHealthCheckData | null> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public/shared-health-check/${token}`;
  const res = await fetch(url, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  });
  if (res.status === 410) return null; // expired
  if (!res.ok) throw new Error(res.status === 404 ? "not-found" : "error");
  return res.json();
}

const SharedHealthCheck = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<SharedHealthCheckData | null>(null);

  useEffect(() => {
    if (!token) {
      setState("not-found");
      return;
    }
    let cancelled = false;
    fetchSharedHealthCheck(token)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setState("expired");
        } else {
          setData(d);
          setState("loaded");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setState(e instanceof Error && e.message === "not-found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <Shield className="h-8 w-8 text-[#00F2B3] animate-pulse mb-3" />
        <p className="text-white/60 text-sm">Loading health check report…</p>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">Report not found</h1>
          <p className="text-white/50 text-sm">
            This link is invalid or the health check has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">This report has expired</h1>
          <p className="text-white/50 text-sm">
            Shared health check reports are available for a limited time. Please ask your Sophos SE
            for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-white/50 text-sm">
            We couldn't load this report. Please try again or contact your Sophos SE.
          </p>
        </div>
      </div>
    );
  }

  const customerLabel = data.customer_name?.trim() || "Health Check";
  const checkedDate = new Date(data.checked_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const expiresDate = new Date(data.expires_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleDownloadHtml = () => {
    const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
    saveAs(blob, `Sophos-Health-Check-${customerLabel.replace(/\s+/g, "-")}.html`);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(data.html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#001A47]">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-[#001A47]/95 backdrop-blur border-b border-white/10 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5 opacity-70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest hidden sm:inline">
            Sophos Firewall Health Check
          </span>
          {data.customer_name && (
            <span className="text-[11px] text-white/40 hidden md:inline">
              — {data.customer_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 hidden sm:inline">
            {checkedDate} · Expires {expiresDate}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 h-8 text-white/80 hover:text-white hover:bg-white/10 text-xs"
            onClick={handleDownloadHtml}
          >
            <Download className="h-3.5 w-3.5" />
            HTML
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 h-8 bg-[#00F2B3] hover:bg-[#00F2B3]/90 text-white text-xs"
            onClick={handlePrint}
          >
            <FileText className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl">
          <iframe
            srcDoc={data.html}
            title="Health Check Report"
            className="w-full border-0 bg-white"
            style={{ minHeight: "90vh" }}
            onLoad={(e) => {
              const iframe = e.currentTarget;
              const body = iframe.contentDocument?.body;
              if (body) {
                iframe.style.height = `${body.scrollHeight + 40}px`;
              }
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-[10px] text-white/25">
        Sophos Firewall Health Check · Powered by Sophos FireComply
      </div>
    </main>
  );
};

export default SharedHealthCheck;
