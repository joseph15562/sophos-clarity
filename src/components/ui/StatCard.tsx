import type { ReactNode } from "react";

export function StatCard({ icon, value, label, border, bg, iconBg, valueColor, onClick }: {
  icon: string | ReactNode; value: number; label: string;
  border: string; bg: string; iconBg: string; valueColor: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      className={`rounded-xl border ${border} ${bg} p-5 flex items-center gap-4 text-left ${onClick ? "cursor-pointer hover:brightness-110 hover:shadow-md transition-all" : ""}`}
      onClick={onClick}
    >
      <div className={`h-12 w-12 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {typeof icon === "string" ? (
          <img src={icon} alt="" className="h-7 w-7 sophos-icon" />
        ) : (
          icon
        )}
      </div>
      <div>
        <p className={`text-3xl font-extrabold ${valueColor} leading-none`}>{value}</p>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      </div>
    </Wrapper>
  );
}
