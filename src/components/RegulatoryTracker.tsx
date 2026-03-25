import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw, Loader2, Rss } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RegulatoryUpdate {
  id: string;
  source: string;
  title: string;
  summary: string;
  link: string;
  framework: string | null;
  published_at: string | null;
  created_at: string;
}

const FALLBACK_UPDATES: Omit<RegulatoryUpdate, "id" | "created_at">[] = [
  {
    source: "PCI SSC",
    title: "PCI DSS v4.0.1",
    summary:
      "Updated multi-factor authentication requirements and new guidance on passwordless authentication.",
    link: "https://www.pcisecuritystandards.org/document_library/",
    framework: "PCI DSS",
    published_at: null,
  },
  {
    source: "NCSC",
    title: "Cyber Essentials — Updated technical controls 2025",
    summary:
      "Revised technical control themes including cloud services, home working, and multi-factor authentication.",
    link: "https://www.ncsc.gov.uk/cyberessentials/overview",
    framework: "Cyber Essentials",
    published_at: null,
  },
  {
    source: "EU Commission",
    title: "GDPR — Enhanced data breach notification requirements",
    summary:
      "Clarified 72-hour breach notification timelines and documentation expectations for supervisory authorities.",
    link: "https://commission.europa.eu/law/law-topic/data-protection_en",
    framework: "GDPR",
    published_at: null,
  },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "upcoming";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function RegulatoryTracker() {
  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("regulatory_updates")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20);

      if (error) throw error;
      setUpdates((data ?? []) as unknown as RegulatoryUpdate[]);
    } catch {
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regulatory-scanner`;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "scan" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");

      setScanResult(data.message ?? `Found ${data.relevant ?? 0} relevant updates`);
      if (!data.throttled) await fetchUpdates();
    } catch (err) {
      setScanResult(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [fetchUpdates]);

  const displayItems =
    updates.length > 0
      ? updates
      : FALLBACK_UPDATES.map((u, i) => ({ ...u, id: `fallback-${i}`, created_at: "" }));

  const isLiveData = updates.length > 0;

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(90,0,255,0.06), rgba(0,237,255,0.04), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(180,122,255,0.25), rgba(0,237,255,0.15), transparent)",
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-display font-black tracking-tight text-foreground flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur-sm shrink-0"
              style={{
                border: "1px solid rgba(180,122,255,0.35)",
                background: "linear-gradient(145deg, rgba(90,0,255,0.2), rgba(90,0,255,0.06))",
                boxShadow: "0 0 16px rgba(90,0,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <Rss className="h-5 w-5 text-[#B47AFF]" />
            </span>
            Regulatory Tracker
          </h3>
          <p className="text-sm text-foreground/45 mt-2 font-medium pl-0 sm:pl-[52px]">
            {isLiveData
              ? `${updates.length} updates from regulatory feeds`
              : "Showing default entries — scan to fetch live updates"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl backdrop-blur-sm text-foreground transition-all disabled:opacity-50 shrink-0 hover:brightness-110"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {scanning ? "Scanning..." : "Scan Feeds"}
        </button>
      </div>

      {scanResult && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm text-foreground/70 backdrop-blur-sm"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {scanResult}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div className="h-4 w-2/3 bg-muted/50 rounded mb-3" />
              <div className="h-3 w-full bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((u) => (
            <div
              key={u.id}
              className="rounded-xl p-4 sm:p-5 backdrop-blur-sm transition-all duration-200 hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.04] hover:border-slate-900/[0.14] dark:hover:border-white/[0.1]"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  "linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h4 className="text-base font-display font-bold tracking-tight text-foreground leading-snug">
                      {u.title}
                    </h4>
                    {u.framework && (
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg whitespace-nowrap backdrop-blur-sm border border-[#B47AFF]/40 text-[#B47AFF]"
                        style={{
                          background:
                            "linear-gradient(145deg, rgba(90,0,255,0.22), rgba(90,0,255,0.08))",
                          boxShadow:
                            "0 0 14px rgba(90,0,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}
                      >
                        {u.framework}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-semibold text-foreground/50">{u.source}</span>
                    {u.published_at && (
                      <span className="text-xs text-foreground/35">
                        · {timeAgo(u.published_at)}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={u.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start sm:self-auto flex h-10 w-10 items-center justify-center rounded-xl text-foreground/45 hover:text-[#00EDFF] transition-colors shrink-0"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                  aria-label="View details"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
              <p className="text-sm text-foreground/70 mt-3 leading-relaxed max-w-3xl">
                {u.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
