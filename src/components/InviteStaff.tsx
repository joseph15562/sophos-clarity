import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, AlertCircle, CheckCircle2, Shield, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAudit } from "@/lib/audit";

interface Invite {
  id: string;
  email: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const loadData = useCallback(async () => {
    if (!org) return;
    const [inviteRes, memberRes, sessionRes] = await Promise.all([
      supabase.from("org_invites").select("id, email, created_at").eq("org_id", org.id).order("created_at", { ascending: false }),
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
      .insert({ org_id: org.id, email: email.trim().toLowerCase() });
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
  }, [email, org, loadData]);

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

  if (role !== "admin") {
    return (
      <div className="text-center text-xs text-muted-foreground py-4">
        Only organisation admins can manage team members.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#2006F7] hover:bg-[#10037C] text-white px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </button>
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
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.role}</span>
                {m.role !== "admin" && !m.isYou && (
                  <button onClick={() => removeMember(m.id, m.email)} className="text-muted-foreground hover:text-[#EA0022] transition-colors" title="Remove member">
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
                <span className="text-[9px] text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                <button onClick={() => revokeInvite(inv.id)} className="text-muted-foreground hover:text-[#EA0022] transition-colors" title="Revoke invite">
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
