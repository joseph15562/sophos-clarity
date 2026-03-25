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
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Rss className="h-4 w-4" />
            Regulatory Tracker
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isLiveData
              ? `${updates.length} updates from regulatory feeds`
              : "Showing default entries — scan to fetch live updates"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-xl border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-brand-accent/30 dark:hover:border-[#00EDFF]/30 transition-colors disabled:opacity-50"
        >
          {scanning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {scanning ? "Scanning..." : "Scan Feeds"}
        </button>
      </div>

      {scanResult && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-muted/30 text-[10px] text-muted-foreground">
          {scanResult}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/10 p-3 animate-pulse">
              <div className="h-3 w-2/3 bg-muted rounded mb-2" />
              <div className="h-2 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-muted/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-display font-semibold tracking-tight text-foreground">
                      {u.title}
                    </h4>
                    {u.framework && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] whitespace-nowrap">
                        {u.framework}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{u.source}</span>
                    {u.published_at && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {timeAgo(u.published_at)}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={u.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="View details"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-[10px] text-foreground mt-2 leading-relaxed">{u.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
