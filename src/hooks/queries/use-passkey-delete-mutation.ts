import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./keys";
import { toast } from "sonner";

export function usePasskeyDeleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("passkey_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.passkeys.list() });
      toast.success("Passkey removed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not remove passkey");
    },
  });
}
