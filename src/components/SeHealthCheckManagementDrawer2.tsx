import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, LogOut, Mail, PanelRight, Plus, Send, Star, Trash2, UserMinus, Users, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSEAuth, type SEProfile } from "@/hooks/use-se-auth";
import { useActiveTeam, type SETeam } from "@/hooks/use-active-team";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
};

function defaultDraftFromProfile(p: SEProfile): string {
  return p.healthCheckPreparedBy?.trim() || p.displayName?.trim() || p.email?.trim() || "";
}

interface TeamMember {
  id: string;
  se_profile_id: string;
  role: string;
  email?: string;
  display_name?: string;
}

interface PendingInvite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

async function apiCall(path: string, method: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function SeHealthCheckManagementDrawer({ open, onClose }: Props) {
  const { seProfile, reloadSeProfile } = useSEAuth();
  const { teams, reload: reloadTeams } = useActiveTeam();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Team creation
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Team detail
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Email invites
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  useEffect(() => {
    if (!open || !seProfile) return;
    setDraft(defaultDraftFromProfile(seProfile));
  }, [open, seProfile?.id, seProfile?.healthCheckPreparedBy, seProfile?.displayName, seProfile?.email]);

  const handleSave = async () => {
    if (!seProfile) return;
    const trimmed = draft.trim();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("se_profiles")
        .update({ health_check_prepared_by: trimmed || null } as Record<string, unknown>)
        .eq("id", seProfile.id);
      if (error) throw error;
      await reloadSeProfile();
      toast.success("Report settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTeam = useCallback(async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const result = await apiCall("se-teams", "POST", { name: newTeamName.trim() });
      toast.success(`Team "${result.name}" created.`);
      setNewTeamName("");
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create team.");
    } finally {
      setCreatingTeam(false);
    }
  }, [newTeamName, reloadTeams]);

  const fetchMembers = useCallback(async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const result = await apiCall(`se-teams/${teamId}/members`, "GET");
      setTeamMembers(result.data ?? []);
    } catch {
      setTeamMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchPendingInvites = useCallback(async (teamId: string) => {
    setLoadingInvites(true);
    try {
      const result = await apiCall(`se-teams/${teamId}/invites`, "GET");
      setPendingInvites(result.data ?? []);
    } catch {
      setPendingInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  const toggleExpand = useCallback((team: SETeam) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
    } else {
      setExpandedTeamId(team.id);
      setRenameDraft(team.name);
      setInviteEmail("");
      void fetchMembers(team.id);
      if (team.role === "admin") void fetchPendingInvites(team.id);
    }
  }, [expandedTeamId, fetchMembers, fetchPendingInvites]);

  const handleSetPrimary = useCallback(async (teamId: string) => {
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}/set-primary`, "POST");
      toast.success("Primary team updated.");
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }, [reloadTeams]);

  const handleLeaveTeam = useCallback(async (teamId: string) => {
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}/leave`, "POST");
      toast.success("Left team.");
      setExpandedTeamId(null);
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not leave team.");
    } finally {
      setBusy(false);
    }
  }, [reloadTeams]);

  const handleRenameTeam = useCallback(async (teamId: string) => {
    if (!renameDraft.trim()) return;
    setRenaming(true);
    try {
      await apiCall(`se-teams/${teamId}`, "PATCH", { name: renameDraft.trim() });
      toast.success("Team renamed.");
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setRenaming(false);
    }
  }, [renameDraft, reloadTeams]);

  const handleSendInvite = useCallback(async (teamId: string) => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      await apiCall(`se-teams/${teamId}/invite`, "POST", { email: inviteEmail.trim() });
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      void fetchPendingInvites(teamId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invite.");
    } finally {
      setSendingInvite(false);
    }
  }, [inviteEmail, fetchPendingInvites]);

  const handleRevokeInvite = useCallback(async (teamId: string, inviteId: string) => {
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}/invites/${inviteId}`, "DELETE");
      toast.success("Invite revoked.");
      void fetchPendingInvites(teamId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke.");
    } finally {
      setBusy(false);
    }
  }, [fetchPendingInvites]);

  const handleTransferAdmin = useCallback(async (teamId: string, targetProfileId: string) => {
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}/transfer-admin`, "POST", { target_se_profile_id: targetProfileId });
      toast.success("Admin role transferred.");
      await reloadTeams();
      void fetchMembers(teamId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  }, [reloadTeams, fetchMembers]);

  const handleRemoveMember = useCallback(async (teamId: string, memberId: string) => {
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}/members/${memberId}`, "DELETE");
      toast.success("Member removed.");
      void fetchMembers(teamId);
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }, [fetchMembers, reloadTeams]);

  const handleDeleteTeam = useCallback(async (teamId: string) => {
    if (!confirm("Delete this team? Health checks will move to Personal.")) return;
    setBusy(true);
    try {
      await apiCall(`se-teams/${teamId}`, "DELETE");
      toast.success("Team deleted.");
      setExpandedTeamId(null);
      await reloadTeams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }, [reloadTeams]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
          <div className="h-9 w-9 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0">
            <PanelRight className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-display font-bold text-foreground truncate">Management</h2>
            <p className="text-[10px] text-muted-foreground">Report defaults &amp; team management</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {!seProfile ? (
            <p className="text-sm text-muted-foreground">Sign in to manage report settings.</p>
          ) : (
            <>
              {/* Prepared by */}
              <div className="space-y-2">
                <Label htmlFor="se-mgmt-prepared-by" className="text-xs font-semibold">
                  Prepared by
                </Label>
                <Input
                  id="se-mgmt-prepared-by"
                  className="rounded-lg text-sm h-10"
                  placeholder="Name as it should appear on exports"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Stored in your FireComply profile and used for PDF, HTML, and history exports. Leave blank to fall back to
                  your account display name or email.
                </p>
                <Button
                  type="button"
                  className="rounded-lg bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>

              <hr className="border-border" />

              {/* Teams section */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
                  Teams
                </h3>

                {/* My teams list */}
                {teams.length > 0 ? (
                  <div className="space-y-2">
                    {teams.map((team) => {
                      const expanded = expandedTeamId === team.id;
                      return (
                        <div key={team.id} className="rounded-lg border border-border bg-card overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                            onClick={() => toggleExpand(team)}
                          >
                            <Users className="h-3.5 w-3.5 shrink-0 text-[#2006F7] dark:text-[#00EDFF]" />
                            <span className="flex-1 text-sm font-medium truncate">{team.name}</span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {team.role === "admin" ? "Admin" : "Member"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground shrink-0">{team.member_count} member{team.member_count !== 1 ? "s" : ""}</span>
                            {team.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                          </button>

                          {expanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                              {/* Set primary */}
                              {!team.is_primary && (
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={busy} onClick={() => void handleSetPrimary(team.id)}>
                                  <Star className="h-3 w-3" /> Set as default
                                </Button>
                              )}

                              {/* Admin actions */}
                              {team.role === "admin" && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Input className="h-8 text-xs flex-1" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
                                    <Button type="button" size="sm" className="h-8 text-xs" disabled={renaming || !renameDraft.trim() || renameDraft.trim() === team.name}
                                      onClick={() => void handleRenameTeam(team.id)}>
                                      {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rename"}
                                    </Button>
                                  </div>

                                  {/* Invite member by email */}
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> Invite member
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        className="h-8 text-xs flex-1"
                                        placeholder="colleague@sophos.com"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && void handleSendInvite(team.id)}
                                      />
                                      <Button type="button" size="sm" className="h-8 text-xs gap-1" disabled={sendingInvite || !inviteEmail.trim()}
                                        onClick={() => void handleSendInvite(team.id)}>
                                        {sendingInvite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                        Send
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Pending invites */}
                                  {loadingInvites ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : pendingInvites.length > 0 && (
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">Pending invites</Label>
                                      {pendingInvites.map((inv) => (
                                        <div key={inv.id} className="flex items-center gap-2 text-xs py-1">
                                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <span className="flex-1 truncate">{inv.email}</span>
                                          <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-destructive" disabled={busy}
                                            title="Revoke invite"
                                            onClick={() => void handleRevokeInvite(team.id, inv.id)}>
                                            <XCircle className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive" disabled={busy}
                                    onClick={() => void handleDeleteTeam(team.id)}>
                                    <Trash2 className="h-3 w-3" /> Delete team
                                  </Button>
                                </div>
                              )}

                              {/* Members list */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Members</Label>
                                {loadingMembers ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <div className="space-y-1">
                                    {teamMembers.map((m) => (
                                      <div key={m.id} className="flex items-center gap-2 text-xs py-1">
                                        <span className="flex-1 truncate">{m.display_name || m.email || m.se_profile_id}</span>
                                        <Badge variant="secondary" className="text-[9px]">{m.role}</Badge>
                                        {team.role === "admin" && m.se_profile_id !== seProfile?.id && (
                                          <div className="flex gap-1">
                                            {m.role !== "admin" && (
                                              <Button type="button" variant="ghost" size="sm" className="h-6 px-1" disabled={busy}
                                                title="Transfer admin"
                                                onClick={() => void handleTransferAdmin(team.id, m.se_profile_id)}>
                                                <Crown className="h-3 w-3" />
                                              </Button>
                                            )}
                                            <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-destructive" disabled={busy}
                                              title="Remove member"
                                              onClick={() => void handleRemoveMember(team.id, m.id)}>
                                              <UserMinus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Leave */}
                              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={busy}
                                onClick={() => void handleLeaveTeam(team.id)}>
                                <LogOut className="h-3 w-3" /> Leave team
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">You are not in any teams yet. Create one or ask a team admin to invite you.</p>
                )}

                {/* Create team */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground font-semibold">Create team</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 text-xs flex-1"
                      placeholder="Team name (e.g. Enterprise)"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleCreateTeam()}
                    />
                    <Button type="button" size="sm" className="h-8 text-xs gap-1" disabled={creatingTeam || !newTeamName.trim()} onClick={() => void handleCreateTeam()}>
                      {creatingTeam ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Create
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
