import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UploadedFile } from "@/components/FileUpload";
import { supabase } from "@/integrations/supabase/client";
import type { SEProfile } from "@/hooks/use-se-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";

export type ConfigUploadRequestRow = {
  id: string;
  token: string;
  customer_name: string | null;
  contact_name?: string | null;
  customer_email: string | null;
  status: string;
  expires_at: string;
  email_sent: boolean;
  uploaded_at: string | null;
  downloaded_at: string | null;
  created_at: string;
  se_user_id?: string;
  team_id?: string | null;
  central_connected_at?: string | null;
};

/** Response shape from GET /api/config-upload/:token/central-data */
export type ConfigUploadCentralApiPayload = {
  central_connected: boolean;
  central_data: Record<string, unknown> | null | undefined;
  linked_firewall_id?: string | null;
  linked_firewall_name?: string | null;
};

export type OnConfigLoadedFromUpload = (
  uploaded: UploadedFile,
  requestCustomerName: string | null | undefined,
  requestCustomerEmail: string | null | undefined,
  requestContactName: string | null | undefined,
  centralPayload: ConfigUploadCentralApiPayload | null | undefined,
) => void | Promise<void>;

export type UseConfigUploadOptions = {
  seProfile: SEProfile | null;
  activeTeamId: string | null | undefined;
  onLoadConfig: OnConfigLoadedFromUpload;
};

