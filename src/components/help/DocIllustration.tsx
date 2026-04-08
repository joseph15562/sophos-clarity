import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DocIllustrationId } from "@/data/doc-illustration-id";

export type { DocIllustrationId };

const frame =
  "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br shadow-elevated";

function BrowserChrome({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/90 shadow-inner",
        "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2.5 sm:px-4">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        <div className="ml-1 flex-1 rounded-md bg-background/80 px-2.5 py-1 text-[10px] text-muted-foreground font-mono truncate sm:text-[11px]">
          firecomply.app
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

/** Assess Overview tab: score, critical actions, widget tiles. */
function AssessOverviewTabArt() {
  return (
    <div className="flex gap-3 py-1">
      <div className="w-[4.5rem] shrink-0 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-gradient-to-b from-brand-accent/12 to-background p-2">
        <div className="relative h-11 w-11">
          <svg
            viewBox="0 0 36 36"
            className="h-full w-full -rotate-90 text-brand-accent/45"
            aria-hidden
          >
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              opacity={0.2}
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="66 22"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[13px] font-black tabular-nums text-foreground">
            72
          </span>
        </div>
        <div className="text-[5.5px] font-bold uppercase text-muted-foreground mt-1 text-center leading-tight">
          Risk score
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[6.5px] font-semibold text-rose-900 dark:text-rose-200">
          Critical actions · 2 open
        </div>
        <div className="grid grid-cols-2 gap-1">
          {["Posture", "Frameworks"].map((l) => (
            <div key={l} className="h-9 rounded border border-border/50 bg-muted/25 p-1">
              <div className="h-1 w-10 rounded bg-foreground/18 mb-0.5" />
              <div className="h-1 w-full rounded bg-foreground/08" />
              <div className="text-[5px] text-muted-foreground mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocsHomeArt() {
  return (
    <div className="grid grid-cols-2 gap-2 py-0.5">
      <div className="space-y-1">
        <div className="text-[6.5px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">
          Workspace docs
        </div>
        {[
          "Portfolio & customers",
          "Assessment & trends",
          "Reports & playbooks",
          "Central, API & ops",
        ].map((t) => (
          <div
            key={t}
            className="flex items-center gap-1.5 rounded-md border border-border/55 bg-card/85 px-1.5 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent/65 shrink-0" />
            <span className="text-[6.5px] font-medium text-foreground leading-tight">{t}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="text-[6.5px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">
          Assess & more
        </div>
        <div className="rounded-md border border-dashed border-brand-accent/35 bg-brand-accent/[0.06] px-2 py-1.5 text-[6px] text-muted-foreground leading-snug">
          Per-tab articles with <span className="font-mono text-foreground/80">?tab=</span> deep
          links
        </div>
        <div className="rounded-md border border-border/50 bg-muted/35 px-2 py-1 text-[6.5px] text-foreground">
          Interactive guides · first-time flows
        </div>
        <div className="rounded-md border border-border/50 bg-muted/35 px-2 py-1 flex items-center gap-1">
          <MapPinLucide className="h-3 w-3 text-brand-accent shrink-0 opacity-80" />
          <span className="text-[6.5px] font-medium">Site map · every route</span>
        </div>
      </div>
    </div>
  );
}

/** Inline icon — avoids importing lucide if tree-shaking is picky; use simple SVG */
function MapPinLucide({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SiteMapArt() {
  return (
    <div className="relative h-36 sm:h-44">
      <svg viewBox="0 0 320 160" className="h-full w-full text-brand-accent/30" aria-hidden>
        <defs>
          <linearGradient id="docLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle
          cx="160"
          cy="24"
          r="10"
          fill="currentColor"
          className="text-brand-accent"
          opacity={0.35}
        />
        {[48, 96, 144, 192, 240].map((x, i) => (
          <g key={i}>
            <line x1="160" y1="34" x2={x} y2="72" stroke="url(#docLine)" strokeWidth="1.5" />
            <rect
              x={x - 28}
              y="76"
              width="56"
              height="36"
              rx="6"
              fill="currentColor"
              className="text-muted"
              opacity={0.25}
            />
            <rect
              x={x - 24}
              y="82"
              width="48"
              height="6"
              rx="2"
              fill="currentColor"
              className="text-brand-accent"
              opacity={0.45}
            />
            <rect
              x={x - 24}
              y="94"
              width="32"
              height="4"
              rx="1"
              fill="currentColor"
              className="text-muted-foreground"
              opacity={0.35}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function UploadArt() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-4">
      <div className="flex h-24 w-full max-w-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-accent/35 bg-brand-accent/[0.06]">
        <svg viewBox="0 0 48 48" className="h-10 w-10 text-brand-accent/70" aria-hidden>
          <path
            fill="currentColor"
            d="M24 8l10 12h-6v14h-8V20h-6L24 8zm-14 30h28v4H10v-4z"
            opacity={0.85}
          />
        </svg>
        <p className="mt-1 text-[9px] font-medium text-muted-foreground">Drop HTML or XML export</p>
      </div>
      <div className="flex w-full max-w-[240px] gap-2">
        <div className="h-8 flex-1 rounded-lg bg-muted/70" />
        <div className="h-8 w-14 rounded-lg bg-primary/20" />
      </div>
    </div>
  );
}

/** Pre-AI guide: validate parsed structure on real Assess tab names. */
function PreAiGuideArt() {
  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 flex-wrap border-b border-border/60 pb-1">
        {["Overview", "Security", "Compliance", "Remediation"].map((t, i) => (
          <div
            key={t}
            className={cn(
              "rounded-t-md px-1.5 py-0.5 text-[6.5px] font-semibold",
              i <= 2
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground",
            )}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="text-[6px] font-medium uppercase text-muted-foreground px-0.5">
        Read evidence before AI narrative
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {["Objects", "Rules", "VPN"].map((x) => (
          <div key={x} className="rounded-lg border border-border/50 bg-muted/30 p-1.5">
            <div className="mb-0.5 h-1 w-8 rounded bg-foreground/20" />
            <div className="h-1 w-full rounded bg-foreground/10" />
            <div className="text-[5.5px] text-muted-foreground mt-1">{x}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Security Analysis tab: rules matrix + service chips. */
function SecurityAnalysisTabArt() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="flex flex-wrap gap-1">
        {["Rules", "VPN", "IPS/IDS", "Certs", "Zones"].map((t, i) => (
          <span
            key={t}
            className={cn(
              "rounded-full px-2 py-0.5 text-[6px] font-semibold border",
              i === 0
                ? "border-brand-accent/40 bg-brand-accent/12 text-foreground"
                : "border-border/60 bg-muted/40 text-muted-foreground",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-md border border-border/55 bg-card/80 overflow-hidden text-[6px]">
        <div className="grid grid-cols-4 gap-px bg-border/40 font-semibold text-muted-foreground uppercase">
          {["#", "Src", "Dst", "Svc"].map((h) => (
            <div key={h} className="bg-muted/50 px-1 py-0.5">
              {h}
            </div>
          ))}
        </div>
        {[12, 18, 24].map((n) => (
          <div key={n} className="grid grid-cols-4 gap-px bg-border/30">
            <div className="bg-background px-1 py-0.5 font-mono text-muted-foreground">{n}</div>
            <div className="bg-background px-1 py-0.5 truncate">LAN</div>
            <div className="bg-background px-1 py-0.5 truncate">Any</div>
            <div className="bg-background px-1 py-0.5 truncate">HTTPS</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiReportGuideArt() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500/15 to-cyan-500/10 p-2 border border-violet-500/15">
        <div className="relative h-11 w-9 rounded bg-rose-500/12 border border-rose-500/25 flex items-center justify-center text-[6px] font-bold text-rose-900 dark:text-rose-200">
          PDF
          <span className="absolute -top-1 -right-1 text-[10px]" aria-hidden>
            ✦
          </span>
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[6.5px] font-bold uppercase text-violet-800/90 dark:text-violet-200/90">
              AI narrative
            </span>
            <span className="text-[6px] text-muted-foreground">Executive + technical</span>
          </div>
          <div className="h-1.5 w-full rounded bg-foreground/10" />
          <div className="h-1.5 w-4/5 rounded bg-foreground/08" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-14 flex-1 rounded-lg border border-border/60 bg-card/50 p-1.5 space-y-1">
          <div className="h-1 w-12 rounded bg-foreground/15" />
          <div className="h-1 w-full rounded bg-foreground/08" />
        </div>
        <div className="h-14 flex-1 rounded-lg border border-border/60 bg-card/50 p-1.5 flex items-center justify-center text-[6px] text-muted-foreground font-medium">
          Saved to Report centre
        </div>
      </div>
    </div>
  );
}

function RemediationFindingsArt() {
  return (
    <div className="space-y-1.5 py-0.5">
      <div className="flex items-center justify-between text-[6.5px] font-bold uppercase text-muted-foreground px-0.5">
        <span>Findings</span>
        <span className="normal-case font-semibold text-foreground">Bulk · Export</span>
      </div>
      {[
        { sev: "P1", title: "Overly permissive WAN rule", st: "Open" },
        { sev: "P2", title: "Stale VPN profile", st: "Owned" },
        { sev: "P3", title: "Logging gap — DNS filter", st: "Open" },
      ].map((r) => (
        <div
          key={r.title}
          className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/25 px-2 py-1.5"
        >
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px text-[5.5px] font-black",
              r.sev === "P1"
                ? "bg-rose-500/20 text-rose-900 dark:text-rose-200"
                : r.sev === "P2"
                  ? "bg-amber-500/20 text-amber-900 dark:text-amber-200"
                  : "bg-slate-500/15 text-slate-700 dark:text-slate-300",
            )}
          >
            {r.sev}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[7px] font-medium text-foreground truncate">{r.title}</div>
            <div className="text-[5.5px] text-muted-foreground">{r.st}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OptimisationTabArt() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-500/35 flex items-center justify-center text-[8px] font-black text-emerald-800 dark:text-emerald-200 bg-emerald-500/10">
          BP
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[7px] font-bold text-foreground">Sophos best practice</div>
          <div className="text-[6px] text-muted-foreground">Rule hygiene · hardening</div>
        </div>
      </div>
      {[
        { l: "Unused objects", w: 72 },
        { l: "Broad services", w: 45 },
        { l: "IPS coverage", w: 88 },
      ].map((row) => (
        <div key={row.l} className="space-y-0.5">
          <div className="flex justify-between text-[6px] text-muted-foreground">
            <span>{row.l}</span>
            <span className="tabular-nums">{row.w}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500/50 to-cyan-500/45"
              style={{ width: `${row.w}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffArt() {
  return (
    <div className="space-y-1 font-mono text-[7px] leading-tight">
      <div className="rounded-md bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
        - rule 12: any:any
      </div>
      <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-200">
        + rule 12: limited set
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-1 text-muted-foreground">
        {" "}
        object unchanged
      </div>
    </div>
  );
}

function WorkspaceAssessArt() {
  const tabs = [
    "Overview",
    "Security",
    "Compliance",
    "Remed.",
    "Optim.",
    "Tools",
    "Insur.",
    "Compare",
  ];
  return (
    <div className="space-y-2 py-0.5">
      <div className="flex gap-0.5 flex-wrap border-b border-border/50 pb-1">
        {tabs.map((t, i) => (
          <span
            key={t}
            className={cn(
              "rounded-t px-1 py-0.5 text-[5.5px] font-semibold",
              i === 0
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 border-b-0"
                : "text-muted-foreground",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="w-[36%] shrink-0 rounded-lg border-2 border-dashed border-brand-accent/35 bg-brand-accent/[0.06] flex flex-col items-center justify-center py-3 px-1">
          <span className="text-[6px] font-medium text-muted-foreground text-center leading-tight">
            HTML / XML export
          </span>
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <div className="h-2 w-28 rounded bg-foreground/14" />
          <div className="h-1.5 w-full rounded bg-foreground/08" />
          <div className="grid grid-cols-3 gap-1 mt-1">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-7 rounded bg-muted/40 border border-border/45" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpGroupPortfolioArt() {
  return (
    <div className="space-y-1 py-0.5">
      <div className="text-center text-[6px] font-bold uppercase text-muted-foreground">
        Portfolio & customers
      </div>
      <div className="space-y-1 rounded-lg border border-border/55 bg-card/60 p-1.5">
        <div className="text-center text-[5.5px] font-semibold text-muted-foreground">
          Mission control
        </div>
        <div className="grid grid-cols-4 gap-1">
          {["24", "186", "82%", "12"].map((v) => (
            <div
              key={v}
              className="rounded bg-muted/50 py-0.5 text-center text-[9px] font-black tabular-nums"
            >
              {v}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border/55 bg-muted/25 p-1.5">
        <div className="mb-0.5 text-center text-[5.5px] font-semibold text-muted-foreground">
          Fleet · sample
        </div>
        <div className="mb-0.5 h-1.5 w-full rounded bg-foreground/12" />
        <div className="h-1.5 w-full rounded bg-foreground/10" />
      </div>
      <div className="flex items-center justify-center rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5">
        <span className="text-center text-[6px] font-bold text-foreground">
          Customers · Central map
        </span>
      </div>
    </div>
  );
}

function HelpGroupAssessmentArt() {
  return (
    <div className="grid grid-cols-3 gap-1.5 py-0.5 text-[5.5px]">
      <div className="rounded-lg border border-border/55 bg-card/70 p-1.5 space-y-1">
        <div className="font-bold text-muted-foreground uppercase text-[5px]">Assess</div>
        <div className="h-1 w-full rounded bg-foreground/12" />
        <div className="flex flex-wrap gap-px">
          {["Ov", "Sec", "Comp"].map((x) => (
            <span
              key={x}
              className="rounded-sm bg-brand-accent/15 px-1 py-px font-semibold text-[5px]"
            >
              {x}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border/55 bg-card/70 p-1.5 flex flex-col items-center">
        <div className="font-bold text-muted-foreground uppercase text-[5px] mb-1">Insights</div>
        <svg viewBox="0 0 32 24" className="w-full h-8 text-brand-accent/45" aria-hidden>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            points="2,18 8,8 14,14 20,6 26,12 30,4"
          />
        </svg>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-1.5 space-y-0.5">
        <div className="font-bold text-muted-foreground uppercase text-[5px]">Drift</div>
        <div className="h-1 w-full rounded bg-foreground/10" />
        <div className="text-[5px] text-amber-900/80 dark:text-amber-200/80 font-medium">
          Δ vs baseline
        </div>
      </div>
    </div>
  );
}

function HelpGroupReportsArt() {
  return (
    <div className="flex gap-2 py-1">
      <div className="flex-1 space-y-1 min-w-0">
        <div className="text-[6px] font-bold uppercase text-muted-foreground">Report centre</div>
        <div className="flex items-center gap-1 rounded border border-border/50 bg-card/90 px-1.5 py-1">
          <span className="text-[5px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/15 px-0.5 rounded">
            PDF
          </span>
          <span className="text-[6.5px] font-medium truncate">Customer Q1 pack</span>
        </div>
        <div className="h-1.5 w-full rounded bg-foreground/08" />
      </div>
      <div className="w-[32%] shrink-0 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] p-1.5 flex flex-col items-center">
        <div className="h-12 w-7 rounded border border-violet-500/30 bg-violet-500/10 shadow-sm" />
        <div className="text-[5.5px] font-bold text-center text-foreground mt-1">Playbooks</div>
      </div>
    </div>
  );
}

function HelpGroupPlatformArt() {
  return (
    <div className="space-y-1.5 py-0.5">
      <div className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/[0.07] px-2 py-1">
        <span className="text-[7px] font-bold text-sky-900 dark:text-sky-100">Central</span>
        <span className="text-[6px] text-emerald-600 dark:text-emerald-400">sync</span>
        <span className="text-[6px] text-muted-foreground ml-auto">Tenants · Alerts</span>
      </div>
      <div className="rounded-md border border-border/55 bg-muted/35 px-2 py-1 font-mono text-[5.5px]">
        <span className="text-muted-foreground">GET</span>{" "}
        <span className="text-foreground/80">/v1/…</span>
      </div>
      <div className="space-y-0.5 font-mono text-[5.5px] text-muted-foreground">
        <div className="rounded bg-muted/40 px-1.5 py-0.5">audit · settings change</div>
        <div className="rounded bg-muted/40 px-1.5 py-0.5">health check · SE review</div>
      </div>
    </div>
  );
}

function AssessTabToolsArt() {
  const tiles = [
    { l: "Simulator", sub: "path impact" },
    { l: "Attack map", sub: "surface" },
    { l: "Exports", sub: "CSV / pack" },
    { l: "Baseline", sub: "compare" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 py-0.5">
      {tiles.map((t) => (
        <div key={t.l} className="rounded-lg border border-border/55 bg-muted/30 p-1.5">
          <div className="text-[6.5px] font-bold text-foreground">{t.l}</div>
          <div className="text-[5px] text-muted-foreground">{t.sub}</div>
          <div className="mt-1 h-6 rounded bg-card/80 border border-border/40" />
        </div>
      ))}
    </div>
  );
}

function AssessTabCompareArt() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="flex gap-2 items-center">
        <div className="flex-1 rounded-md border border-border/55 bg-muted/35 px-2 py-1.5 text-[6px] font-mono">
          <div className="text-[5px] text-muted-foreground uppercase mb-0.5">Config A</div>
          <div className="h-1 w-full rounded bg-foreground/12" />
        </div>
        <span className="text-[6px] font-bold text-muted-foreground">vs</span>
        <div className="flex-1 rounded-md border border-border/55 bg-muted/35 px-2 py-1.5 text-[6px] font-mono">
          <div className="text-[5px] text-muted-foreground uppercase mb-0.5">Config B</div>
          <div className="h-1 w-full rounded bg-foreground/12" />
        </div>
      </div>
      <DiffArt />
    </div>
  );
}

function AssessSectionPostureArt() {
  const cells = [
    { t: "Overview", d: "Score · widgets" },
    { t: "Security", d: "Rules · VPN" },
    { t: "Compliance", d: "Frameworks" },
    { t: "Remediation", d: "Findings" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 py-0.5">
      {cells.map((c) => (
        <div
          key={c.t}
          className="rounded-lg border border-brand-accent/20 bg-brand-accent/[0.06] p-1.5"
        >
          <div className="text-[6.5px] font-bold text-foreground">{c.t}</div>
          <div className="text-[5px] text-muted-foreground leading-tight mt-0.5">{c.d}</div>
        </div>
      ))}
    </div>
  );
}

function AssessSectionHardeningArt() {
  const items = [
    { t: "Optimisation", c: "Best practice" },
    { t: "Tools", c: "Simulator · map" },
    { t: "Insurance", c: "Readiness" },
    { t: "Compare", c: "2+ configs" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 py-0.5">
      {items.map((x) => (
        <div key={x.t} className="rounded-lg border border-border/55 bg-muted/35 p-1.5">
          <div className="text-[6.5px] font-bold text-foreground">{x.t}</div>
          <div className="text-[5px] text-muted-foreground">{x.c}</div>
        </div>
      ))}
    </div>
  );
}

function ToolsCompareGuideArt() {
  return (
    <div className="grid grid-cols-2 gap-2 py-0.5">
      <div className="space-y-1">
        <div className="text-[6px] font-bold uppercase text-muted-foreground">Tools</div>
        <div className="h-8 rounded border border-border/50 bg-muted/30 flex items-center justify-center text-[5.5px] text-foreground font-medium">
          Attack surface
        </div>
        <div className="h-6 rounded border border-border/50 bg-muted/30 flex items-center justify-center text-[5.5px]">
          Exports
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[6px] font-bold uppercase text-muted-foreground">Compare / drift</div>
        <DiffArt />
      </div>
    </div>
  );
}

function ManagementPanelArt() {
  return (
    <div className="flex justify-end py-1">
      <div className="w-44 space-y-1 rounded-lg border border-border/70 bg-popover p-2 shadow-lg">
        <div className="text-[7px] font-bold text-foreground truncate px-0.5">Acme MSP ▾</div>
        <div className="h-px bg-border" />
        {["Mission control", "Saved reports", "Assessment history", "Organisation settings"].map(
          (label) => (
            <div
              key={label}
              className="h-5 rounded bg-muted/40 px-1.5 flex items-center text-[6.5px] font-medium text-foreground"
            >
              {label}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function TeamArt() {
  return (
    <div className="flex flex-wrap justify-center gap-3 py-3">
      {[
        { label: "Owner", tone: "bg-violet-500/20" },
        { label: "Analyst", tone: "bg-cyan-500/20" },
        { label: "Viewer", tone: "bg-slate-500/20" },
      ].map((u) => (
        <div
          key={u.label}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border border-border/60 p-3",
            u.tone,
          )}
        >
          <div className="h-10 w-10 rounded-full bg-background shadow-sm border border-border/50" />
          <span className="text-[8px] font-semibold text-foreground">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Customer directory: org rows + Central tenant mapping (not team/user roles). */
function CustomersDirectoryArt() {
  const rows = [
    { name: "Northwind", tenants: "2 tenants", portal: "On" },
    { name: "Contoso MSP", tenants: "Linked", portal: "—" },
    { name: "Fabrikam", tenants: "Sync…", portal: "On" },
  ];
  return (
    <div className="space-y-1.5 py-0.5">
      <div className="flex gap-2 text-[6.5px] font-bold uppercase tracking-wide text-muted-foreground px-1 border-b border-border/50 pb-1">
        <span className="w-[52%]">Customer</span>
        <span className="w-[28%]">Central</span>
        <span className="w-[20%] text-right">Portal</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex gap-2 items-center rounded-md bg-muted/30 px-1.5 py-1.5 border border-border/40"
        >
          <div className="w-[52%] flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 inline-flex" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-accent/60" fill="currentColor">
                <path d="M12 3L3 9.5V20h6v-6h6v6h6V9.5L12 3zm0 2.2l6 4.5V18h-2v-6H8v6H6v-8.3l6-4.5z" />
              </svg>
            </span>
            <span className="text-[8px] font-semibold text-foreground truncate">{r.name}</span>
          </div>
          <span className="w-[28%] text-[7px] text-muted-foreground font-mono truncate">
            {r.tenants}
          </span>
          <span className="w-[20%] text-[7px] font-medium text-right text-cyan-600 dark:text-cyan-400">
            {r.portal}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Mission control: KPI tiles + alerts strip. */
function MissionControlArt() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { k: "Customers", v: "24" },
          { k: "Fleet", v: "186" },
          { k: "Posture", v: "82%" },
          { k: "Alerts", v: "12" },
        ].map((x) => (
          <div
            key={x.k}
            className="rounded-lg border border-border/50 bg-card/90 px-1.5 py-2 text-center shadow-sm"
          >
            <div className="text-[14px] font-black tabular-nums text-foreground leading-none">
              {x.v}
            </div>
            <div className="text-[6px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">
              {x.k}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-2 py-1.5 space-y-1">
        <div className="text-[6.5px] font-bold uppercase text-amber-800/90 dark:text-amber-200/90">
          Recent alerts
        </div>
        <div className="h-1.5 w-full rounded bg-foreground/10" />
        <div className="h-1.5 w-4/5 rounded bg-foreground/8" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {["Open Assess", "Fleet", "Reports"].map((a) => (
          <span
            key={a}
            className="rounded-full border border-brand-accent/25 bg-brand-accent/10 px-2 py-0.5 text-[6.5px] font-medium text-foreground"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

function FleetTableArt() {
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex gap-2 text-[7px] font-semibold text-muted-foreground uppercase px-1">
        <span className="flex-1">Firewall</span>
        <span className="w-10">Health</span>
        <span className="w-12">Firmware</span>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex gap-2 items-center rounded-md bg-muted/35 px-2 py-1.5 border border-border/40"
        >
          <div className="flex-1 h-2 rounded bg-foreground/15" />
          <div className="w-10 h-2 rounded-full bg-emerald-500/35" />
          <div className="w-12 h-2 rounded bg-foreground/10" />
        </div>
      ))}
    </div>
  );
}

function CentralHubArt() {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-center gap-2">
        <div className="rounded-full bg-sky-500/20 border border-sky-500/35 px-3 py-1.5 text-[8px] font-bold text-sky-900 dark:text-sky-100">
          Sophos Central
        </div>
        <span className="text-[6.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
          ● Synced
        </span>
      </div>
      <div className="space-y-1 max-h-[88px] overflow-hidden">
        {["Tenant EU-West", "Tenant US-East", "Acme Corp Central"].map((t, i) => (
          <div
            key={t}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-card/80 px-2 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[7px] font-medium text-foreground truncate flex-1">{t}</span>
            <span className="text-[6px] text-muted-foreground font-mono">
              {i === 0 ? "12 FW" : "8 FW"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-center text-[6px] text-muted-foreground">
        <span className="rounded bg-muted/60 px-1.5 py-px">Firewalls</span>
        <span className="rounded bg-muted/60 px-1.5 py-px">Alerts</span>
        <span className="rounded bg-muted/60 px-1.5 py-px">Licensing</span>
      </div>
    </div>
  );
}

function PortfolioInsightsArt() {
  return (
    <div className="flex gap-2 justify-between items-end py-2 px-1 h-[100px]">
      {[
        { label: "A", pts: "4,12,8,16,14" },
        { label: "B", pts: "8,6,14,10,18" },
        { label: "C", pts: "6,10,7,12,9" },
      ].map((c) => (
        <div key={c.label} className="flex-1 flex flex-col items-center gap-1">
          <svg viewBox="0 0 40 48" className="w-full h-12 text-brand-accent/50" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={c.pts
                .split(",")
                .map((v, i) => `${4 + i * 8},${40 - Number(v)}`)
                .join(" ")}
            />
          </svg>
          <span className="text-[6px] font-bold text-muted-foreground">Customer {c.label}</span>
        </div>
      ))}
    </div>
  );
}

function DriftCompareArt() {
  return (
    <div className="flex items-stretch gap-2 py-2 text-[6.5px]">
      <div className="flex-1 rounded-lg border border-border/60 bg-muted/25 p-2 space-y-1">
        <div className="font-bold text-muted-foreground uppercase">Export Jan</div>
        <div className="h-1 w-full rounded bg-foreground/12" />
        <div className="h-1 w-5/6 rounded bg-foreground/10" />
        <div className="h-1 w-full rounded bg-foreground/12" />
      </div>
      <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
        <span className="text-lg leading-none">→</span>
        <span className="text-[6px] font-bold uppercase">Drift</span>
      </div>
      <div className="flex-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2 space-y-1">
        <div className="font-bold text-muted-foreground uppercase">Export Feb</div>
        <div className="h-1 w-full rounded bg-amber-600/25" />
        <div className="rounded bg-red-500/15 px-1 py-0.5 text-red-800 dark:text-red-200">
          − rule relaxed
        </div>
        <div className="rounded bg-emerald-500/15 px-1 py-0.5 text-emerald-800 dark:text-emerald-200">
          + object added
        </div>
      </div>
    </div>
  );
}

function ReportCentreArt() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between text-[7px] font-bold uppercase text-muted-foreground px-0.5">
        <span>Report centre</span>
        <span className="flex items-center gap-0.5 text-cyan-600 dark:text-cyan-400 normal-case font-semibold">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.5 3.5v3l2.5 1.5-.5.87L7.5 8.2V4.5h1z" />
          </svg>
          Schedule
        </span>
      </div>
      {["Executive pack", "Compliance PDF", "Saved — Contoso"].map((t, i) => (
        <div
          key={t}
          className="flex items-center gap-2 rounded-lg border border-border/55 bg-card/90 px-2 py-1.5 shadow-sm"
        >
          <div className="h-8 w-6 rounded-sm bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-[5px] font-bold text-rose-800 dark:text-rose-200">
            PDF
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[7.5px] font-semibold text-foreground truncate">{t}</div>
            <div className="text-[6px] text-muted-foreground">
              {i < 2 ? "Generated · Export" : "View · Share link"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApiHubArt() {
  return (
    <div className="space-y-2 py-1 font-mono text-[6.5px]">
      <div className="rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 flex items-center gap-2">
        <span className="text-[6px] font-bold uppercase text-muted-foreground shrink-0">Key</span>
        <span className="text-foreground/80 truncate">fc_live_••••••••••••8f2a</span>
      </div>
      <div className="rounded-md border border-border/50 bg-card/80 px-2 py-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-1 font-bold">
            GET
          </span>
          <span className="text-muted-foreground truncate">/v1/reports/saved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-sky-500/20 text-sky-800 dark:text-sky-200 px-1 font-bold">
            POST
          </span>
          <span className="text-muted-foreground truncate">/v1/webhooks/register</span>
        </div>
      </div>
      <div className="flex justify-end">
        <span className="rounded border border-border/60 bg-background px-2 py-0.5 text-[6px] text-muted-foreground">
          Region: EU (Ireland)
        </span>
      </div>
    </div>
  );
}

function HealthCheckArt() {
  return (
    <div className="flex gap-3 py-2 items-start">
      <div className="shrink-0 w-14 rounded-lg border border-border/60 bg-gradient-to-b from-muted/80 to-card p-1.5 text-center">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 mx-auto text-brand-accent/70"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4zm0 2.2l6 3v4.8c0 3.8-2.5 7-6 7.8-3.5-.8-6-4-6-7.8V7.2l6-3zM11 10h2v5h-2v-5zm0 6h2v2h-2v-2z" />
        </svg>
        <div className="text-[5.5px] font-bold text-muted-foreground mt-0.5">SFOS</div>
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="text-[7px] font-bold uppercase text-muted-foreground">SE health check</div>
        {["Firmware & licences", "Threat protection stack", "VPN & remote access"].map((line) => (
          <div key={line} className="flex items-center gap-1.5 text-[7px] text-foreground">
            <span className="text-emerald-500" aria-hidden>
              ✓
            </span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybooksArt() {
  return (
    <div className="py-2 px-1 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-10 w-8 rounded border border-violet-500/30 bg-violet-500/10 shadow-sm" />
        <div>
          <div className="text-[8px] font-bold text-foreground">Playbook library</div>
          <div className="text-[6.5px] text-muted-foreground">Repeatable remediation flows</div>
        </div>
      </div>
      <div className="space-y-1.5 pl-1 border-l-2 border-brand-accent/30">
        {[
          "1. Isolate suspicious VPN user",
          "2. Tighten WAN rule template",
          "3. Verify logging & retention",
        ].map((s) => (
          <div key={s} className="text-[7px] text-foreground leading-snug">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditListArt() {
  return (
    <div className="space-y-1.5 py-1 font-mono text-[7px]">
      {["central.sync_completed", "report.generated", "settings.branding_updated"].map((e, i) => (
        <div
          key={e}
          className="flex justify-between gap-2 rounded bg-muted/40 px-2 py-1 border border-border/40"
        >
          <span className="text-muted-foreground truncate">{e}</span>
          <span className="text-foreground/50 shrink-0">T-{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function ComplianceBarsArt() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex gap-0.5 justify-end mb-1" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-2 rounded-sm",
              i % 5 === 0
                ? "bg-rose-500/35"
                : i % 4 === 0
                  ? "bg-amber-500/30"
                  : "bg-emerald-500/25",
            )}
          />
        ))}
      </div>
      <div className="text-[5.5px] font-semibold uppercase text-muted-foreground px-0.5">
        Framework coverage
      </div>
      {["ISO 27001", "CIS SFOS", "Essential 8"].map((l) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-14 text-[7px] font-semibold text-muted-foreground truncate">{l}</span>
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-accent/60 to-cyan-500/50"
              style={{ width: `${38 + (l.length % 5) * 12}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsuranceDocArt() {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-14 h-20 rounded-md border border-border/60 bg-background shadow-sm flex flex-col p-1 gap-1">
        <div className="h-1.5 w-full rounded bg-foreground/15" />
        <div className="h-1 w-4/5 rounded bg-foreground/10" />
        <div className="h-1 w-full rounded bg-foreground/10 mt-2" />
        <div className="h-1 w-3/5 rounded bg-foreground/10" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="h-2 w-24 rounded bg-violet-500/30" />
        <div className="h-1.5 w-full rounded bg-foreground/12" />
        <div className="h-1.5 w-5/6 rounded bg-foreground/10" />
        <div className="mt-2 flex gap-1">
          <div className="h-5 flex-1 rounded bg-emerald-500/20 border border-emerald-500/25" />
          <div className="h-5 flex-1 rounded bg-amber-500/20 border border-amber-500/25" />
        </div>
      </div>
    </div>
  );
}

/** FireComply Connector: on-prem collector → firewall API → FireComply cloud. */
function ConnectorAgentArt() {
  return (
    <div className="py-1.5 space-y-2">
      <div className="text-[6.5px] font-bold uppercase tracking-wide text-muted-foreground text-center">
        Scheduled collection
      </div>
      <div className="flex items-stretch justify-between gap-1 sm:gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-border/55 bg-muted/35 p-1.5 flex flex-col items-center text-center">
          <div
            className="h-7 w-12 rounded border border-border/60 bg-card shadow-sm mb-1"
            aria-hidden
          />
          <span className="text-[6.5px] font-bold text-foreground">Connector</span>
          <span className="text-[5.5px] text-muted-foreground leading-tight">Customer LAN</span>
        </div>
        <div className="flex flex-col items-center justify-center text-muted-foreground shrink-0 px-0.5">
          <span className="text-sm leading-none" aria-hidden>
            →
          </span>
          <span className="text-[5px] font-bold uppercase mt-0.5">API</span>
        </div>
        <div className="flex-1 min-w-0 rounded-lg border border-brand-accent/25 bg-brand-accent/[0.07] p-1.5 flex flex-col items-center text-center">
          <div
            className="h-7 w-10 rounded-sm bg-gradient-to-b from-muted/80 to-card border border-border/50 mb-1"
            aria-hidden
          />
          <span className="text-[6.5px] font-bold text-foreground">Firewall</span>
          <span className="text-[5.5px] text-muted-foreground leading-tight">SFOS mgmt</span>
        </div>
        <div className="flex flex-col items-center justify-center text-muted-foreground shrink-0 px-0.5">
          <span className="text-sm leading-none" aria-hidden>
            ↑
          </span>
          <span className="text-[5px] font-bold uppercase mt-0.5">HTTPS</span>
        </div>
        <div className="flex-1 min-w-0 rounded-lg border border-sky-500/25 bg-sky-500/[0.08] p-1.5 flex flex-col items-center justify-center text-center">
          <span className="text-[6.5px] font-bold text-sky-950 dark:text-sky-100">FireComply</span>
          <span className="text-[5.5px] text-muted-foreground leading-tight">Findings · drift</span>
        </div>
      </div>
      <div className="flex justify-center gap-2 text-[5.5px] text-muted-foreground font-mono">
        <span className="rounded bg-muted/50 px-1.5 py-px">API key</span>
        <span className="rounded bg-muted/50 px-1.5 py-px">Schedule</span>
      </div>
    </div>
  );
}

function PortalArt() {
  return (
    <div className="grid grid-cols-5 gap-2 py-2">
      <div className="col-span-2 space-y-1 rounded-lg bg-muted/40 p-2">
        <div className="text-[6px] font-bold uppercase text-muted-foreground">Customer portal</div>
        <div className="h-16 rounded-md bg-background/80 border border-border/50 flex items-center justify-center text-[6px] text-muted-foreground font-medium px-1 text-center">
          Branded read-only reports
        </div>
      </div>
      <div className="col-span-3 space-y-1">
        <div className="flex gap-1">
          <div className="h-6 flex-1 rounded bg-amber-500/20 border border-amber-500/25 flex items-center justify-center text-[5.5px] font-bold text-amber-900 dark:text-amber-200 gap-0.5">
            <svg
              viewBox="0 0 12 12"
              className="h-2.5 w-2.5 shrink-0"
              fill="currentColor"
              aria-hidden
            >
              <path d="M6 1a2.5 2.5 0 00-2.5 2.5V5l-.8 3.2a.5.5 0 00.48.6h5.64a.5.5 0 00.48-.6L8.5 5V3.5A2.5 2.5 0 006 1zm0 10a1.5 1.5 0 001.42-1H4.58A1.5 1.5 0 006 11z" />
            </svg>
            Alerts
          </div>
          <div className="h-6 flex-1 rounded bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-[5.5px] font-bold text-sky-900 dark:text-sky-200">
            Webhook
          </div>
        </div>
        <div className="h-20 rounded-lg bg-card border border-border/60 p-2 space-y-1">
          <div className="h-1.5 w-full rounded bg-foreground/12" />
          <div className="h-1.5 w-5/6 rounded bg-foreground/10" />
          <div className="text-[5.5px] text-muted-foreground font-mono">POST /hooks/incoming</div>
        </div>
      </div>
    </div>
  );
}

const inner: Record<DocIllustrationId, ReactNode> = {
  "docs-home": <DocsHomeArt />,
  overview: <AssessOverviewTabArt />,
  "site-map": <SiteMapArt />,
  "upload-assess": <UploadArt />,
  "connector-agent": <ConnectorAgentArt />,
  "pre-ai": <PreAiGuideArt />,
  "ai-reports": <AiReportGuideArt />,
  optimisation: <OptimisationTabArt />,
  remediation: <RemediationFindingsArt />,
  "tools-compare": <ToolsCompareGuideArt />,
  management: <ManagementPanelArt />,
  "team-security": <TeamArt />,
  "portal-alerts": <PortalArt />,
  "workspace-mission-control": <MissionControlArt />,
  "workspace-fleet": <FleetTableArt />,
  "workspace-customers": <CustomersDirectoryArt />,
  "workspace-central": <CentralHubArt />,
  "workspace-insights": <PortfolioInsightsArt />,
  "workspace-drift": <DriftCompareArt />,
  "workspace-reports": <ReportCentreArt />,
  "workspace-api": <ApiHubArt />,
  "workspace-health-check": <HealthCheckArt />,
  "workspace-playbooks": <PlaybooksArt />,
  "workspace-audit": <AuditListArt />,
  "workspace-assess": <WorkspaceAssessArt />,
  "help-group-portfolio": <HelpGroupPortfolioArt />,
  "help-group-assessment": <HelpGroupAssessmentArt />,
  "help-group-reports": <HelpGroupReportsArt />,
  "help-group-platform": <HelpGroupPlatformArt />,
  "assess-tab-overview": <AssessOverviewTabArt />,
  "assess-tab-security": <SecurityAnalysisTabArt />,
  "assess-tab-compliance": <ComplianceBarsArt />,
  "assess-tab-insurance": <InsuranceDocArt />,
  "assess-tab-tools": <AssessTabToolsArt />,
  "assess-tab-compare": <AssessTabCompareArt />,
  "assess-section-posture": <AssessSectionPostureArt />,
  "assess-section-hardening": <AssessSectionHardeningArt />,
};

export type DocIllustrationProps = {
  id: DocIllustrationId;
  className?: string;
  /** When false, skip browser chrome (e.g. full-bleed diagram). */
  framed?: boolean;
  caption?: string;
};

export function DocIllustration({ id, className, framed = true, caption }: DocIllustrationProps) {
  const body = inner[id];
  return (
    <figure className={cn("space-y-3", className)}>
      <div
        className={cn(
          frame,
          "from-muted/40 via-background to-brand-accent/[0.07] dark:to-brand-accent/10",
          /* Size to content so short mocks are not swimming in a fixed 2:1 box; cap height for tall art */
          "w-full min-h-[240px] max-h-[min(640px,82vh)] overflow-y-auto",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(32,6,247,0.12),transparent_52%)]" />
        <div className="relative z-[1] grid w-full place-items-center px-2 py-3 sm:px-4 sm:py-4">
          {/*
            Wider column + CSS zoom (sm+): scales every text-[Npx] mock in one shot without editing
            dozens of art components. motion-reduce: no zoom jump.
          */}
          <div className="w-full max-w-6xl justify-self-center motion-reduce:[zoom:1] max-sm:[zoom:1] sm:[zoom:1.14] lg:[zoom:1.2]">
            {framed && id !== "site-map" ? (
              <BrowserChrome className="w-full">{body}</BrowserChrome>
            ) : (
              body
            )}
          </div>
        </div>
      </div>
      {caption ? (
        <figcaption className="mx-auto max-w-6xl text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
