import type { ExtractedSections } from "@/lib/extract-sections";
import { buildVpnTopologySummary } from "@/lib/vpn-topology-summary";

interface Props {
  extractedData: ExtractedSections;
  firewallLabel?: string;
}

/** Minimal hub-and-spoke diagram for site-to-site + SSL VPN footprint (roadmap D3). */
export function VpnTopologyDiagram({ extractedData, firewallLabel = "Firewall" }: Props) {
  const { ipsecConnectionNames, sslVpnPolicyCount } = buildVpnTopologySummary(extractedData);
  if (ipsecConnectionNames.length === 0 && sslVpnPolicyCount === 0) return null;

  const maxShow = 8;
  const shown = ipsecConnectionNames.slice(0, maxShow);
  const extra = ipsecConnectionNames.length - shown.length;

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/80 p-4 shadow-card">
      <h4 className="text-xs font-display font-semibold text-foreground mb-3">
        VPN topology (summary)
      </h4>
      <div className="flex flex-wrap items-center justify-center gap-4 min-h-[140px]">
        <div className="flex flex-col items-center gap-2">
          {shown.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="rounded-lg border border-brand-accent/25 bg-brand-accent/[0.06] px-3 py-1.5 text-[10px] font-medium text-foreground max-w-[140px] truncate"
              title={name}
            >
              IPsec: {name}
            </div>
          ))}
          {extra > 0 && (
            <span className="text-[9px] text-muted-foreground">
              +{extra} more tunnel{extra !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <span className="text-[9px] uppercase tracking-wide">to</span>
          <div className="h-px w-12 bg-border" />
          <span className="text-[9px] uppercase tracking-wide">to</span>
        </div>
        <div className="rounded-xl border-2 border-[#2006F7]/40 bg-gradient-to-br from-[#5A00FF]/15 to-[#00EDFF]/10 px-5 py-4 text-center">
          <p className="text-[10px] font-bold text-foreground">{firewallLabel}</p>
          <p className="text-[9px] text-muted-foreground mt-1">Site-to-site &amp; remote access</p>
          {sslVpnPolicyCount > 0 && (
            <p className="text-[9px] text-[#00EDFF] mt-2">
              {sslVpnPolicyCount} SSL VPN polic{sslVpnPolicyCount !== 1 ? "ies" : "y"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
