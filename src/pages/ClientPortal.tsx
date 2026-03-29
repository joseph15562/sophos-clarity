/**
 * White-Label Client Portal — read-only view for MSP clients.
 * Supports:
 *  - Vanity slug URLs (/portal/acme) and UUID-based URLs (/portal/:uuid)
 *  - MSP branding (logo, accent colour, welcome message, contact info, footer)
 *  - Configurable section visibility
 *  - Optional viewer-role authentication for richer data access
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useParams, Link } from "react-router-dom";
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
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Info,
  ChevronDown,
  ChevronRight,
  Lock,
  ShieldAlert,
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
import { scoreToColor, type Severity } from "@/lib/design-tokens";

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

function GaugeSvg({
  score,
  size,
  showLabels,
  label,
}: {
  score: number;
  size: number;
  showLabels?: boolean;
  label?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.065;
  const needleLength = r - strokeWidth * 1.5;
  const startAngle = 150;
  const endAngle = 390;
  const filledEndAngle = scoreToAngle(score);
  const needleAngle = filledEndAngle;
  const trackPath = arcPath(cx, cy, r, startAngle, endAngle);
  const filledPath = arcPath(cx, cy, r, startAngle, filledEndAngle);
  const fillColor = scoreToColor(score);
  const gaugeId = `gauge-${size}-${Math.round(score)}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <defs>
        <linearGradient id={`${gaugeId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={fillColor} />
        </linearGradient>
        <filter id={`${gaugeId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={size * 0.02} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={trackPath}
        fill="none"
        stroke="hsl(213 27% 86%)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="dark:hidden"
      />
      <path
        d={trackPath}
        fill="none"
        stroke="hsl(215 40% 22%)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="hidden dark:block"
      />
      {Array.from({ length: 11 }, (_, i) => {
        const tickAngle = startAngle + (i / 10) * (endAngle - startAngle);
        const rad = (tickAngle * Math.PI) / 180;
        const isMajor = i % 5 === 0;
        const outerR = r + strokeWidth * 0.8;
        const innerR = r + strokeWidth * (isMajor ? 1.6 : 1.2);
        return (
          <line
            key={i}
            x1={cx + outerR * Math.cos(rad)}
            y1={cy + outerR * Math.sin(rad)}
            x2={cx + innerR * Math.cos(rad)}
            y2={cy + innerR * Math.sin(rad)}
            stroke={fillColor}
            strokeWidth={isMajor ? 1.5 : 0.8}
            opacity={isMajor ? 0.4 : 0.2}
            strokeLinecap="round"
          />
        );
      })}
      <path
        d={filledPath}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth * 2.2}
        strokeLinecap="round"
        opacity={0.15}
        filter={`url(#${gaugeId}-glow)`}
      />
      <path
        d={filledPath}
        fill="none"
        stroke={`url(#${gaugeId}-grad)`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <g transform={`translate(${cx}, ${cy})`}>
        <g
          className="gauge-needle"
          style={{
            transformOrigin: "0 0",
            ["--needle-end" as string]: `${needleAngle}deg`,
            animation: "gaugeNeedleSweep 0.6s ease-out forwards",
          }}
        >
          <line
            x1={0}
            y1={0}
            x2={needleLength}
            y2={0}
            stroke="hsl(215 52% 25%)"
            strokeWidth={size * 0.02}
            strokeLinecap="round"
            className="dark:hidden"
          />
          <line
            x1={0}
            y1={0}
            x2={needleLength}
            y2={0}
            stroke="hsl(210 20% 65%)"
            strokeWidth={size * 0.02}
            strokeLinecap="round"
            className="hidden dark:block"
          />
        </g>
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={size * 0.04}
        fill="none"
        stroke={fillColor}
        strokeWidth={size * 0.008}
        opacity={0.3}
      />
      <circle cx={cx} cy={cy} r={size * 0.028} fill="hsl(215 52% 25%)" className="dark:hidden" />
      <circle
        cx={cx}
        cy={cy}
        r={size * 0.028}
        fill="hsl(210 20% 65%)"
        className="hidden dark:block"
      />
      {showLabels && (
        <g>
          <text
            x={cx}
            y={cy - size * 0.04}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={fillColor}
            style={{
              fontSize: size * 0.18,
              fontWeight: 900,
              fontFamily: "'Zalando Sans Expanded', 'Zalando Sans', system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {label ?? "—"}
          </text>
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(210 25% 50%)"
            style={{
              fontSize: size * 0.07,
              fontWeight: 700,
              fontFamily: "'Zalando Sans', system-ui, sans-serif",
            }}
            className="dark:hidden"
          >
            {score}
          </text>
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(210 20% 65%)"
            style={{
              fontSize: size * 0.07,
              fontWeight: 700,
              fontFamily: "'Zalando Sans', system-ui, sans-serif",
            }}
            className="hidden dark:block"
          >
            {score}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Login form (full-page) ──

function PortalLoginForm({
  onSuccess,
  accentColor,
  branding,
  customerName,
}: {
  onSuccess: () => void;
  accentColor?: string;
  branding?: PortalBranding | null;
  customerName?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const { setTheme, resolvedTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "forgot") {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
      setLoading(false);
      if (resetErr) setError(resetErr.message);
      else setMessage("Password reset link sent. Check your email.");
      return;
    }

    if (mode === "signup") {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (signUpErr) setError(signUpErr.message);
      else setMessage("Account created! Check your email to verify, then sign in.");
      return;
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
    } else {
      onSuccess();
    }
  };

  const accent = accentColor || "#2006F7";
  const showBrand = branding?.showBranding !== false;
  const mspName = showBrand && branding?.companyName ? branding.companyName : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(247,249,255,1),rgba(240,243,255,1))] dark:bg-[linear-gradient(135deg,rgba(5,8,18,1),rgba(10,14,28,1))] px-4 relative">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-6">
        {showBrand && branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={mspName ?? "Logo"}
            className="h-12 w-auto max-w-[160px] mx-auto object-contain"
          />
        ) : (
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shadow-lg">
              <Lock className="h-7 w-7 text-white" />
            </div>
          </div>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-display font-black text-foreground tracking-tight">
            Customer Portal
          </h1>
          {customerName && <p className="text-sm text-muted-foreground mt-1">{customerName}</p>}
        </div>

        <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xl p-6">
          <h2 className="text-lg font-display font-bold text-foreground mb-1">
            {mode === "signin"
              ? "Sign In"
              : mode === "signup"
                ? "Create Account"
                : "Reset Password"}
          </h2>
          <p className="text-xs text-muted-foreground/70 mb-5">
            {mode === "signin"
              ? "Sign in to access your security portal"
              : mode === "signup"
                ? "Set up your account with your invited email"
                : "Enter your email to receive a reset link"}
          </p>

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
                placeholder="you@company.com"
                className="rounded-xl border-slate-900/[0.10] dark:border-white/[0.06]"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="portal-password">Password</Label>
                <Input
                  id="portal-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  className="rounded-xl border-slate-900/[0.10] dark:border-white/[0.06]"
                />
              </div>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 gap-1.5"
              style={
                accent !== "#2006F7"
                  ? { backgroundColor: accent, backgroundImage: "none" }
                  : undefined
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "forgot" ? (
                <Mail className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign In"
                  : mode === "signup"
                    ? "Create Account"
                    : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center text-xs text-muted-foreground">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setMessage(null);
                  }}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setMessage(null);
                  }}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  Invited? Create your account
                </button>
              </>
            )}
            {mode !== "signin" && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="hover:underline hover:text-foreground transition-colors"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground/60">
          {mspName ? `Access provided by ${mspName}` : "Powered by Sophos Clarity"}
        </p>
      </div>
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
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isMspUser, setIsMspUser] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "findings" | "compliance" | "reports">(
    "dashboard",
  );

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

  // Verify portal access — allow org members (MSP staff) OR invited portal viewers
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      // Check if user is an org member (MSP staff) — always allowed for any portal
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from("org_members")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (membership) {
          setIsMspUser(true);
          setAccessDenied(false);
          return;
        }
      }
      // Not an MSP user — check portal_viewers (need orgId from data load)
      if (!orgId) return;
      const { data: viewer } = await supabase
        .from("portal_viewers")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", authUser.email)
        .maybeSingle();
      setAccessDenied(!viewer);
    })();
  }, [authUser, orgId]);

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
    setAccessDenied(false);
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

  if (loading || !authChecked) {
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

  // Auth gate: require authentication before showing portal data
  if (!authUser) {
    return (
      <PortalLoginForm
        accentColor={accentColor}
        branding={branding}
        customerName={customerName}
        onSuccess={() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              setAuthUser({ email: session.user.email ?? "" });
            }
          });
        }}
      />
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(135deg,rgba(247,249,255,1),rgba(240,243,255,1))] dark:bg-[linear-gradient(135deg,rgba(5,8,18,1),rgba(10,14,28,1))] px-4">
        <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have access to this portal. Contact your MSP provider for
            assistance.
          </p>
          <Button variant="outline" onClick={handleSignOut} className="rounded-xl">
            Sign Out
          </Button>
        </div>
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
      <header className="sticky top-0 z-40 no-print border-b border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-panel backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isMspUser && (
              <Link
                to="/customers"
                className="flex items-center gap-1.5 text-[#B6C4FF]/70 hover:text-white transition-colors shrink-0"
                title="Back to Customer Management"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Back</span>
              </Link>
            )}
            {showBranding && branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName ?? "Logo"}
                className="h-10 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-elevated shrink-0">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-display font-black text-white leading-tight tracking-tight truncate">
                {tenantName ??
                  (showBranding && branding?.companyName ? branding.companyName : customerName)}
              </h1>
              <p className="text-[10px] text-[#B6C4FF]/70 truncate">
                {showBranding && branding?.companyName
                  ? `${branding.companyName} — Security Assessment`
                  : "Firewall Configuration Assessment"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#B6C4FF]/70 hidden sm:inline truncate max-w-[160px]">
              {authUser?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-[10px] gap-1 rounded-xl text-[#B6C4FF] hover:text-white hover:bg-white/[0.08] border border-white/10 bg-white/[0.04]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl text-[#B6C4FF] hover:text-white hover:bg-white/[0.08] border border-white/10 bg-white/[0.04]"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="sticky top-[52px] z-30 border-b border-slate-900/[0.10] dark:border-white/[0.06] bg-white/80 dark:bg-[#080d1c]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 -mb-px" role="tablist">
            {(
              [
                { id: "dashboard", label: "Dashboard" },
                { id: "findings", label: "Findings" },
                { id: "compliance", label: "Compliance" },
                { id: "reports", label: "Reports" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-current text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
                )}
                style={
                  activeTab === tab.id
                    ? { borderColor: accentColor, color: accentColor }
                    : undefined
                }
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Dashboard Tab ── */}
        {activeTab === "dashboard" && (
          <>
            {/* Welcome Message */}
            {showBranding && branding?.welcomeMessage && (
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center mt-0.5 shadow-[0_4px_16px_rgba(90,0,255,0.2)]">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {branding.welcomeMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Score Summary */}
            {sectionVisible("score") &&
              (() => {
                const aggScore = latest?.overall_score ?? 0;
                const aggGrade = latest?.overall_grade ?? "—";
                return (
                  <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6 sm:p-8 space-y-5">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-accent">
                        Security score
                      </div>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h2 className="text-xl font-display font-black text-foreground tracking-tight">
                            Security Score
                          </h2>
                          <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-1">
                            {latest
                              ? `Latest assessment: ${new Date(latest.assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                              : "No assessments yet"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-card shadow-card px-5 py-4 text-right">
                          <p className="text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                            Current posture
                          </p>
                          <p
                            className="text-4xl font-display font-black tracking-tight tabular-nums mt-1.5"
                            style={{ color: scoreToColor(aggScore) }}
                          >
                            {aggScore}
                            <span className="text-lg font-semibold text-muted-foreground">
                              /100
                            </span>
                          </p>
                          <p
                            className="text-[11px] font-display font-semibold mt-1"
                            style={{ color: scoreToColor(aggScore) }}
                          >
                            Grade {aggGrade}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative flex items-center justify-center">
                          <div style={{ animation: "gaugeNeedleMount 0.6s ease-out forwards" }}>
                            <GaugeSvg score={aggScore} size={240} showLabels label={aggGrade} />
                          </div>
                        </div>
                        <p className="text-[13px] font-display font-medium text-muted-foreground/70 text-center">
                          Your firewall scores{" "}
                          <span className="font-bold text-foreground">{aggScore}/100</span>{" "}
                          <span className="text-foreground/60">(Grade {aggGrade})</span>
                        </p>
                        {previous && latest && (
                          <p className="text-sm text-center">
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

                    <style>{`
                @keyframes gaugeNeedleMount { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes gaugeNeedleSweep { from { transform: rotate(150deg); } to { transform: rotate(var(--needle-end, 150deg)); } }
              `}</style>
                  </div>
                );
              })()}

            {/* Per-Firewall Breakdown */}
            {sectionVisible("score") && portalFirewalls.length > 1 && (
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    Firewall Overview
                  </h2>
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
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    Assessment History
                  </h2>
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
          </>
        )}

        {/* ── Findings Tab ── */}
        {activeTab === "findings" && (
          <>
            {/* Findings Summary */}
            {sectionVisible("findings") && (
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    Findings Summary
                  </h2>
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
                    <p className="text-sm text-muted-foreground py-4">
                      No findings data available.
                    </p>
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
                                  <TableCell className="text-sm text-foreground">
                                    {f.title}
                                  </TableCell>
                                  {portalFirewalls.length > 1 && (
                                    <TableCell className="text-sm text-muted-foreground">
                                      {f.firewallLabel ?? "—"}
                                    </TableCell>
                                  )}
                                </TableRow>
                                <TableRow
                                  className="border-0 hover:bg-transparent"
                                  aria-hidden={!open}
                                >
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
                                            <p className="text-foreground capitalize">
                                              {f.confidence}
                                            </p>
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
                    <p className="text-sm text-muted-foreground py-4">
                      No findings data available.
                    </p>
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
          </>
        )}

        {/* ── Compliance Tab ── */}
        {activeTab === "compliance" && (
          <>
            {/* Compliance Status */}
            {sectionVisible("compliance") && frameworks.length > 0 && (
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    Compliance Status
                  </h2>
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
          </>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === "reports" && (
          <>
            {/* Report Downloads */}
            {sectionVisible("reports") && (
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    Report Downloads
                  </h2>
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
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6">
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
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6 space-y-4">
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
              <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm p-6">
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-accent/10 bg-white/60 dark:bg-[#080d1c]/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
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
