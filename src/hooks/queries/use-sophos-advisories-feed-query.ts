import { useQuery } from "@tanstack/react-query";
import { fetchSophosAdvisoriesThreatCards } from "@/lib/sophos-advisories-feed";
import { queryKeys } from "@/hooks/queries/keys";
import type { ThreatIntelCard } from "@/lib/mock-data";

const CHANGELOG_ADVISORY_LIMIT = 48;

/** Changelog “Latest threats” — Sophos Security Advisories RSS (Edge Function proxy). */
export function useSophosAdvisoriesFeedQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sophosAdvisories.changelogFeed(CHANGELOG_ADVISORY_LIMIT),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<ThreatIntelCard[]> => {
      return fetchSophosAdvisoriesThreatCards(signal, CHANGELOG_ADVISORY_LIMIT);
    },
  });
}
