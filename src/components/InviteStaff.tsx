import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, AlertCircle, CheckCircle2, Shield, Users, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { OrgRole } from "@/hooks/use-auth";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

const ROLE_OPTIONS: { value: OrgRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access — manage agents, Central, team, and settings" },
  { value: "engineer", label: "Engineer", description: "Run assessments, view reports, manage agents" },
  { value: "member", label: "Member", description: "View assessments and reports" },
  { value: "viewer", label: "Viewer", description: "Read-only access to reports (for client access)" },
];

interface Invite {
  id: string;
  email: string;
  role?: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
  isYou?: boolean;
}

export function InviteStaff() {
  const { org, role } = useAuth();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const loadData = useCallback(async () => {
    if (!org) return;
    const [inviteRes, memberRes, sessionRes] = await Promise.all([
      supabase.from("org_invites").select("id, email, role, created_at").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("org_members").select("id, user_id, role, joined_at").eq("org_id", org.id).order("joined_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);
    if (inviteRes.data) setInvites(inviteRes.data);
    if (memberRes.data) {
      const currentUser = sessionRes.data?.user;
      const enriched: Member[] = memberRes.data.map((m) => ({
        ...m,
        email: currentUser && m.user_id === currentUser.id
          ? currentUser.email
          : undefined,
        isYou: currentUser ? m.user_id === currentUser.id : false,
      }));

      if (inviteRes.data) {
        for (const m of enriched) {
          if (!m.email) {
            const matchingInvite = inviteRes.data.find((inv) =>
              enriched.filter((em) => em.email === inv.email).length === 0
            );
            if (matchingInvite) m.email = matchingInvite.email;
          }
        }
      }

      setMembers(enriched);
    }
  }, [org]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!org) return;

    setLoading(true);
    const { error: err } = await supabase
      .from("org_invites")
      .insert({ org_id: org.id, email: email.trim().toLowerCase(), role: inviteRole });
    setLoading(false);

    if (err) {
      if (err.message.includes("duplicate")) setError("This email has already been invited");
      else setError(err.message);
    } else {
      setSuccess(`Invite sent to ${email.trim()}`);
      setEmail("");
      loadData();
      setTimeout(() => setSuccess(null), 4000);
      if (org?.id) {
        logAudit(org.id, "team.invited", "org_invite", "", { email: email.trim().toLowerCase() }).catch(() => {});
      }
    }
  }, [email, org, inviteRole, loadData]);

  const revokeInvite = useCallback(async (id: string) => {
    await supabase.from("org_invites").delete().eq("id", id);
    loadData();
  }, [loadData]);

  const removeMember = useCallback(async (id: string, memberEmail?: string) => {
    const { error } = await supabase.from("org_members").delete().eq("id", id);
    if (!error && org?.id) {
      logAudit(org.id, "team.removed", "org_member", id, { email: memberEmail }).catch(() => {});
    }
    loadData();
  }, [loadData, org]);

  const [resettingMfa, setResettingMfa] = useState<string | null>(null);

  const resetMfa = useCallback(async (targetUserId: string, memberEmail?: string) => {
    if (!confirm(`Reset MFA for ${memberEmail ?? "this user"}? They will need to re-enroll their authenticator on next login.`)) return;

    setResettingMfa(targetUserId);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin/reset-mfa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ targetUserId }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reset MFA");
      }

      const data = await res.json();
      if (data.factorsRemoved > 0) {
        toast.success(`MFA reset for ${memberEmail ?? "user"} — ${data.factorsRemoved} factor(s) removed`);
      } else {
        toast.info(`${memberEmail ?? "User"} has no MFA factors enrolled`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset MFA");
    }
    setResettingMfa(null);
  }, []);

  if (role !== "admin") {
    return (
      <div className="text-center text-xs text-muted-foreground py-4">
        Only organisation admins can manage team members.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Role descriptions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Roles</p>
        {ROLE_OPTIONS.map((r) => (
          <div key={r.value} className="text-[10px]">
            <span className="font-medium text-foreground">{r.label}:</span>{" "}
            <span className="text-muted-foreground">{r.description}</span>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as OrgRole)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#2006F7] hover:bg-[#10037C] text-white px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-xs text-[#EA0022] bg-[#EA0022]/5 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-[#00995a] dark:text-[#00F2B3] bg-[#00995a]/5 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Current members */}
      {members.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <Users className="h-3 w-3" />
            Team Members ({members.length})
          </div>
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                <Shield className={`h-3 w-3 shrink-0 ${m.role === "admin" ? "text-[#2006F7] dark:text-[#00EDFF]" : "text-muted-foreground"}`} />
                <span className="text-xs text-foreground flex-1 truncate">
                  {m.email ?? m.user_id}
                  {m.isYou && <span className="text-[9px] text-muted-foreground ml-1">(you)</span>}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{m.role}</span>
                {!m.isYou && (
                  <button
                    onClick={() => resetMfa(m.user_id, m.email)}
                    disabled={resettingMfa === m.user_id}
                    className="text-muted-foreground hover:text-[#F29400] transition-colors disabled:opacity-50"
                    title="Reset MFA"
                  >
                    <KeyRound className="h-3 w-3" />
                  </button>
                )}
                {m.role !== "admin" && !m.isYou && (
                  <button onClick={() => removeMember(m.id, m.email)} className="text-muted-foreground hover:text-[#EA0022] transition-colors" title="Remove member" aria-label="Remove member">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Pending Invites ({invites.length})
          </div>
          <div className="space-y-1">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F29400]/5">
                <UserPlus className="h-3 w-3 text-[#F29400] shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{inv.email}</span>
                {inv.role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{inv.role}</span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                <button onClick={() => revokeInvite(inv.id)} className="text-muted-foreground hover:text-[#EA0022] transition-colors" title="Revoke invite" aria-label="Revoke invite">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Invited users will be automatically added to your organisation when they create their account with the same email.
      </p>
    </div>
  );
}
