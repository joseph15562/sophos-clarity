import { useQuery } from "@tanstack/react-query";
import { fetchLatestSubmissionsForAgentIds } from "@/lib/data/agent-submissions-latest";
import { queryKeys } from "./keys";

function fingerprintAgentIds(agentIds: string[]): string {
  return [...new Set(agentIds)].filter(Boolean).sort().join("\0");
}

/** Batched latest submission per agent for AgentFleetPanel (abortable via Query signal). */
export function useAgentSubmissionsLatestBatchQuery(orgId: string | null, agentIds: string[]) {
  const sortedUnique = [...new Set(agentIds)].filter(Boolean).sort();
  const fp = fingerprintAgentIds(sortedUnique);
  return useQuery({
    queryKey: queryKeys.org.agentSubmissionsLatestBatch(orgId ?? "", fp),
    queryFn: ({ signal }) => fetchLatestSubmissionsForAgentIds(orgId!, sortedUnique, signal),
    enabled: Boolean(orgId && sortedUnique.length > 0),
    staleTime: 30_000,
  });
}
