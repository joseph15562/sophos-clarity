import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

export interface ScheduledReportRow {
  id: string;
  org_id: string;
  name: string;
  schedule: "weekly" | "monthly" | "quarterly";
  recipients: string[];
  report_type: "one-pager" | "executive" | "compliance";
  customer_name: string | null;
  include_sections: Record<string, boolean>;
  enabled: boolean;
  last_sent_at: string | null;
  next_due_at: string;
  created_at: string;
}

export function useScheduledReportsQuery(orgId: string) {
  return useQuery({
    queryKey: queryKeys.org.scheduledReports(orgId),
    enabled: Boolean(orgId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabaseWithAbort(
        supabase
          .from("scheduled_reports")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
        signal,
      );
      if (error) throw error;
      return (data as unknown as ScheduledReportRow[]) ?? [];
    },
  });
}
