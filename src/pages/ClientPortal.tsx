/**
 * White-Label Client Portal — read-only view for MSP clients.
 * Supports:
 *  - Vanity slug URLs (/portal/acme) and UUID-based URLs (/portal/:uuid)
 *  - MSP branding (logo, accent colour, welcome message, contact info, footer)
 *  - Configurable section visibility
 *  - Optional viewer-role authentication for richer data access
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00995a] dark:text-[#00F2B3]",
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

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface PortalFinding {
  id: string;
  title: string;
  severity: Severity;
}

interface FrameworkCompliance {
  framework: string;
  pass: number;
  partial: number;
  fail: number;
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
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Gauge ──

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
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
  const r = 42;
  const strokeWidth = 6;
  const filledEnd = scoreToAngle(score);
  const trackPath = arcPath(cx, cy, r, 150, 390);
  const filledPath = arcPath(cx, cy, r, 150, filledEnd);
  const defaultColor =
    score <= 40 ? "#EA0022" : score <= 75 ? "#F29400" : "#00995a";
  const fillColor = accentColor && score > 75 ? accentColor : defaultColor;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={220}
        height={180}
        viewBox="0 0 220 180"
        className="overflow-visible"
      >
        <path
          d={trackPath}
          fill="none"
          stroke="rgb(229 231 235)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={filledPath}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn(
            "text-2xl font-black",
            GRADE_COLORS[grade] ?? GRADE_COLORS.C,
          )}
        >
          {grade}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-sm font-medium"
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
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Sign in to access your full security portal
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
        const resp = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as Record<string, string>).error ?? "Portal not found",
          );
        }

        const data = await resp.json();
        setOrgId(data.orgId ?? "");
        setTenantName(data.tenantName ?? null);
        setCustomerName(data.tenantName ?? data.customerName ?? "Customer");
        setScoreHistory(data.scoreHistory ?? []);
        setFindings(data.findings ?? []);
        setBranding(data.branding ?? null);
        setPortalFirewalls(data.firewalls ?? []);
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
              : [
                  "score",
                  "history",
                  "findings",
                  "compliance",
                  "reports",
                  "feedback",
                ],
          );
        }
      }

      if (
        scoreHistory.length === 0 &&
        findings.length === 0 &&
        frameworks.length === 0
      ) {
        // Will be re-evaluated after state updates
      }
    } catch (err) {
      console.warn("[ClientPortal] load failed", err);
      setError(
        err instanceof Error ? err.message : "Failed to load portal data.",
      );
    } finally {
      setLoading(false);
    }
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
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && scoreHistory.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 px-4">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Client Portal
        </h1>
        <p className="text-muted-foreground text-center">{error}</p>
        <Button variant="outline" className="mt-4" onClick={loadData}>
          Retry
        </Button>
      </div>
    );
  }

  const historyReversed = [...scoreHistory].reverse();
  const latest = historyReversed[0];
  const previous = historyReversed[1];
  const filteredFindings = findings.filter((f) => severityFilter.has(f.severity));
  const showBranding = branding?.showBranding !== false;

  return (
    <div className="min-h-screen bg-muted/20" style={accentStyle}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-card"
        style={
          showBranding && branding?.logoUrl
            ? { borderBottomColor: `${accentColor}40` }
            : undefined
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
              <div
                className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <span
                  className="text-lg font-bold"
                  style={{ color: accentColor }}
                >
                  {customerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-foreground truncate">
                {showBranding && branding?.companyName
                  ? branding.companyName
                  : customerName}
              </h1>
              <p className="text-xs text-muted-foreground">
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
                className="text-xs gap-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogin(!showLogin)}
                className="text-xs gap-1"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Info className="h-4 w-4" style={{ color: accentColor }} />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {branding.welcomeMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score Summary */}
        {sectionVisible("score") && (
          <Card>
            <CardHeader>
              <CardTitle>Score Summary</CardTitle>
              <CardDescription>
                Your current security assessment score
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      ? new Date(latest.assessed_at).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          },
                        )
                      : "—"}
                  </p>
                  {previous && latest && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        vs previous:{" "}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          latest.overall_score > previous.overall_score
                            ? "text-green-600 dark:text-green-400"
                            : latest.overall_score < previous.overall_score
                              ? "text-red-600 dark:text-red-400"
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
            </CardContent>
          </Card>
        )}

        {/* Per-Firewall Breakdown */}
        {sectionVisible("score") && portalFirewalls.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Firewall Overview</CardTitle>
              <CardDescription>
                Individual firewall scores for {tenantName ?? customerName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firewall</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Last Assessed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalFirewalls.map((fw) => (
                    <TableRow key={fw.agentId}>
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
                      <TableCell className="font-medium tabular-nums">
                        {fw.score ?? "—"}
                      </TableCell>
                      <TableCell>
                        {fw.grade ? (
                          <span
                            className={cn(
                              "font-bold",
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
            </CardContent>
          </Card>
        )}

        {/* Assessment History */}
        {sectionVisible("history") && (
          <Card>
            <CardHeader>
              <CardTitle>Assessment History</CardTitle>
              <CardDescription>
                Past assessments with score and finding count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyReversed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No assessment history yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Findings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyReversed.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.assessed_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {entry.overall_score}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-bold",
                              GRADE_COLORS[entry.overall_grade] ??
                                GRADE_COLORS.C,
                            )}
                          >
                            {entry.overall_grade}
                          </span>
                        </TableCell>
                        <TableCell>{entry.findings_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Findings Summary */}
        {sectionVisible("findings") && (
          <Card>
            <CardHeader>
              <CardTitle>Findings Summary</CardTitle>
              <CardDescription>
                Latest findings grouped by severity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {(
                  ["critical", "high", "medium", "low", "info"] as Severity[]
                ).map((s) => (
                  <Badge
                    key={s}
                    variant={severityFilter.has(s) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer capitalize",
                      severityFilter.has(s) && SEVERITY_COLORS[s],
                    )}
                    onClick={() => toggleSeverity(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
              {findings.length === 0 ? (
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
                      className="flex items-center gap-2 py-2 border-b border-border last:border-0"
                    >
                      <Badge
                        className={cn(
                          "shrink-0 capitalize",
                          SEVERITY_COLORS[f.severity],
                        )}
                      >
                        {f.severity}
                      </Badge>
                      <span className="text-sm text-foreground">{f.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Compliance Status */}
        {sectionVisible("compliance") && frameworks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>
                Posture per selected framework
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {frameworks.map((fw) => (
                  <div
                    key={fw.framework}
                    className="flex flex-wrap items-center gap-4"
                  >
                    <span className="font-medium text-foreground">
                      {fw.framework}
                    </span>
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className="text-green-600 dark:text-green-400"
                      >
                        Pass: {fw.pass}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-amber-600 dark:text-amber-400"
                      >
                        Partial: {fw.partial}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-red-600 dark:text-red-400"
                      >
                        Fail: {fw.fail}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Downloads */}
        {sectionVisible("reports") && (
          <Card>
            <CardHeader>
              <CardTitle>Report Downloads</CardTitle>
              <CardDescription>
                Download your assessment reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled>
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" disabled>
                  <FileText className="h-4 w-4" />
                  Download Word
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SLA Information */}
        {showBranding && branding?.slaInfo && (
          <Card>
            <CardHeader>
              <CardTitle>Service Level Agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {branding.slaInfo}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Feedback Section */}
        {sectionVisible("feedback") && (
          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
              <CardDescription>Rate your experience (1-5 stars)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeedbackStars(n)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
                        feedbackStars >= n
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Additional feedback (optional)"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button
                onClick={handleFeedbackSubmit}
                disabled={feedbackStars === 0}
                style={accentColor !== "#2006F7" ? { backgroundColor: accentColor } : undefined}
              >
                <Send className="h-4 w-4" />
                Submit Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        {showBranding &&
          (branding?.contactEmail || branding?.contactPhone) && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Your MSP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6">
                  {branding.contactEmail && (
                    <a
                      href={`mailto:${branding.contactEmail}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                      style={{ color: accentColor }}
                    >
                      <Mail className="h-4 w-4" />
                      {branding.contactEmail}
                    </a>
                  )}
                  {branding.contactPhone && (
                    <a
                      href={`tel:${branding.contactPhone}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                      style={{ color: accentColor }}
                    >
                      <Phone className="h-4 w-4" />
                      {branding.contactPhone}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground text-center">
            {showBranding && branding?.footerText
              ? branding.footerText
              : "Powered by Sophos FireComply"}
          </p>
        </div>
      </footer>
    </div>
  );
}
