import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savePortalConfigRow, type PortalConfigSaveRow } from "@/lib/data/portal-config-save";
import { queryKeys } from "./keys";

export type PortalConfigSaveVariables = {
  orgId: string;
  configId?: string;
  row: PortalConfigSaveRow;
};

export function usePortalConfigSaveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: PortalConfigSaveVariables) => {
      return savePortalConfigRow({ id: vars.configId, row: vars.row });
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.portal.tenantBootstrap(variables.orgId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.configs(variables.orgId) });
    },
  });
}
