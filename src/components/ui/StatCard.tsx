import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  accentKindFromHex,
  statDarkGradientOverlayStyle,
  statIconTextClass,
  statValueTextClass,
} from "@/lib/stat-accent";

export function StatCard({
  icon,
  value,
  label,
  border,
  bg,
  iconBg,
  valueColor,
  hex,
  onClick,
}: {
  icon: string | ReactNode;
  value: number;
  label: string;
  border: string;
  bg: string;
  iconBg: string;
  valueColor: string;
  hex?: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  const accentHex = hex ?? "#2006F7";
  const kind = accentKindFromHex(accentHex);
  return (
    <Wrapper
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 flex items-center gap-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-elevated",
        "border-slate-200/90 bg-card shadow-sm",
        "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
        "hover:border-slate-300/90 dark:hover:border-white/[0.12]",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={statDarkGradientOverlayStyle(accentHex)}
      />
      <div className="absolute inset-0 pointer-events-none hidden dark:block">
        <div
          className="absolute -top-5 -right-5 h-14 w-14 rounded-full blur-[24px] opacity-25"
          style={{ backgroundColor: accentHex }}
        />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none hidden dark:block"
        style={{ background: `linear-gradient(90deg, transparent, ${accentHex}30, transparent)` }}
      />
      <div
        className={cn(
          "relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border bg-slate-100/90 dark:bg-transparent",
          "border-slate-200/90 dark:border-white/[0.08]",
          statIconTextClass(kind),
          "[&_svg]:h-7 [&_svg]:w-7",
        )}
      >
        {typeof icon === "string" ? (
          <img src={icon} alt="" className="h-7 w-7 sophos-icon" loading="lazy" decoding="async" />
        ) : (
          icon
        )}
      </div>
      <div className="relative">
        <p
          className={cn("text-3xl font-black leading-none tabular-nums", statValueTextClass(kind))}
        >
          {value}
        </p>
        <p className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-[0.18em] mt-1">
          {label}
        </p>
      </div>
    </Wrapper>
  );
}
