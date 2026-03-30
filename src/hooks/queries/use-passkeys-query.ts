import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

export interface PasskeyCredentialRow {
  id: string;
  credential_id: string;
  device_type: string;
  name: string;
  created_at: string;
}

export function usePasskeysQuery() {
  return useQuery({
    queryKey: queryKeys.passkeys.list(),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabaseWithAbort(
        supabase
          .from("passkey_credentials")
          .select("id, credential_id, device_type, name, created_at")
          .order("created_at", { ascending: false }),
        signal,
      );
      if (error) throw error;
      return (data ?? []) as PasskeyCredentialRow[];
    },
  });
}
