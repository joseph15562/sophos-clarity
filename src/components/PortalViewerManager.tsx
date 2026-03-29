import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, UserPlus, Key, Shield, Trash2, Loader2, Clock, Check, X, Users } from "lucide-react";
import { toast } from "sonner";

interface PortalViewerManagerProps {
  orgId: string;
}

interface PortalViewer {
  id: string;
  email: string;
  name: string | null;
  status: "pending" | "active" | "revoked";
  invited_at: string;
  last_login: string | null;
}

/* Direct Supabase queries — no edge function deploy needed */

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  active: <Check className="h-3 w-3" />,
  revoked: <X className="h-3 w-3" />,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PortalViewerManager({ orgId }: PortalViewerManagerProps) {
  const [viewers, setViewers] = useState<PortalViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const loadViewers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("portal_viewers")
        .select("id, email, name, status, invited_at, last_login_at")
        .eq("org_id", orgId)
        .order("invited_at", { ascending: false });
      if (error) throw new Error(error.message);
      setViewers(
        (data ?? []).map((v) => ({
          id: v.id,
          email: v.email,
          name: v.name,
          status: v.status as "pending" | "active" | "revoked",
          invited_at: v.invited_at,
          last_login: v.last_login_at,
        })),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not load portal viewers: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadViewers();
  }, [orgId, loadViewers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        setSubmitting(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/portal-viewers/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, name: inviteName.trim() || undefined }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Invite failed (${res.status})`);
      }

      toast.success(`Invitation sent to ${email}. They'll receive an email to set their password.`);
      setInviteEmail("");
      setInviteName("");
      loadViewers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(viewer: PortalViewer) {
    setActionInFlight(viewer.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(viewer.email);
      if (error) throw new Error(error.message);
      toast.success(`Password reset email sent to ${viewer.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleRevoke(viewer: PortalViewer) {
    setActionInFlight(viewer.id);
    try {
      const { error } = await supabase
        .from("portal_viewers")
        .update({ status: "revoked" })
        .eq("id", viewer.id)
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
      toast.success(`Access revoked for ${viewer.email}`);
      loadViewers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  }

  const activeCount = viewers.filter((v) => v.status !== "revoked").length;

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Portal Access</h3>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          <Users className="h-3.5 w-3.5" />
          {activeCount} {activeCount === 1 ? "user" : "users"}
        </span>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="viewer@customer.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <label htmlFor="invite-name" className="text-xs font-medium text-muted-foreground">
            Name (optional)
          </label>
          <Input
            id="invite-name"
            type="text"
            placeholder="Jane Smith"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting || !inviteEmail.trim()} className="gap-2">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Send Invite
        </Button>
      </form>

      {/* Viewer table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading viewers…
        </div>
      ) : viewers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No portal viewers yet. Send an invite above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/60 text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Invited</th>
                <th className="pb-2 pr-4">Last Login</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {viewers.map((v) => (
                <tr key={v.id} className="group">
                  <td className="py-3 pr-4 font-medium text-foreground">{v.email}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{v.name ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[v.status] ?? ""}`}
                    >
                      {STATUS_ICONS[v.status]}
                      {v.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(v.invited_at)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(v.last_login)}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {v.status !== "revoked" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionInFlight === v.id}
                            onClick={() => handleResetPassword(v)}
                            title="Reset Password"
                          >
                            {actionInFlight === v.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Key className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionInFlight === v.id}
                            onClick={() => handleRevoke(v)}
                            title="Revoke Access"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
