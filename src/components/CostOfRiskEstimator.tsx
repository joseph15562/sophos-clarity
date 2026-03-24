import { useMemo, useState } from "react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";

const SEVERITY_COST: Record<Severity, { min: number; max: number }> = {
  critical: { min: 15_000, max: 40_000 },
  high: { min: 5_000, max: 15_000 },
  medium: { min: 1_000, max: 5_000 },
  low: { min: 200, max: 1_000 },
  info: { min: 0, max: 0 },
};

const INDUSTRIES = [
  { value: "healthcare", label: "Healthcare", multiplier: 1.5 },
  { value: "financial", label: "Financial", multiplier: 1.4 },
  { value: "government", label: "Government", multiplier: 1.3 },
  { value: "education", label: "Education", multiplier: 1.0 },
  { value: "technology", label: "Technology", multiplier: 1.0 },
  { value: "retail", label: "Retail", multiplier: 1.0 },
  { value: "other", label: "Other", multiplier: 1.0 },
] as const;

const SIZES = [
  { value: "small", label: "Small (<50)", multiplier: 0.7 },
  { value: "medium", label: "Medium (50-500)", multiplier: 1.0 },
  { value: "large", label: "Large (500+)", multiplier: 1.5 },
] as const;

const CURRENCIES = [
  { value: "usd", label: "USD ($)", symbol: "$", rate: 1.0 },
  { value: "gbp", label: "GBP (£)", symbol: "£", rate: 0.79 },
  { value: "eur", label: "EUR (€)", symbol: "€", rate: 0.92 },
] as const;

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function CostOfRiskEstimator({ analysisResults }: Props) {
  const [industry, setIndustry] = useState<string>("technology");
  const [size, setSize] = useState<string>("medium");
  const [currency, setCurrency] = useState<string>("usd");

  const curr = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];
  const fmt = (n: number) =>
    `${curr.symbol}${Math.round(n * curr.rate).toLocaleString()}`;

  const riskExposure = useMemo(() => {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const result of Object.values(analysisResults)) {
      for (const f of result.findings) {
        if (f.severity in counts) counts[f.severity]++;
      }
    }
    let minTotal = 0;
    let maxTotal = 0;
    for (const sev of ["critical", "high", "medium", "low", "info"] as Severity[]) {
      const { min, max } = SEVERITY_COST[sev];
      minTotal += counts[sev] * min;
      maxTotal += counts[sev] * max;
    }
    const indMult = INDUSTRIES.find((i) => i.value === industry)?.multiplier ?? 1.0;
    const sizeMult = SIZES.find((s) => s.value === size)?.multiplier ?? 1.0;
    const mult = indMult * sizeMult;
    return {
      counts,
      minExposure: Math.round(minTotal * mult),
      maxExposure: Math.round(maxTotal * mult),
    };
  }, [analysisResults, industry, size]);

  const criticalSavings = useMemo(() => {
    const { min, max } = SEVERITY_COST.critical;
    const count = riskExposure.counts.critical;
    const indMult = INDUSTRIES.find((i) => i.value === industry)?.multiplier ?? 1.0;
    const sizeMult = SIZES.find((s) => s.value === size)?.multiplier ?? 1.0;
    const mult = indMult * sizeMult;
    return {
      count,
      min: Math.round(count * min * mult),
      max: Math.round(count * max * mult),
    };
  }, [riskExposure.counts.critical, industry, size]);

  const severities: Severity[] = ["critical", "high", "medium", "low"];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">Cost of Risk Estimator</h3>
      <div className="mt-4 space-y-4">
        <p className="text-2xl font-bold text-destructive">
          Estimated Annual Risk Exposure: {fmt(riskExposure.minExposure)} – {fmt(riskExposure.maxExposure)}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Company size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Breakdown by severity</p>
          {severities.map((sev) => {
            const count = riskExposure.counts[sev];
            const { min, max } = SEVERITY_COST[sev];
            if (count === 0) return null;
            return (
              <div
                key={sev}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="capitalize">{sev}</span>
                <span className="text-destructive">
                  {count} × {fmt(min)}–{fmt(max)}
                </span>
              </div>
            );
          })}
        </div>
        {criticalSavings.count > 0 && (
          <p className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            Resolving {criticalSavings.count} critical finding{criticalSavings.count !== 1 ? "s" : ""}{" "}
            could reduce exposure by{" "}
            <span className="font-semibold">
              {fmt(criticalSavings.min)} – {fmt(criticalSavings.max)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
