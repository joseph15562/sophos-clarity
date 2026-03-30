import type { ReactNode } from "react";

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
  return (
    <Wrapper
      className={`relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 flex items-center gap-4 text-left shadow-card transition-all duration-200 hover:scale-[1.02] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated ${onClick ? "cursor-pointer" : ""}`}
      style={{ background: `linear-gradient(145deg, ${accentHex}12, ${accentHex}05)` }}
      onClick={onClick}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-5 -right-5 h-14 w-14 rounded-full blur-[24px] opacity-20"
          style={{ backgroundColor: accentHex }}
        />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accentHex}28, transparent)` }}
      />
      <div
        className="relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08]"
        style={{ backgroundColor: `${accentHex}18` }}
      >
        {typeof icon === "string" ? (
          <img src={icon} alt="" className="h-7 w-7 sophos-icon" loading="lazy" decoding="async" />
        ) : (
          icon
        )}
      </div>
      <div className="relative">
        <p className="text-3xl font-black leading-none tabular-nums" style={{ color: accentHex }}>
          {value}
        </p>
        <p className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-[0.18em] mt-1">
          {label}
        </p>
      </div>
    </Wrapper>
  );
}
