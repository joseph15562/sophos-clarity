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
  idempotencyKey: string;
  title: string;
  description?: string;
  firecomplyCustomerKey?: string;
}

export function AutotaskTicketFromFindingDialog({
  open,
  onOpenChange,
  idempotencyKey,
  title,
  description,
  firecomplyCustomerKey,
}: Props) {
  const { org } = useAuth();
  const [companyId, setCompanyId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open || !org?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("autotask_psa_credentials")
        .select(
          "default_queue_id, default_priority, default_status, default_source, default_ticket_type",
        )
        .eq("org_id", org.id)
        .maybeSingle();
      setConfigured(!!data);
      if (data) {
        setQueueId(String(data.default_queue_id ?? ""));
        setPriority(String(data.default_priority ?? ""));
        setStatus(String(data.default_status ?? ""));
        setSource(String(data.default_source ?? ""));
        setTicketType(String(data.default_ticket_type ?? ""));
      }
      const key = firecomplyCustomerKey?.trim();
      if (key) {
        const { data: mapRow } = await supabase
          .from("psa_customer_company_map")
          .select("company_id")
          .eq("org_id", org.id)
          .eq("provider", "autotask")
          .eq("customer_key", key)
          .maybeSingle();
        if (mapRow?.company_id != null) {
          setCompanyId(String(mapRow.company_id));
        }
      } else {
        setCompanyId("");
      }
    })();
  }, [open, org?.id, firecomplyCustomerKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const cid = parseInt(companyId, 10);
    const fcKey = firecomplyCustomerKey?.trim() ?? "";
    const body: Record<string, unknown> = {
      title,
      idempotencyKey,
      description: description ?? "",
    };
    if (Number.isFinite(cid)) {
      body.companyId = cid;
    } else if (fcKey) {
      body.firecomplyCustomerKey = fcKey;
    } else {
      toast.error("Enter the Autotask company ID or add a PSA mapping for this customer.");
      return;
    }
    const q = parseInt(queueId, 10);
    const pr = parseInt(priority, 10);
    const st = parseInt(status, 10);
    const so = parseInt(source, 10);
    const tt = parseInt(ticketType, 10);
    if (Number.isFinite(q)) body.queueId = q;
    if (Number.isFinite(pr)) body.priority = pr;
    if (Number.isFinite(st)) body.status = st;
    if (Number.isFinite(so)) body.source = so;
    if (Number.isFinite(tt)) body.ticketType = tt;

    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

      const res = await fetch(`${base}/autotask-psa/tickets`, {
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
          : `Ticket ${tid} created in Autotask PSA.`,
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
            <DialogTitle className="text-sm">Create Autotask PSA ticket</DialogTitle>
            <DialogDescription className="text-xs text-left space-y-2">
              {configured === false && (
                <span className="block text-amber-700 dark:text-amber-400">
                  Configure Autotask PSA under Settings → PSA &amp; API automation first.
                </span>
              )}
              <span className="block text-muted-foreground">
                Uses your org defaults for queue, priority, status, source, and ticket type unless
                overridden. The same finding key will not create duplicate tickets.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-foreground">Title</label>
              <p className="text-xs text-foreground rounded-md border border-border bg-muted/30 px-2 py-1.5">
                {title}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-foreground">
                Company ID (Autotask account)
              </label>
              {firecomplyCustomerKey?.trim() && (
                <p className="text-[10px] text-muted-foreground">
                  Leave empty to use the saved mapping for &quot;{firecomplyCustomerKey.trim()}
                  &quot;.
                </p>
              )}
              <Input
                className="h-8 text-xs"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="e.g. 12345 (or leave empty to use PSA mapping)"
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Queue (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={queueId}
                  onChange={(e) => setQueueId(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Priority (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Status (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Source (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] text-muted-foreground">Ticket type (optional)</label>
                <Input
                  className="h-8 text-xs"
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  inputMode="numeric"
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
