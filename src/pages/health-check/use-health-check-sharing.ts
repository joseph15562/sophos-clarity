import { useCallback, useMemo, useRef, useState } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SEProfile } from "@/hooks/use-se-auth";
import { useActiveTeam } from "@/hooks/use-active-team";

export type RecheckResult = {
  id: string;
  customer_name: string;
  overall_score: number | null;
  overall_grade: string | null;
  checked_at: string;
  customer_email?: string;
  serialNumbers: string[];
};

export function useHealthCheckSharing(options: {
  seProfile: SEProfile | null;
  savedCheckId: string | null;
  /** Builds the HTML document stored on the row when creating a share link. */
  buildSharedHtml: () => Promise<string>;
  onRecheckSelected?: (result: RecheckResult) => void;
}) {
  const { seProfile, savedCheckId, buildSharedHtml, onRecheckSelected } = options;
  const { activeTeamId } = useActiveTeam();
  const nextMutationSignal = useAbortableInFlight();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareDays, setShareDays] = useState(7);

  const [followupAt, setFollowupAt] = useState<string | null>(null);
  const [settingFollowup, setSettingFollowup] = useState(false);

  const [recheckSearchOpen, setRecheckSearchOpen] = useState(false);
  const [recheckQuery, setRecheckQuery] = useState("");
  const [recheckResults, setRecheckResults] = useState<RecheckResult[]>([]);
  const [recheckSearching, setRecheckSearching] = useState(false);

  const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recheckVersionRef = useRef(0);

  const handleRecheckSearch = useCallback(
    (query: string) => {
      setRecheckQuery(query);
      if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
      if (!query.trim() || !seProfile) {
        setRecheckResults([]);
        setRecheckSearching(false);
        return;
      }
      setRecheckSearching(true);
      recheckTimerRef.current = setTimeout(async () => {
        const version = ++recheckVersionRef.current;
        try {
          const profileId = seProfile.id;
          let q = supabase
            .from("se_health_checks")
            .select(
              "id, customer_name, overall_score, overall_grade, checked_at, snap_files:summary_json->snapshot->files, customer_email:summary_json->snapshot->customerEmail",
            )
            .ilike("customer_name", `%${query.trim()}%`)
            .order("checked_at", { ascending: false })
            .limit(10);
          if (activeTeamId) q = q.eq("team_id", activeTeamId);
          else q = q.eq("se_user_id", profileId);
          const { data, error } = await q;
          if (version !== recheckVersionRef.current) return;
          if (error) {
            console.error("[recheck-search]", error);
            setRecheckResults([]);
            return;
          }
          const allRows = (data ?? []).map((row: Record<string, unknown>) => {
            const snapFiles = (row.snap_files as Array<{ serialNumber?: string }>) ?? [];
            const serialNumbers = snapFiles.map((f) => f.serialNumber).filter(Boolean) as string[];
            return {
              id: row.id as string,
              customer_name: (row.customer_name as string) ?? "",
              overall_score: (row.overall_score as number | null) ?? null,
              overall_grade: (row.overall_grade as string | null) ?? null,
              checked_at: row.checked_at as string,
              customer_email: row.customer_email as string | undefined,
              serialNumbers,
            };
          });
          const seen = new Set<string>();
          const results = allRows.filter((r) => {
            const key = `${r.customer_name.toLowerCase()}|${[...r.serialNumbers].sort().join(",")}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setRecheckResults(results);
        } catch (err) {
          console.error("[recheck-search]", err);
          if (version === recheckVersionRef.current) setRecheckResults([]);
        } finally {
          if (version === recheckVersionRef.current) setRecheckSearching(false);
        }
      }, 300);
    },
    [seProfile, activeTeamId],
  );

  const handleRecheckSelect = useCallback(
    (result: RecheckResult) => {
      setRecheckSearchOpen(false);
      onRecheckSelected?.(result);
    },
    [onRecheckSelected],
  );

  const handleSetFollowup = useCallback(
    async (months: number | null) => {
      if (!savedCheckId) {
        toast.error("Save the health check first.");
        return;
      }
      setSettingFollowup(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        let followupDate: string | null = null;
        if (months) {
          const d = new Date();
          d.setMonth(d.getMonth() + months);
          followupDate = d.toISOString();
        }
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/health-checks/${savedCheckId}/followup`,
          {
            method: "PATCH",
            signal: nextMutationSignal(),
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ followup_at: followupDate }),
          },
        );
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        setFollowupAt(followupDate);
        toast.success(
          months
            ? `Follow-up reminder set for ${months} months from now.`
            : "Follow-up reminder cancelled.",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not set follow-up.");
      } finally {
        setSettingFollowup(false);
      }
    },
    [savedCheckId, nextMutationSignal],
  );

  const handleShareHealthCheck = useCallback(async () => {
    if (!savedCheckId) {
      toast.error("Save the health check first before sharing.");
      return;
    }
    setSharing(true);
    try {
      const html = await buildSharedHtml();

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + shareDays);

      const { error } = await supabase
        .from("se_health_checks")
        .update({
          share_token: token,
          share_expires_at: expiresAt.toISOString(),
          shared_html: html,
        })
        .eq("id", savedCheckId);

      if (error) throw error;

      setShareToken(token);
      setShareExpiry(expiresAt.toISOString());
      toast.success("Share link created.");
    } catch (err) {
      console.warn("[health-check] share failed", err);
      toast.error(err instanceof Error ? err.message : "Could not create share link.");
    } finally {
      setSharing(false);
    }
  }, [savedCheckId, buildSharedHtml, shareDays]);

  const handleRevokeShare = useCallback(async () => {
    if (!savedCheckId) return;
    try {
      await supabase
        .from("se_health_checks")
        .update({
          share_token: null,
          share_expires_at: null,
          shared_html: null,
        })
        .eq("id", savedCheckId);
      setShareToken(null);
      setShareExpiry(null);
      toast.success("Share link revoked.");
    } catch {
      toast.error("Could not revoke share link.");
    }
  }, [savedCheckId]);

  const shareUrl = useMemo(() => {
    if (!shareToken) return null;
    return `${window.location.origin}/health-check/shared/${shareToken}`;
  }, [shareToken]);

  return {
    shareDialogOpen,
    setShareDialogOpen,
    shareToken,
    setShareToken,
    shareExpiry,
    setShareExpiry,
    sharing,
    setSharing,
    shareDays,
    setShareDays,
    followupAt,
    setFollowupAt,
    settingFollowup,
    setSettingFollowup,
    recheckSearchOpen,
    setRecheckSearchOpen,
    recheckQuery,
    setRecheckQuery,
    recheckResults,
    setRecheckResults,
    recheckSearching,
    setRecheckSearching,
    handleRecheckSearch,
    handleRecheckSelect,
    handleSetFollowup,
    handleShareHealthCheck,
    handleRevokeShare,
    shareUrl,
  };
}
