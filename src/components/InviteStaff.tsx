import { useState, useCallback } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { UserPlus, Trash2, AlertCircle, CheckCircle2, Shield, Users, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { OrgRole } from "@/hooks/use-auth";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import {
  useOrgTeamRosterQuery,
  useOrgInviteMutation,
  useOrgInviteRevokeMutation,
  useOrgMemberRemoveMutation,
} from "@/hooks/queries";

const teamInviteEmailSchema = z.string().trim().email();

const ROLE_OPTIONS: { value: OrgRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access — manage agents, Central, team, and settings",
  },
  {
    value: "engineer",
    label: "Engineer",
    description: "Run assessments, view reports, manage agents",
  },
  { value: "member", label: "Member", description: "View assessments and reports" },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to reports (for client access)",
  },
];

export function InviteStaff() {
  const nextFetchSignal = useAbortableInFlight();
  const { org, role } = useAuth();
  const rosterQuery = useOrgTeamRosterQuery(org?.id);
  const inviteMutation = useOrgInviteMutation();
  const revokeMutation = useOrgInviteRevokeMutation();
  const removeMemberMutation = useOrgMemberRemoveMutation();

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const invites = rosterQuery.data?.invites ?? [];
  const members = rosterQuery.data?.members ?? [];

  const handleInvite = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setEmailFieldError(null);
      setSuccess(null);

      const parsed = teamInviteEmailSchema.safeParse(email);
      if (!parsed.success) {
        setEmailFieldError("Please enter a valid email address");
        return;
      }
      if (!org) return;

      inviteMutation.mutate(
        { orgId: org.id, email: parsed.data.toLowerCase(), inviteRole },
        {
          onSuccess: (_data, variables) => {
            setSuccess(`Invite sent to ${variables.email}`);
            setEmail("");
            setTimeout(() => setSuccess(null), 4000);
            if (org?.id) {
              logAudit(org.id, "team.invited", "org_invite", "", {
                email: variables.email,
              }).catch(() => {});
            }
          },
          onError: (err: unknown) => {
            const msg =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: string }).message)
                : String(err);
            if (msg.includes("duplicate")) setError("This email has already been invited");
            else setError(msg);
          },
        },
      );
    },
    [email, org, inviteRole, inviteMutation],
  );

  const revokeInvite = useCallback(
    (id: string) => {
      if (!org?.id) return;
      revokeMutation.mutate({ orgId: org.id, inviteId: id });
    },
    [revokeMutation, org?.id],
  );

  const removeMember = useCallback(
    (id: string, memberEmail?: string) => {
      if (!org?.id) return;
      removeMemberMutation.mutate(
        { orgId: org.id, memberId: id },
        {
          onSuccess: () => {
            logAudit(org.id, "team.removed", "org_member", id, {
              email: memberEmail,
            }).catch(() => {});
          },
        },
      );
    },
    [removeMemberMutation, org?.id],
  );

  const [resettingMfa, setResettingMfa] = useState<string | null>(null);

  const resetMfa = useCallback(
    async (targetUserId: string, memberEmail?: string) => {
      if (
        !confirm(
          `Reset MFA for ${memberEmail ?? "this user"}? They will need to re-enroll their authenticator on next login.`,
        )
      )
        return;

      setResettingMfa(targetUserId);
      const signal = nextFetchSignal();
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error("Not authenticated");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin/reset-mfa`,
          {
            method: "POST",
            signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ targetUserId }),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to reset MFA");
        }

        const data = await res.json();
        if (data.factorsRemoved > 0) {
          toast.success(
            `MFA reset for ${memberEmail ?? "user"} — ${data.factorsRemoved} factor(s) removed`,
          );
        } else {
          toast.info(`${memberEmail ?? "User"} has no MFA factors enrolled`);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to reset MFA");
      }
      setResettingMfa(null);
    },
    [nextFetchSignal],
  );

  if (role !== "admin") {
    return (
      <div className="text-center text-xs text-muted-foreground py-4">
        Only organisation admins can manage team members.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rosterQuery.isPending && <p className="text-[10px] text-muted-foreground">Loading team…</p>}

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
        <div className="flex gap-2 flex-wrap items-start">
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label htmlFor="team-invite-email" className="sr-only">
              Colleague email
            </Label>
            <Input
              id="team-invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailFieldError(null);
              }}
              placeholder="colleague@company.com"
              aria-invalid={!!emailFieldError}
              aria-describedby={emailFieldError ? "team-invite-email-error" : undefined}
              className="w-full"
            />
            {emailFieldError ? (
              <p id="team-invite-email-error" className="text-xs text-destructive" role="alert">
                {emailFieldError}
              </p>
            ) : null}
          </div>
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={inviteMutation.isPending} className="gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </Button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-xs text-[#EA0022] bg-[#EA0022]/5 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-xs text-[#007A5A] dark:text-[#00F2B3] bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 rounded-lg px-3 py-2">
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
                <Shield
                  className={`h-3 w-3 shrink-0 ${m.role === "admin" ? "text-brand-accent" : "text-muted-foreground"}`}
                />
                <span className="text-xs text-foreground flex-1 truncate">
                  {m.email ?? m.user_id}
                  {m.isYou && <span className="text-[9px] text-muted-foreground ml-1">(you)</span>}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                  {m.role}
                </span>
                {!m.isYou && (
                  <button
                    type="button"
                    onClick={() => resetMfa(m.user_id, m.email)}
                    disabled={resettingMfa === m.user_id}
                    className="text-muted-foreground hover:text-[#F29400] transition-colors disabled:opacity-50"
                    title="Reset MFA"
                  >
                    <KeyRound className="h-3 w-3" />
                  </button>
                )}
                {m.role !== "admin" && !m.isYou && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id, m.email)}
                    disabled={removeMemberMutation.isPending}
                    className="text-muted-foreground hover:text-[#EA0022] transition-colors"
                    title="Remove member"
                    aria-label="Remove member"
                  >
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
              <div
                key={inv.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F29400]/5"
              >
                <UserPlus className="h-3 w-3 text-[#F29400] shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{inv.email}</span>
                {inv.role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                    {inv.role}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(inv.id)}
                  disabled={revokeMutation.isPending}
                  className="text-muted-foreground hover:text-[#EA0022] transition-colors"
                  title="Revoke invite"
                  aria-label="Revoke invite"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Invited users will be automatically added to your organisation when they create their
        account with the same email.
      </p>
    </div>
  );
}
