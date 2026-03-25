/**
 * White-Label Client Portal — read-only view for MSP clients.
 * Supports:
 *  - Vanity slug URLs (/portal/acme) and UUID-based URLs (/portal/:uuid)
 *  - MSP branding (logo, accent colour, welcome message, contact info, footer)
 *  - Configurable section visibility
 *  - Optional viewer-role authentication for richer data access
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Moon,
  Sun,
  Download,
  FileText,
  Star,
  Send,
  LogIn,
  LogOut,
  Loader2,
  Mail,
  Phone,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import type { Severity } from "@/lib/design-tokens";

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00F2B3] dark:text-[#00F2B3]",
  B: "text-[#009CFB]",
  C: "text-[#F8E300] dark:text-[#F8E300]",
  D: "text-[#F29400]",
  F: "text-[#EA0022]",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-blue-500 text-white",
  info: "bg-slate-400 text-white",
};

interface PortalFinding {
  id: string;
  title: string;
  severity: Severity;
}

interface PortalFindingRich extends PortalFinding {
  section?: string;
  detail?: string;
  remediation?: string;
  evidence?: string;
  confidence?: string;
}

interface FrameworkCompliance {
  framework: string;
  pass: number;
  partial: number;
  fail: number;
}

const FINDING_TO_CONTROL: [RegExp, string][] = [
  [/SSL\/TLS inspection|DPI inactive/i, "dpiEngine"],
  [/zone.*not covered.*SSL|source zone.*not covered/i, "sslInspection"],
  [/missing web filtering/i, "webFilter"],
  [/without IPS/i, "ips"],
  [/without Application Control/i, "appControl"],
  [/logging disabled/i, "logging"],
  [/MFA|OTP/i, "mfa"],
  [/broad source/i, "segmentation"],
  [/"ANY" service/i, "segmentation"],
  [/overlapping/i, "ruleHygiene"],
  [/admin console|ssh accessible|snmp exposed|management service.*exposed/i, "adminAccess"],
  [/DNAT|port forwarding|broad.*NAT/i, "natSecurity"],
  [/virus scanning|sandboxing|zero-day/i, "antiMalware"],
  [/web filter policy allows|high-risk categor/i, "webFilter"],
  [/ips policy/i, "ips"],
  [/vpn.*weak encryption|without.*perfect forward|pre-shared key/i, "vpnSecurity"],
  [/dos|spoof|syn flood/i, "dosProtection"],
  [/external.*log.*forwarding/i, "externalLogging"],
  [/wireless.*no encryption|wireless.*weak encryption/i, "wirelessSecurity"],
  [/snmp communit.*default|snmp communit.*weak/i, "snmpSecurity"],
];

const PORTAL_FRAMEWORKS: Record<string, string[]> = {
  "Cyber Essentials": [
    "dpiEngine",
    "webFilter",
    "mfa",
    "segmentation",
    "logging",
    "adminAccess",
    "antiMalware",
    "vpnSecurity",
    "wirelessSecurity",
  ],
  "NCSC Guidelines": [
    "dpiEngine",
    "webFilter",
    "ips",
    "logging",
    "mfa",
    "segmentation",
    "sslInspection",
    "ruleHygiene",
    "adminAccess",
    "antiMalware",
    "vpnSecurity",
    "dosProtection",
    "externalLogging",
    "wirelessSecurity",
  ],
  "ISO 27001": [
    "dpiEngine",
    "webFilter",
    "ips",
    "appControl",
    "logging",
    "mfa",
    "segmentation",
    "sslInspection",
    "ruleHygiene",
    "adminAccess",
    "natSecurity",
    "antiMalware",
    "vpnSecurity",
    "dosProtection",
    "externalLogging",
    "wirelessSecurity",
    "snmpSecurity",
  ],
  GDPR: ["logging", "mfa", "segmentation", "sslInspection", "adminAccess", "externalLogging"],
};

function deriveComplianceFromFindings(
  findingsList: Array<{ title: string; severity: string }>,
): FrameworkCompliance[] {
  const failedControls = new Set<string>();
  const partialControls = new Set<string>();
  for (const f of findingsList) {
    for (const [re, controlKey] of FINDING_TO_CONTROL) {
      if (re.test(f.title)) {
        if (f.severity === "critical" || f.severity === "high") {
          failedControls.add(controlKey);
        } else {
          partialControls.add(controlKey);
        }
      }
    }
  }

  return Object.entries(PORTAL_FRAMEWORKS).map(([framework, controlKeys]) => {
    let pass = 0;
    let partial = 0;
    let fail = 0;
    for (const key of controlKeys) {
      if (failedControls.has(key)) fail++;
      else if (partialControls.has(key)) partial++;
      else pass++;
    }
    return { framework, pass, partial, fail };
  });
}

interface PortalBranding {
  logoUrl: string | null;
  companyName: string | null;
  accentColor: string;
  welcomeMessage: string | null;
  slaInfo: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  footerText: string | null;
  showBranding: boolean;
}

interface PortalFirewall {
  agentId: string;
  label: string;
  serialNumber: string | null;
  model: string | null;
  score: number | null;
  grade: string | null;
  lastSeen: string | null;
  lastAssessed: string | null;
  findingsRich?: PortalFindingRich[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Gauge ──

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

function scoreToAngle(score: number): number {
  return 150 + (score / 100) * 240;
}

function ScoreGauge({
  score,
  grade,
  accentColor,
}: {
  score: number;
  grade: string;
  accentColor?: string;
}) {
  const cx = 110;
  const cy = 110;
  const r = 48;
  const strokeWidth = 8;
  const filledEnd = scoreToAngle(score);
  const trackPath = arcPath(cx, cy, r, 150, 390);
  const filledPath = arcPath(cx, cy, r, 150, filledEnd);
  const defaultColor = score <= 40 ? "#EA0022" : score <= 75 ? "#F29400" : "#00F2B3";
  const fillColor = accentColor && score > 75 ? accentColor : defaultColor;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={220}
        height={180}
        viewBox="0 0 220 180"
        className="overflow-visible drop-shadow-lg"
      >
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={fillColor} />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.6" />
          </linearGradient>
          <filter id="gaugeGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="currentColor"
          className="text-border/30"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={filledPath}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
        />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn("text-3xl font-black", GRADE_COLORS[grade] ?? GRADE_COLORS.C)}
        >
          {grade}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-base font-bold tabular-nums"
        >
          {score}
        </text>
      </svg>
    </div>
  );
}

// ── Login form ──

function PortalLoginForm({
  onSuccess,
  accentColor,
}: {
  onSuccess: () => void;
  accentColor?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-foreground">Sign In</h2>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Sign in to access your full security portal
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="portal-email">Email</Label>
          <Input
            id="portal-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-xl border-brand-accent/15"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="portal-password">Password</Label>
          <Input
            id="portal-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="rounded-xl border-brand-accent/15"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 gap-1.5"
          style={
            accentColor && accentColor !== "#2006F7"
              ? { backgroundColor: accentColor, backgroundImage: "none" }
              : undefined
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}

// ── Main portal ──

export default function ClientPortal() {
  const { tenantId: rawParam } = useParams<{ tenantId: string }>();
  const { setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [findings, setFindings] = useState<PortalFinding[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkCompliance[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(
    new Set(["critical", "high", "medium", "low", "info"]),
  );
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  // Branding
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [visibleSections, setVisibleSections] = useState<string[]>([
    "score",
    "history",
    "findings",
    "compliance",
    "reports",
    "feedback",
  ]);
  const [orgId, setOrgId] = useState<string>("");
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [portalFirewalls, setPortalFirewalls] = useState<PortalFirewall[]>([]);
  const [expandedFindingIds, setExpandedFindingIds] = useState<Set<string>>(() => new Set());

  // Auth state
  const [authUser, setAuthUser] = useState<{ email: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const isSlug = rawParam ? !UUID_RE.test(rawParam) : false;
  const identifier = rawParam ?? "";

  const accentColor = branding?.accentColor ?? "#2006F7";

  // Check if user is already authenticated
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setAuthUser({ email: session.user.email ?? "" });
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const loadData = useCallback(async () => {
    if (!identifier) {
      setError("Missing portal identifier");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSlug || !authUser) {
        // Use the edge function for slug-based or unauthenticated access
        const paramKey = isSlug ? "slug" : "org_id";
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?${paramKey}=${encodeURIComponent(identifier)}`;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
        const resp = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error((body as Record<string, string>).error ?? "Portal not found");
        }

        const data = await resp.json();
        setOrgId(data.orgId ?? "");
        setTenantName(data.tenantName ?? null);
        setCustomerName(data.tenantName ?? data.customerName ?? "Customer");
        setScoreHistory(data.scoreHistory ?? []);
        const portalFindings = data.findings ?? [];
        setFindings(portalFindings);
        setBranding(data.branding ?? null);
        setPortalFirewalls(data.firewalls ?? []);
        setFrameworks(deriveComplianceFromFindings(portalFindings));
        setVisibleSections(
          data.visibleSections ?? [
            "score",
            "history",
            "findings",
            "compliance",
            "reports",
            "feedback",
          ],
        );
      } else {
        // Authenticated path: use Supabase RLS directly
        const resolvedOrgId = identifier;
        setOrgId(resolvedOrgId);

        const history = await loadScoreHistory(resolvedOrgId, undefined, 30);
        setScoreHistory(history);

        const name =
          new URLSearchParams(window.location.search).get("customer") ??
          history[0]?.customer_name ??
          "Customer";
        setCustomerName(name);

        // Load portal config for branding
        const { data: config } = await supabase
          .from("portal_config")
          .select("*")
          .eq("org_id", resolvedOrgId)
          .maybeSingle();

        if (config) {
          setBranding({
            logoUrl: config.logo_url,
            companyName: config.company_name,
            accentColor: config.accent_color ?? "#2006F7",
            welcomeMessage: config.welcome_message,
            slaInfo: config.sla_info,
            contactEmail: config.contact_email,
            contactPhone: config.contact_phone,
            footerText: config.footer_text,
            showBranding: config.show_branding ?? true,
          });
          setVisibleSections(
            Array.isArray(config.visible_sections)
              ? config.visible_sections
              : ["score", "history", "findings", "compliance", "reports", "feedback"],
          );
        }
      }

      if (scoreHistory.length === 0 && findings.length === 0 && frameworks.length === 0) {
        // Will be re-evaluated after state updates
      }
    } catch (err) {
      console.warn("[ClientPortal] load failed", err);
      setError(err instanceof Error ? err.message : "Failed to load portal data.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, isSlug, authUser]);

  useEffect(() => {
    if (authChecked) loadData();
  }, [loadData, authChecked]);

  const toggleSeverity = (s: Severity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleFindingRow = (rowKey: string) => {
    setExpandedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  type MergedRichFinding = PortalFindingRich & {
    rowKey: string;
    firewallLabel?: string;
  };

  const mergedRichFindings = useMemo((): MergedRichFinding[] | null => {
    const rows: MergedRichFinding[] = [];
    const showFirewall = portalFirewalls.length > 1;
    for (const fw of portalFirewalls) {
      const rich = fw.findingsRich;
      if (!rich?.length) continue;
      for (const f of rich) {
        rows.push({
          ...f,
          severity: (f.severity as Severity) ?? "info",
          rowKey: `${fw.agentId}:${f.id}`,
          ...(showFirewall ? { firewallLabel: fw.label } : {}),
        });
      }
    }
    return rows.length > 0 ? rows : null;
  }, [portalFirewalls]);

  const handleFeedbackSubmit = () => {
    toast({
      title: "Thank you",
      description: "Your feedback has been submitted.",
    });
    setFeedbackStars(0);
    setFeedbackText("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setShowLogin(false);
  };

  const sectionVisible = useCallback(
    (id: string) => visibleSections.includes(id),
    [visibleSections],
  );

  // CSS custom properties for accent colour
  const accentStyle = useMemo(
    () =>
      ({
        "--portal-accent": accentColor,
        "--portal-accent-light": `${accentColor}20`,
      }) as React.CSSProperties,
    [accentColor],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,rgba(247,249,255,1),rgba(240,243,255,1))] dark:bg-[linear-gradient(135deg,rgba(5,8,18,1),rgba(10,14,28,1))]">
        <span className="animate-spin h-6 w-6 border-2 border-brand-accent/30 border-t-[#5A00FF] rounded-full" />
      </div>
    );
  }

  if (error && scoreHistory.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(247,249,255,1),rgba(240,243,255,1))] dark:bg-[linear-gradient(135deg,rgba(5,8,18,1),rgba(10,14,28,1))] px-4">
        <h1 className="text-xl font-display font-bold text-foreground mb-2">Client Portal</h1>
        <p className="text-muted-foreground text-center">{error}</p>
        <Button
          variant="outline"
          className="mt-4 rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06]"
          onClick={loadData}
        >
          Retry
        </Button>
      </div>
    );
  }

  const historyReversed = [...scoreHistory].reverse();
  const latest = historyReversed[0];
  const previous = historyReversed[1];
  const filteredFindings = findings.filter((f) => severityFilter.has(f.severity));
  const filteredRichFindings =
    mergedRichFindings?.filter((f) => severityFilter.has(f.severity)) ?? null;
  const showBranding = branding?.showBranding !== false;

  return (
    <div
      className="min-h-screen bg-[linear-gradient(135deg,rgba(247,249,255,1),rgba(240,243,255,1))] dark:bg-[linear-gradient(135deg,rgba(5,8,18,1),rgba(10,14,28,1))]"
      style={accentStyle}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-brand-accent/10 bg-white/80 dark:bg-[#080d1c]/80 backdrop-blur-xl"
        style={
          showBranding && branding?.logoUrl ? { borderBottomColor: `${accentColor}25` } : undefined
        }
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {showBranding && branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName ?? "Logo"}
                className="h-10 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shadow-[0_4px_16px_rgba(90,0,255,0.25)]">
                <span className="text-lg font-bold text-white">
                  {customerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-foreground truncate">
                {showBranding && branding?.companyName ? branding.companyName : customerName}
              </h1>
              <p className="text-xs text-muted-foreground/70">
                {tenantName
                  ? `${tenantName} — Security Assessment`
                  : showBranding && branding?.companyName
                    ? `${customerName} — Security Assessment`
                    : "Firewall Configuration Assessment"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {authUser ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-xs gap-1 rounded-xl hover:bg-brand-accent/[0.06]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogin(!showLogin)}
                className="text-xs gap-1 rounded-xl hover:bg-brand-accent/[0.06]"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-brand-accent/[0.06]"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Login form */}
        {showLogin && !authUser && (
          <PortalLoginForm
            accentColor={accentColor}
            onSuccess={() => {
              setShowLogin(false);
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                  setAuthUser({ email: session.user.email ?? "" });
                }
              });
            }}
          />
        )}

        {/* Welcome Message */}
        {showBranding && branding?.welcomeMessage && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center mt-0.5 shadow-[0_4px_16px_rgba(90,0,255,0.2)]">
                <Info className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm text-foreground leading-relaxed">{branding.welcomeMessage}</p>
            </div>
          </div>
        )}

        {/* Score Summary */}
        {sectionVisible("score") && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6 sm:p-8">
            <div className="mb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Score Summary</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Your current security assessment score
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ScoreGauge
                score={latest?.overall_score ?? 0}
                grade={latest?.overall_grade ?? "—"}
                accentColor={accentColor}
              />
              <div className="flex-1 text-center sm:text-left space-y-2">
                <p className="text-sm text-muted-foreground">
                  Latest assessment:{" "}
                  {latest
                    ? new Date(latest.assessed_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"}
                </p>
                {previous && latest && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">vs previous: </span>
                    <span
                      className={cn(
                        "font-semibold",
                        latest.overall_score > previous.overall_score
                          ? "text-[#00F2B3]"
                          : latest.overall_score < previous.overall_score
                            ? "text-[#EA0022]"
                            : "text-muted-foreground",
                      )}
                    >
                      {latest.overall_score > previous.overall_score
                        ? `+${latest.overall_score - previous.overall_score}`
                        : latest.overall_score < previous.overall_score
                          ? latest.overall_score - previous.overall_score
                          : "No change"}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Per-Firewall Breakdown */}
        {sectionVisible("score") && portalFirewalls.length > 1 && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Firewall Overview</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Individual firewall scores for {tenantName ?? customerName}
              </p>
            </div>
            <div className="px-6 pb-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-brand-accent/10 hover:bg-transparent">
                    <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                      Firewall
                    </TableHead>
                    <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                      Model
                    </TableHead>
                    <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                      Score
                    </TableHead>
                    <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                      Grade
                    </TableHead>
                    <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                      Last Assessed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalFirewalls.map((fw) => (
                    <TableRow
                      key={fw.agentId}
                      className="border-brand-accent/[0.06] hover:bg-brand-accent/[0.02]"
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium text-foreground">{fw.label}</span>
                          {fw.serialNumber && (
                            <span className="block text-xs text-muted-foreground">
                              SN: {fw.serialNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fw.model ?? "—"}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {fw.score ?? "—"}
                      </TableCell>
                      <TableCell>
                        {fw.grade ? (
                          <span
                            className={cn(
                              "font-bold text-base",
                              GRADE_COLORS[fw.grade] ?? GRADE_COLORS.C,
                            )}
                          >
                            {fw.grade}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fw.lastAssessed
                          ? new Date(fw.lastAssessed).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Assessment History */}
        {sectionVisible("history") && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Assessment History</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Past assessments with score and finding count
              </p>
            </div>
            <div className="px-6 pb-6">
              {historyReversed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No assessment history yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-brand-accent/10 hover:bg-transparent">
                      <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                        Date
                      </TableHead>
                      <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                        Score
                      </TableHead>
                      <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                        Grade
                      </TableHead>
                      <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                        Findings
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyReversed.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="border-brand-accent/[0.06] hover:bg-brand-accent/[0.02]"
                      >
                        <TableCell>
                          {new Date(entry.assessed_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {entry.overall_score}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-bold text-base",
                              GRADE_COLORS[entry.overall_grade] ?? GRADE_COLORS.C,
                            )}
                          >
                            {entry.overall_grade}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{entry.findings_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {/* Findings Summary */}
        {sectionVisible("findings") && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Findings Summary</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Latest findings grouped by severity
              </p>
            </div>
            <div className="px-6 pb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                  <Badge
                    key={s}
                    variant={severityFilter.has(s) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer capitalize rounded-lg",
                      severityFilter.has(s) && SEVERITY_COLORS[s],
                      !severityFilter.has(s) && "border-brand-accent/15",
                    )}
                    onClick={() => toggleSeverity(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
              {findings.length === 0 && !mergedRichFindings?.length ? (
                <p className="text-sm text-muted-foreground py-4">No findings data available.</p>
              ) : mergedRichFindings && filteredRichFindings ? (
                filteredRichFindings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No findings match the selected filters.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-brand-accent/10 hover:bg-transparent">
                        <TableHead className="w-10" aria-hidden />
                        <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                          Severity
                        </TableHead>
                        <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                          Finding
                        </TableHead>
                        {portalFirewalls.length > 1 && (
                          <TableHead className="text-[11px] font-display uppercase tracking-wider text-muted-foreground/60">
                            Firewall
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRichFindings.map((f) => {
                        const open = expandedFindingIds.has(f.rowKey);
                        const colSpan = portalFirewalls.length > 1 ? 4 : 3;
                        return (
                          <Fragment key={f.rowKey}>
                            <TableRow
                              className={cn(
                                "cursor-pointer transition-colors duration-200 border-brand-accent/[0.06] hover:bg-brand-accent/[0.02]",
                              )}
                              onClick={() => toggleFindingRow(f.rowKey)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleFindingRow(f.rowKey);
                                }
                              }}
                              tabIndex={0}
                              aria-expanded={open}
                            >
                              <TableCell className="w-10 align-middle">
                                <span className="inline-flex text-muted-foreground transition-transform duration-200">
                                  {open ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(
                                    "capitalize",
                                    SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.info,
                                  )}
                                >
                                  {f.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-foreground">{f.title}</TableCell>
                              {portalFirewalls.length > 1 && (
                                <TableCell className="text-sm text-muted-foreground">
                                  {f.firewallLabel ?? "—"}
                                </TableCell>
                              )}
                            </TableRow>
                            <TableRow className="border-0 hover:bg-transparent" aria-hidden={!open}>
                              <TableCell colSpan={colSpan} className="p-0">
                                <div
                                  className={cn(
                                    "overflow-hidden transition-all duration-200 ease-in-out",
                                    open
                                      ? "max-h-[min(80vh,2400px)] opacity-100"
                                      : "max-h-0 opacity-0",
                                  )}
                                >
                                  <div className="rounded-xl bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] border border-brand-accent/10 p-4 mx-2 mb-2 space-y-3 text-sm transition-opacity duration-200">
                                    {f.section && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Section
                                        </p>
                                        <p className="text-foreground">{f.section}</p>
                                      </div>
                                    )}
                                    {f.detail && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Detail
                                        </p>
                                        <p className="text-foreground whitespace-pre-wrap">
                                          {f.detail}
                                        </p>
                                      </div>
                                    )}
                                    {f.remediation && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Remediation
                                        </p>
                                        <p className="text-foreground whitespace-pre-wrap">
                                          {f.remediation}
                                        </p>
                                      </div>
                                    )}
                                    {f.evidence && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Evidence
                                        </p>
                                        <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
                                          {f.evidence}
                                        </pre>
                                      </div>
                                    )}
                                    {f.confidence && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Confidence
                                        </p>
                                        <p className="text-foreground capitalize">{f.confidence}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )
              ) : findings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No findings data available.</p>
              ) : filteredFindings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No findings match the selected filters.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredFindings.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-2 py-2.5 border-b border-brand-accent/[0.06] last:border-0"
                    >
                      <Badge className={cn("shrink-0 capitalize", SEVERITY_COLORS[f.severity])}>
                        {f.severity}
                      </Badge>
                      <span className="text-sm text-foreground">{f.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Compliance Status */}
        {sectionVisible("compliance") && frameworks.length > 0 && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Compliance Status</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Posture per selected framework
              </p>
            </div>
            <div className="space-y-4">
              {frameworks.map((fw) => (
                <div
                  key={fw.framework}
                  className="flex flex-wrap items-center gap-4 rounded-xl bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] border border-brand-accent/[0.06] px-4 py-3"
                >
                  <span className="font-medium text-foreground">{fw.framework}</span>
                  <div className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-md text-[#00F2B3] bg-[#00F2B3]/[0.08] border-[#00F2B3]/20"
                    >
                      Pass: {fw.pass}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-md text-[#F8E300] bg-[#F8E300]/[0.08] border-[#F8E300]/20"
                    >
                      Partial: {fw.partial}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-md text-[#EA0022] bg-[#EA0022]/[0.08] border-[#EA0022]/20"
                    >
                      Fail: {fw.fail}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Downloads */}
        {sectionVisible("reports") && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-display font-bold text-foreground">Report Downloads</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Download your assessment reports
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled
                className="rounded-xl border-brand-accent/15 gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                disabled
                className="rounded-xl border-brand-accent/15 gap-1.5"
              >
                <FileText className="h-4 w-4" />
                Download Word
              </Button>
            </div>
          </div>
        )}

        {/* SLA Information */}
        {showBranding && branding?.slaInfo && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
            <h2 className="text-lg font-display font-bold text-foreground mb-3">
              Service Level Agreement
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {branding.slaInfo}
            </p>
          </div>
        )}

        {/* Feedback Section */}
        {sectionVisible("feedback") && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6 space-y-4">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">Feedback</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Rate your experience (1-5 stars)
              </p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFeedbackStars(n)}
                  className="p-1.5 rounded-xl hover:bg-brand-accent/[0.06] transition-colors"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      feedbackStars >= n
                        ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]"
                        : "text-muted-foreground/30",
                    )}
                  />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Additional feedback (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-brand-accent/15 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
            />
            <Button
              onClick={handleFeedbackSubmit}
              disabled={feedbackStars === 0}
              className="rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 gap-1.5"
              style={
                accentColor !== "#2006F7"
                  ? { backgroundColor: accentColor, backgroundImage: "none" }
                  : undefined
              }
            >
              <Send className="h-4 w-4" />
              Submit Feedback
            </Button>
          </div>
        )}

        {/* Contact Info */}
        {showBranding && (branding?.contactEmail || branding?.contactPhone) && (
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,249,255,0.95))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.95),rgba(14,20,34,0.95))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6">
            <h2 className="text-lg font-display font-bold text-foreground mb-4">
              Contact Your MSP
            </h2>
            <div className="flex flex-wrap gap-6">
              {branding.contactEmail && (
                <a
                  href={`mailto:${branding.contactEmail}`}
                  className="flex items-center gap-2.5 text-sm font-medium text-brand-accent hover:underline rounded-xl bg-brand-accent/[0.04] px-4 py-2.5 border border-brand-accent/10 transition-colors hover:bg-brand-accent/[0.08]"
                >
                  <Mail className="h-4 w-4" />
                  {branding.contactEmail}
                </a>
              )}
              {branding.contactPhone && (
                <a
                  href={`tel:${branding.contactPhone}`}
                  className="flex items-center gap-2.5 text-sm font-medium text-brand-accent hover:underline rounded-xl bg-brand-accent/[0.04] px-4 py-2.5 border border-brand-accent/10 transition-colors hover:bg-brand-accent/[0.08]"
                >
                  <Phone className="h-4 w-4" />
                  {branding.contactPhone}
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-accent/10 bg-white/60 dark:bg-[#080d1c]/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-xs text-muted-foreground/60 text-center">
            {showBranding && branding?.footerText
              ? branding.footerText
              : "Powered by Sophos FireComply"}
          </p>
        </div>
      </footer>
    </div>
  );
}
