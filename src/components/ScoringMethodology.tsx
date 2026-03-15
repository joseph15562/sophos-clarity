import { X } from "lucide-react";

const METHODOLOGY_ITEMS = [
  { category: "Web Filtering", weight: "12.5%", description: "Percentage of enabled WAN rules with HTTP/HTTPS/ANY service that have a Web Filter policy applied." },
  { category: "Intrusion Prevention", weight: "12.5%", description: "Percentage of enabled WAN rules with IPS enabled. Higher coverage = higher score." },
  { category: "Application Control", weight: "12.5%", description: "Percentage of enabled WAN rules with Application Control active." },
  { category: "Authentication", weight: "12.5%", description: "MFA/OTP configuration status across admin, VPN, and user portals. Deductions per area where MFA is disabled." },
  { category: "Logging", weight: "12.5%", description: "Proportion of rules with traffic logging enabled. Disabled logging creates audit blind spots." },
  { category: "Rule Hygiene", weight: "12.5%", description: "Composite score: penalises broad source/dest rules, ANY service rules, duplicate/overlapping rules, disabled WAN rules, and absent SSL/TLS decryption." },
  { category: "Admin Access", weight: "12.5%", description: "Evaluates exposure of management services (HTTPS admin, SSH, SNMP) to untrusted zones like WAN." },
  { category: "Anti-Malware", weight: "12.5%", description: "Virus scanning and sandboxing configuration across protocols (HTTP, HTTPS, FTP, SMTP, etc.)." },
];

export function ScoringMethodology({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">How Scoring Works</h4>
        <button onClick={onClose} aria-label="Close scoring methodology" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        The security risk score is an equal-weighted average of 8 category scores (each 0–100). The overall score determines the grade: A (90+), B (75+), C (60+), D (40+), F (&lt;40).
      </p>
      <div className="space-y-1.5">
        {METHODOLOGY_ITEMS.map((m) => (
          <div key={m.category} className="flex gap-3 text-[10px]">
            <span className="font-semibold text-foreground shrink-0 w-28">{m.category}</span>
            <span className="text-muted-foreground">{m.description}</span>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border text-[10px] text-muted-foreground space-y-1">
        <p><span className="font-semibold text-foreground">Compliance Mapping:</span> Each control is checked against framework requirements using the same category data. Controls can be Pass, Partial, Fail, or N/A. The compliance score per framework is the percentage of scorable controls that pass.</p>
        <p><span className="font-semibold text-foreground">Best Practice:</span> Sophos-specific checks (admin hardening, backup, notifications, pattern updates, NTP, authentication, ATP, HA) are scored separately from the risk score.</p>
      </div>
    </div>
  );
}
