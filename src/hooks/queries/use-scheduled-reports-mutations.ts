import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "./keys";

type ScheduledReportInsert = Database["public"]["Tables"]["scheduled_reports"]["Insert"];

function invalidateScheduled(queryClient: ReturnType<typeof useQueryClient>, orgId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.org.scheduledReports(orgId) });
}

export function useScheduledReportCreateMutation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: ScheduledReportInsert) => {
      const { error } = await supabase.from("scheduled_reports").insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduled(queryClient, orgId),
  });
}

export function useScheduledReportToggleMutation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("scheduled_reports")
        .update({ enabled: !payload.enabled })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduled(queryClient, orgId),
  });
}

export function useScheduledReportDeleteMutation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduled(queryClient, orgId),
  });
}
