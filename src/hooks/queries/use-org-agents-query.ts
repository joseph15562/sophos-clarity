import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./keys";

interface Agent {
  id: string;
  name: string;
  customer_name: string;
  tenant_name: string | null;
  serial_number: string | null;
  hardware_model: string | null;
  status: string;
  last_seen_at: string | null;
  last_score: number | null;
  last_grade: string | null;
  firmware_version: string | null;
}

async function fetchOrgAgents(orgId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, name, customer_name, tenant_name, serial_number, hardware_model, status, last_seen_at, last_score, last_grade, firmware_version",
    )
    .eq("org_id", orgId)
    .order("customer_name")
    .limit(500);

  if (error) throw error;
  return (data ?? []) as Agent[];
}

export function useOrgAgentsQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.org.agents(orgId ?? ""),
    queryFn: () => fetchOrgAgents(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
