import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  persistRemediationDelta,
  setPlaybookRemediationRow,
  type RemediationDeltaPayload,
} from "@/lib/data/remediation-status";
import { queryKeys } from "./keys";

/** Batch add/remove remediation_status rows (assessment playbooks panel). */
export function useRemediationDeltaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: persistRemediationDelta,
    onSettled: (_d, _e, variables) => {
      if (variables) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.org.remediationStatus(variables.orgId),
        });
      }
    },
  });
}

/** Single playbook toggle (library page). */
export function useRemediationPlaybookToggleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPlaybookRemediationRow,
    onSettled: (_d, _e, vars) => {
      if (vars) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.org.remediationStatus(vars.orgId),
        });
      }
    },
  });
}

export type { RemediationDeltaPayload };
