import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Server,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveCustomerName } from "@/lib/customer-name";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { MSP_STALE_ASSESSMENT_DAYS, MSP_ATTENTION_DOC } from "@/lib/msp-attention";

type Props = {
  orgId: string;
  orgName: string;
};

type StaleRow = { customer: string; daysSince: number; score: number };
type AgentRow = { id: string; label: string; status: string; detail?: string | null };
type LowScoreRow = { customer: string; score: number };

export function MspAttentionSurface({ orgId, orgName }: Props) {
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState<StaleRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [lowScores, setLowScores] = useState<LowScoreRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [assessRes, agentRes] = await Promise.all([
          supabase
            .from("assessments")
            .select("customer_name, overall_score, created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false }),
          supabase
            .from("agents")
            .select("id, name, customer_name, status, error_message, last_seen_at")
            .eq("org_id", orgId),
        ]);
        if (cancelled) return;

        const assessRows = assessRes.data ?? [];
        const now = Date.now();
        const staleMs = MSP_STALE_ASSESSMENT_DAYS * 86_400_000;

        const byCustomer = new Map<string, { created_at: string; overall_score: number }>();
        for (const a of assessRows) {
          const key = resolveCustomerName(String(a.customer_name ?? ""), orgName);
          if (!byCustomer.has(key)) {
            byCustomer.set(key, {
              created_at: a.created_at as string,
              overall_score: Number(a.overall_score ?? 0),
            });
          }
        }

        const staleList: StaleRow[] = [];
        for (const [customer, v] of byCustomer) {
          const age = now - new Date(v.created_at).getTime();
          if (age > staleMs) {
            staleList.push({
              customer,
              daysSince: Math.floor(age / 86_400_000),
              score: v.overall_score,
            });
          }
        }
        staleList.sort((a, b) => b.daysSince - a.daysSince);

        const agentRows = (agentRes.data ?? []) as Array<{
          id: string;
          name: string;
          customer_name: string;
          status: string;
          error_message: string | null;
          last_seen_at: string | null;
        }>;
        const badAgents: AgentRow[] = [];
        for (const ag of agentRows) {
          const st = (ag.status || "").toLowerCase();
          if (st === "error" || ag.error_message) {
            badAgents.push({
              id: ag.id,
              label: `${ag.name || "Agent"}${ag.customer_name ? ` · ${ag.customer_name}` : ""}`,
              status: "error",
              detail: ag.error_message,
            });
          } else if (st !== "online") {
            badAgents.push({
              id: ag.id,
              label: `${ag.name || "Agent"}${ag.customer_name ? ` · ${ag.customer_name}` : ""}`,
              status: st || "offline",
              detail: ag.last_seen_at
                ? `Last seen ${new Date(ag.last_seen_at).toLocaleDateString()}`
                : null,
            });
          }
        }

        const low: LowScoreRow[] = Array.from(byCustomer.entries())
          .map(([customer, v]) => ({ customer, score: v.overall_score }))
          .filter((r) => r.score < 55)
          .sort((a, b) => a.score - b.score)
          .slice(0, 5);

        setStale(staleList.slice(0, 6));
        setAgents(badAgents.slice(0, 6));
        setLowScores(low);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, orgName]);

  const healthy = useMemo(
    () => !loading && stale.length === 0 && agents.length === 0 && lowScores.length === 0,
    [loading, stale.length, agents.length, lowScores.length],
  );

  const agentsSearch = buildManagePanelSearch({ panel: "settings", section: "agents" });

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace signals…
      </div>
    );
  }

  if (healthy) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#00F2B3]/30 bg-[#00F2B3]/5 px-4 py-3 text-sm dark:border-[#00F2B3]/20 dark:bg-[#00F2B3]/10"
        title={MSP_ATTENTION_DOC}
      >
        <CheckCircle2 className="h-4 w-4 text-[#007A5A] dark:text-[#00F2B3]" />
        <span className="text-foreground/90">
          No urgent portfolio signals — assessments look recent and agents are OK.
        </span>
        <Link
          to="/command"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
        >
          Open Fleet <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mb-4 space-y-3 rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm"
      title={MSP_ATTENTION_DOC}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          What needs attention
        </h2>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <Link to="/command" className="text-[#2006F7] hover:underline dark:text-[#00EDFF]">
            Fleet
          </Link>
          <Link to="/customers" className="text-[#2006F7] hover:underline dark:text-[#00EDFF]">
            Customers
          </Link>
          <Link to="/insights" className="text-[#2006F7] hover:underline dark:text-[#00EDFF]">
            Insights
          </Link>
        </div>
      </div>

      {stale.length > 0 && (
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Stale assessments (&gt;{MSP_STALE_ASSESSMENT_DAYS}d)
          </p>
          <ul className="space-y-1">
            {stale.map((r) => (
              <li
                key={r.customer}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  <span className="font-medium text-foreground">{r.customer}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.daysSince}d ago · score {r.score}
                  </span>
                </span>
                <Link
                  to={`/?${new URLSearchParams({ customer: r.customer }).toString()}`}
                  className="inline-flex items-center gap-0.5 text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                >
                  Assess <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agents.length > 0 && (
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5 text-[#EA0022]" />
            Agents offline or error
          </p>
          <ul className="space-y-1">
            {agents.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  <span className="font-medium text-foreground">{a.label}</span>
                  <span className="text-muted-foreground capitalize"> · {a.status}</span>
                  {a.detail ? (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {a.detail}
                    </span>
                  ) : null}
                </span>
                <Link
                  to={{ pathname: "/", search: agentsSearch }}
                  className="shrink-0 text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                >
                  Agent settings
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lowScores.length > 0 && (
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
            Lowest scores
          </p>
          <ul className="space-y-1">
            {lowScores.map((r) => (
              <li
                key={r.customer}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  <span className="font-medium text-foreground">{r.customer}</span>
                  <span className="text-muted-foreground"> · score {r.score}</span>
                </span>
                <Link
                  to={`/?${new URLSearchParams({ customer: r.customer }).toString()}`}
                  className="text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