export function useConfigUpload({ seProfile, activeTeamId, onLoadConfig }: UseConfigUploadOptions) {
  const queryClient = useQueryClient();
  const nextMutationSignal = useAbortableInFlight();
  const [configUploadDialogOpen, setConfigUploadDialogOpen] = useState(false);
  const [configUploadCustomerName, setConfigUploadCustomerName] = useState("");
  const [configUploadContactName, setConfigUploadContactName] = useState("");
  const [configUploadCustomerEmail, setConfigUploadCustomerEmail] = useState("");
  const [configUploadDays, setConfigUploadDays] = useState(7);
  const [configUploadCreating, setConfigUploadCreating] = useState(false);
  const [configUploadToken, setConfigUploadToken] = useState<string | null>(null);
  const [configUploadUrl, setConfigUploadUrl] = useState<string | null>(null);
  const [configUploadEmailSent, setConfigUploadEmailSent] = useState(false);
  const [configUploadStatus, setConfigUploadStatus] = useState<string | null>(null);
  const [configUploadResending, setConfigUploadResending] = useState(false);
  const [configUploadLoading, setConfigUploadLoading] = useState(false);
  const [configUploadRequestsOpen, setConfigUploadRequestsOpen] = useState(false);
  const [resendingUploadToken, setResendingUploadToken] = useState<string | null>(null);
  const configUploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const listQueryKey = seProfile
    ? queryKeys.seHealthCheck.configUploadRequests(seProfile.id, activeTeamId ?? null)
    : (["se-health-check", "config-upload-requests", "disabled"] as const);

  const invalidateConfigUploadList = useCallback(() => {
    if (!seProfile) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.seHealthCheck.configUploadRequests(seProfile.id, activeTeamId ?? null),
    });
  }, [queryClient, seProfile, activeTeamId]);

  const { data: configUploadRequests = [], isLoading: configUploadListLoading } = useQuery({
    queryKey: [...listQueryKey],
    enabled: Boolean(seProfile),
    queryFn: async ({ signal }) => {
      if (!seProfile) return [];
      const params = activeTeamId ? `?team_id=${activeTeamId}` : "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload-requests${params}`;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(url, {
        signal,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: ConfigUploadRequestRow[] };
      return json.data ?? [];
    },
  });

  const handleCreateConfigUploadRequest = useCallback(async () => {
    if (!seProfile) return;
    setConfigUploadCreating(true);
    const signal = nextMutationSignal();
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload-request`;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: configUploadCustomerName.trim() || undefined,
          contact_name: configUploadContactName.trim() || undefined,
          customer_email: configUploadCustomerEmail.trim() || undefined,
          expires_in_days: configUploadDays,
          team_id: activeTeamId ?? undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        token?: string;
        url?: string;
        email_sent?: boolean;
      };
      if (!res.ok) throw new Error(json.error || "Failed to create upload request");

      setConfigUploadToken(json.token ?? null);
      setConfigUploadUrl(json.url ?? null);
      setConfigUploadEmailSent(!!json.email_sent);
      setConfigUploadStatus("pending");

      if (json.email_sent) {
        toast.success(`Upload link sent to ${configUploadCustomerEmail.trim()}`);
      } else if (configUploadCustomerEmail.trim()) {
        toast.warning("Upload link created but email could not be sent — share the link manually.");
      } else {
        toast.success("Upload link created — copy and share it with the customer.");
      }

      invalidateConfigUploadList();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Could not create upload request.");
    } finally {
      setConfigUploadCreating(false);
    }
  }, [
    nextMutationSignal,
    seProfile,
    configUploadCustomerName,
    configUploadContactName,
    configUploadCustomerEmail,
    configUploadDays,
    invalidateConfigUploadList,
    activeTeamId,
  ]);

  const handleResendConfigUploadEmail = useCallback(async () => {
    if (!configUploadToken) return;
    setConfigUploadResending(true);
    const signal = nextMutationSignal();
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${configUploadToken}/resend`;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      const json = (await res.json()) as { email_sent?: boolean; error?: string };
      if (json.email_sent) {
        toast.success("Email resent to customer.");
      } else {
        toast.error(json.error || "Could not resend email.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Could not resend email.");
    } finally {
      setConfigUploadResending(false);
    }
  }, [configUploadToken, nextMutationSignal]);

  const handleResendUploadEmail = useCallback(
    async (token: string) => {
      setResendingUploadToken(token);
      const signal = nextMutationSignal();
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}/resend`;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(url, {
          method: "POST",
          signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${session?.access_token}`,
          },
        });
        const json = (await res.json()) as { email_sent?: boolean; error?: string };
        if (json.email_sent) {
          toast.success("Email resent to customer.");
        } else {
          toast.error(json.error || "Could not resend email.");
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error("Could not resend email.");
      } finally {
        setResendingUploadToken(null);
      }
    },
    [nextMutationSignal],
  );

  const handleLoadConfigFromUpload = useCallback(
    async (token: string) => {
      setConfigUploadLoading(true);
      const signal = nextMutationSignal();
      try {
        const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}/download`;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(downloadUrl, {
          signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${session?.access_token}`,
          },
        });
        if (!res.ok) {
          const errJson = (await res.json()) as { error?: string };
          throw new Error(errJson.error || "Download failed");
        }
        const json = (await res.json()) as { file_name?: string; config_xml: string };
        const fileName = json.file_name || "entities.xml";
        const uploaded: UploadedFile = {
          id: crypto.randomUUID(),
          fileName,
          content: json.config_xml,
          label: fileName.replace(/\.(xml|html|htm)$/i, ""),
        };

        const matchedReq = configUploadRequests.find((r) => r.token === token);

        let centralPayload: ConfigUploadCentralApiPayload | null | undefined;
        try {
          const centralUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}/central-data`;
          const centralRes = await fetch(centralUrl, {
            signal,
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              authorization: `Bearer ${session?.access_token}`,
            },
          });
          if (centralRes.ok) {
            centralPayload = (await centralRes.json()) as ConfigUploadCentralApiPayload;
          }
        } catch {
          /* Central data is optional enrichment */
        }

        await onLoadConfig(
          uploaded,
          matchedReq?.customer_name,
          matchedReq?.customer_email,
          matchedReq?.contact_name,
          centralPayload,
        );

        setConfigUploadDialogOpen(false);
        setConfigUploadRequestsOpen(false);
        invalidateConfigUploadList();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Could not load config.");
      } finally {
        setConfigUploadLoading(false);
      }
    },
    [configUploadRequests, invalidateConfigUploadList, nextMutationSignal, onLoadConfig],
  );

  const handleRevokeConfigUpload = useCallback(
    async (token: string) => {
      const signal = nextMutationSignal();
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}`;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await fetch(url, {
          method: "DELETE",
          signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${session?.access_token}`,
          },
        });
        toast.success("Upload request revoked.");
        if (configUploadToken === token) {
          setConfigUploadToken(null);
          setConfigUploadUrl(null);
          setConfigUploadStatus(null);
        }
        invalidateConfigUploadList();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error("Could not revoke upload request.");
      }
    },
    [configUploadToken, invalidateConfigUploadList, nextMutationSignal],
  );

  const handleClaimConfigUpload = useCallback(
    async (token: string) => {
      const signal = nextMutationSignal();
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}/claim`;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(url, {
          method: "POST",
          signal,
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${session?.access_token}`,
          },
        });
        if (!res.ok) {
          const errJson = (await res.json()) as { error?: string };
          throw new Error(errJson.error || "Claim failed");
        }
        toast.success("Upload request claimed — it's now yours.");
        invalidateConfigUploadList();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "Could not claim upload request.");
      }
    },
    [invalidateConfigUploadList, nextMutationSignal],
  );

  useEffect(() => {
    if (!configUploadToken || configUploadStatus !== "pending") {
      if (configUploadPollRef.current) clearInterval(configUploadPollRef.current);
      return;
    }
    const ac = new AbortController();
    const poll = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public/config-upload/${configUploadToken}`;
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (res.ok) {
          const statusJson = (await res.json()) as { status?: string };
          if (statusJson.status === "uploaded") {
            setConfigUploadStatus("uploaded");
            toast.success("Customer has uploaded their configuration!");
            invalidateConfigUploadList();
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        warnOptionalError("use-config-upload.poll", e);
      }
    };
    configUploadPollRef.current = setInterval(poll, 10_000);
    void poll();
    return () => {
      ac.abort();
      if (configUploadPollRef.current) clearInterval(configUploadPollRef.current);
    };
  }, [configUploadToken, configUploadStatus, invalidateConfigUploadList]);

  return {
    configUploadDialogOpen,
    setConfigUploadDialogOpen,
    configUploadCustomerName,
    setConfigUploadCustomerName,
    configUploadContactName,
    setConfigUploadContactName,
    configUploadCustomerEmail,
    setConfigUploadCustomerEmail,
    configUploadDays,
    setConfigUploadDays,
    configUploadCreating,
    configUploadToken,
    setConfigUploadToken,
    configUploadUrl,
    setConfigUploadUrl,
    configUploadEmailSent,
    setConfigUploadEmailSent,
    configUploadStatus,
    setConfigUploadStatus,
    configUploadResending,
    configUploadLoading,
    configUploadRequests,
    configUploadRequestsOpen,
    setConfigUploadRequestsOpen,
    configUploadListLoading,
    resendingUploadToken,
    handleCreateConfigUploadRequest,
    handleResendConfigUploadEmail,
    handleResendUploadEmail,
    handleLoadConfigFromUpload,
    handleRevokeConfigUpload,
    handleClaimConfigUpload,
  };
}
