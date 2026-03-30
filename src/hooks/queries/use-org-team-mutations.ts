import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgRole } from "@/hooks/use-auth";
import { queryKeys } from "./keys";

function invalidateTeamRoster(queryClient: ReturnType<typeof useQueryClient>, orgId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.org.teamRoster(orgId) });
}

export function useOrgInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; email: string; inviteRole: OrgRole }) => {
      const { error: err } = await supabase.from("org_invites").insert({
        org_id: payload.orgId,
        email: payload.email,
        role: payload.inviteRole,
      });
      if (err) throw err;
    },
    onSuccess: (_data, variables) => {
      invalidateTeamRoster(queryClient, variables.orgId);
    },
  });
}

export function useOrgInviteRevokeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; inviteId: string }) => {
      const { error } = await supabase.from("org_invites").delete().eq("id", payload.inviteId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidateTeamRoster(queryClient, variables.orgId);
    },
  });
}

export function useOrgMemberRemoveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { orgId: string; memberId: string }) => {
      const { error: delErr } = await supabase
        .from("org_members")
        .delete()
        .eq("id", payload.memberId);
      if (delErr) throw delErr;
    },
    onSuccess: (_data, variables) => {
      invalidateTeamRoster(queryClient, variables.orgId);
    },
  });
}
