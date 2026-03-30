import { useQuery } from "@tanstack/react-query";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  analysisResultsFingerprint,
  fetchClientPortalPreviewData,
} from "@/lib/management-drawer-client-preview";
import { queryKeys } from "@/hooks/queries/keys";

export function useManagementDrawerClientPreviewQuery(args: {
  enabled: boolean;
  isGuest: boolean;
  orgId: string | undefined;
  analysisResults: Record<string, AnalysisResult>;
}) {
  const { enabled, isGuest, orgId, analysisResults } = args;
  const orgKey = orgId ?? "guest";
  const fingerprint = analysisResultsFingerprint(analysisResults);

  return useQuery({
    queryKey: queryKeys.org.clientPortalPreview(orgKey, isGuest, fingerprint),
    enabled,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchClientPortalPreviewData({
        isGuest,
        orgId,
        analysisResults,
        signal,
      }),
  });
}
