import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

export interface OrgTeamInviteRow {
  id: string;
  email: string;
  role?: string;
  created_at: string;
}

export interface OrgTeamMemberRow {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
  isYou?: boolean;
}

export async function fetchOrgTeamRoster(
  orgId: string,
  signal?: AbortSignal,
): Promise<{
  invites: OrgTeamInviteRow[];
  members: OrgTeamMemberRow[];
}> {
  const [inviteRes, memberRes, sessionRes] = await Promise.all([
    supabaseWithAbort(
      supabase
        .from("org_invites")
        .select("id, email, role, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
      signal,
    ),
    supabaseWithAbort(
      supabase
        .from("org_members")
        .select("id, user_id, role, joined_at")
        .eq("org_id", orgId)
        .order("joined_at", { ascending: true }),
      signal,
    ),
    supabase.auth.getUser(),
  ]);

  const invites = (inviteRes.data ?? []) as OrgTeamInviteRow[];
  const memberRows = memberRes.data ?? [];
  const currentUser = sessionRes.data?.user;

  const members: OrgTeamMemberRow[] = memberRows.map((m) => ({
    ...m,
    email: currentUser && m.user_id === currentUser.id ? currentUser.email : undefined,
    isYou: currentUser ? m.user_id === currentUser.id : false,
  }));

  for (const m of members) {
    if (!m.email) {
      const matchingInvite = invites.find(
        (inv) => members.filter((em) => em.email === inv.email).length === 0,
      );
      if (matchingInvite) m.email = matchingInvite.email;
    }
  }

  return { invites, members };
}

export function useOrgTeamRosterQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: orgId ? queryKeys.org.teamRoster(orgId) : ["org", "none", "team_roster"],
    queryFn: ({ signal }) => fetchOrgTeamRoster(orgId!, signal),
    enabled: Boolean(orgId),
  });
}
