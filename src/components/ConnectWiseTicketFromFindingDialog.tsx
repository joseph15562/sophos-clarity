import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stable per-finding key for idempotent ticket creation */
  idempotencyKey: string;
  summary: string;
  description?: string;
  /** Resolved FireComply customer name (Customers page); used for PSA company mapping. */
  firecomplyCustomerKey?: string;
}

export function ConnectWiseTicketFromFindingDialog({
  open,
  onOpenChange,
  idempotencyKey,
  summary,
  description,
  firecomplyCustomerKey,
}: Props) {
  const { org } = useAuth();
  const [customerCompanyId, setCustomerCompanyId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open || !org?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("connectwise_manage_credentials")
        .select("default_board_id, default_status_id")
        .eq("org_id", org.id)
        .maybeSingle();
      setConfigured(!!data);
      if (data) {
        setBoardId(String(data.default_board_id ?? ""));
        setStatusId(String(data.default_status_id ?? 1));
      }
      const key = firecomplyCustomerKey?.trim();
      if (key) {
        const { data: mapRow } = await supabase
          .from("psa_customer_company_map")
          .select("company_id")
          .eq("org_id", org.id)
          .eq("provider", "connectwise_manage")
          .eq("customer_key", key)
          .maybeSingle();
        if (mapRow?.company_id != null) {
          setCustomerCompanyId(String(mapRow.company_id));
        }
      } else {
        setCustomerCompanyId("");
      }
    })();
  }, [open, org?.id, firecomplyCustomerKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const cid = parseInt(customerCompanyId, 10);
    const fcKey = firecomplyCustomerKey?.trim() ?? "";
    const body: Record<string, unknown> = {
      summary,
      idempotencyKey,
      initialDescription: description,
    };
    if (Number.isFinite(cid)) {
      body.customerCompanyId = cid;
    } else if (fcKey) {
      body.firecomplyCustomerKey = fcKey;
    } else {
      toast.error("Enter the Manage company ID or add a PSA customer mapping for this customer.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
      const b = parseInt(boardId, 10);
      const s = parseInt(statusId, 10);
      if (Number.isFinite(b)) body.boardId = b;
      if (Number.isFinite(s)) body.statusId = s;

      const res = await fetch(`${base}/connectwise-manage/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof resBody.error === "string" ? resBody.error : `HTTP ${res.status}`);
      }
      const tid = resBody.ticket_id;
      const deduped = !!resBody.deduped;
      toast.success(
        deduped
          ? `Existing ticket ${tid} (same idempotency key).`
          : `Service ticket ${tid} created in ConnectWise Manage.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create ticket");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle className="text-sm">Create ConnectWise Manage ticket</DialogTitle>
            <DialogDescription className="text-xs text-left space-y-2">
              {configured === false && (
                <span className="block text-amber-700 dark:text-amber-400">
                  Configure ConnectWise Manage under Settings → PSA &amp; API automation first.
                </span>
              )}
              <span className="block text-muted-foreground">
                Uses your org defaults for board/status unless overridden. The same finding key will
                not create duplicate tickets.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-foreground">Summary</label>
              <p className="text-xs text-foreground rounded-md border border-border bg-muted/30 px-2 py-1.5">
                {summary}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-foreground">
                Customer company ID (Manage)
              </label>
              {firecomplyCustomerKey?.trim() && (
                <p className="text-[10px] text-muted-foreground">
                  Leave empty to use the saved mapping for &quot;{firecomplyCustomerKey.trim()}
                  &quot;.
                </p>
              )}
              <Input
                className="h-8 text-xs"
                value={customerCompanyId}
                onChange={(e) => setCustomerCompanyId(e.target.value)}
                placeholder="e.g. 178 (or leave empty to use PSA mapping)"
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Board ID (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  inputMode="numeric"
                  placeholder="Default from settings"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Status ID (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  inputMode="numeric"
                  placeholder="Default from settings"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || configured === false}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
