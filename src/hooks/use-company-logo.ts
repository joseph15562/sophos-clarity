import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  fetchOrganisationCompanyLogo,
  updateOrganisationCompanyLogo,
} from "@/lib/data/company-logo";

const LS_KEY_PREFIX = "fc-company-logo-";

function lsKey(orgId: string) {
  return `${LS_KEY_PREFIX}${orgId}`;
}

function readLs(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Manages the org-level company logo.
 *
 * Authenticated users: persisted to `organisations.report_template.company_logo`
 * and cached in localStorage. Guest users: localStorage only.
 */
export function useCompanyLogo() {
  const { org, isGuest, canManageTeam } = useAuth();
  const orgId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [guestLogo, setGuestLogo] = useState<string | null>(() => readLs(lsKey("guest")));

  useEffect(() => {
    if (!isGuest) return;
    setGuestLogo(readLs(lsKey("guest")));
  }, [isGuest]);

  const logoQuery = useQuery({
    queryKey: queryKeys.org.companyLogo(orgId),
    queryFn: async ({ signal }) => {
      const cached = readLs(lsKey(orgId));
      const dbLogo = await fetchOrganisationCompanyLogo(orgId, signal);
      if (dbLogo) {
        try {
          localStorage.setItem(lsKey(orgId), dbLogo);
        } catch {
          /* ignore quota */
        }
        return dbLogo;
      }
      return cached;
    },
    enabled: Boolean(!isGuest && orgId),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const key = orgId ? lsKey(orgId) : lsKey("guest");
      if (dataUrl) localStorage.setItem(key, dataUrl);
      else localStorage.removeItem(key);
      if (isGuest || !orgId) return;
      await updateOrganisationCompanyLogo(orgId, dataUrl);
    },
    onSuccess: (_void, dataUrl) => {
      if (orgId) queryClient.setQueryData(queryKeys.org.companyLogo(orgId), dataUrl);
    },
  });

  const logoUrl = isGuest ? guestLogo : (logoQuery.data ?? null);
  const setLogo = useCallback(
    async (dataUrl: string | null) => {
      if (isGuest) {
        const key = lsKey("guest");
        if (dataUrl) localStorage.setItem(key, dataUrl);
        else localStorage.removeItem(key);
        setGuestLogo(dataUrl);
        return;
      }
      if (orgId) queryClient.setQueryData(queryKeys.org.companyLogo(orgId), dataUrl);
      try {
        await saveMutation.mutateAsync(dataUrl);
      } catch (err) {
        console.warn("[useCompanyLogo] save failed", err);
        void queryClient.invalidateQueries({ queryKey: queryKeys.org.companyLogo(orgId) });
      }
    },
    [isGuest, orgId, queryClient, saveMutation],
  );

  return {
    logoUrl,
    setLogo,
    loading: !isGuest && orgId ? logoQuery.isPending : false,
    saving: saveMutation.isPending,
    canEdit: canManageTeam || isGuest,
  };
}
