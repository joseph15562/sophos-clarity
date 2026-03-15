/**
 * White-Label Client Portal — read-only view for MSP clients.
 * Displays security assessment status, score history, findings, compliance, and feedback.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Sun, Download, FileText, Star, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

const STORAGE_KEYS = {
  customerName: "firecomply-portal-customer-name",
  logoUrl: "firecomply-portal-logo-url",
  mspColors: "firecomply-portal-msp-colors",
  findings: "firecomply-portal-findings",
  frameworks: "firecomply-portal-frameworks",
  assessmentRequests: "firecomply-assessment-requests",
  feedback: "firecomply-client-feedback",
} as const;

function getStored<T>(key: string, tenantId: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (typeof parsed === "object" && parsed[tenantId] !== undefined)
      ? (parsed[tenantId] as T)
      : (parsed as T);
  } catch {
    return null;
  }
}

function setStored<T>(key: string, tenantId: string, value: T): void {
  try {
    const existing = localStorage.getItem(key);
    let obj: Record<string, T> = {};
    if (existing) {
      try {
        obj = JSON.parse(existing) as Record<string, T>;
      } catch {
        /* ignore */
      }
    }
    obj[tenantId] = value;
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (e) {
    console.warn("[ClientPortal] setStored failed", e);
  }
}

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

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const cx = 110;
  const cy = 110;
  const r = 42;
  const strokeWidth = 6;
  const filledEnd = scoreToAngle(score);
  const trackPath = arcPath(cx, cy, r, 150, 390);
  const filledPath = arcPath(cx, cy, r, 150, filledEnd);
  const fillColor = score <= 40 ? "#EA0022" : score <= 75 ? "#F29400" : "#00995a";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={220} height={180} viewBox="0 0 220 180" className="overflow-visible">
        <path d={trackPath} fill="none" stroke="rgb(229 231 235)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path
          d={filledPath}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={score > 75 ? "dark:!stroke-[#00F2B3]" : ""}
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn("text-2xl font-black", GRADE_COLORS[grade] ?? GRADE_COLORS.C)}
        >
          {grade}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-sm font-medium">
          {score}
        </text>
      </svg>
    </div>
  );
}

export default function ClientPortal() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [findings, setFindings] = useState<PortalFinding[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkCompliance[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set(["critical", "high", "medium", "low", "info"]));
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setError("Missing tenant ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const name = getStored<string>(STORAGE_KEYS.customerName, tenantId)
        ?? new URLSearchParams(window.location.search).get("customer")
        ?? "Customer";
      setCustomerName(name);

      const history = await loadScoreHistory(tenantId, undefined, 30);
      setScoreHistory(history);

      const storedFindings = getStored<PortalFinding[]>(STORAGE_KEYS.findings, tenantId);
      setFindings(Array.isArray(storedFindings) ? storedFindings : []);

      const storedFrameworks = getStored<FrameworkCompliance[]>(STORAGE_KEYS.frameworks, tenantId);
      setFrameworks(Array.isArray(storedFrameworks) ? storedFrameworks : []);

      if (history.length === 0 && !storedFindings?.length && !storedFrameworks?.length) {
        setError("No assessment data found for this tenant.");
      }
    } catch (err) {
      console.warn("[ClientPortal] load failed", err);
      setError("Failed to load portal data.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSeverity = (s: Severity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleRequestAssessment = () => {
    if (!tenantId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.assessmentRequests);
      const requests: Array<{ tenantId: string; requestedAt: string }> = raw ? JSON.parse(raw) : [];
      requests.push({ tenantId, requestedAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEYS.assessmentRequests, JSON.stringify(requests));
    } catch { /* ignore */ }
    toast({
      title: "Assessment requested",
      description: "Your MSP has been notified. They will contact you to schedule the assessment.",
    });
  };

  const handleFeedbackSubmit = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.feedback);
      const entries: Array<{ tenantId?: string; stars: number; text: string; at: string }> = raw ? JSON.parse(raw) : [];
      entries.push({ tenantId, stars: feedbackStars, text: feedbackText, at: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEYS.feedback, JSON.stringify(entries));
    } catch { /* ignore */ }
    toast({
      title: "Thank you",
      description: "Your feedback has been submitted.",
    });
    setFeedbackStars(0);
    setFeedbackText("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && scoreHistory.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 px-4">
        <h1 className="text-xl font-semibold text-foreground mb-2">Client Portal</h1>
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

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {customerName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-foreground truncate">
                {customerName}
              </h1>
              <p className="text-xs text-muted-foreground">Firewall Configuration Assessment</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Score Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Score Summary</CardTitle>
            <CardDescription>Your current security assessment score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ScoreGauge
                score={latest?.overall_score ?? 0}
                grade={latest?.overall_grade ?? "—"}
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
                        "font-medium",
                        latest.overall_score > previous.overall_score
                          ? "text-green-600 dark:text-green-400"
                          : latest.overall_score < previous.overall_score
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
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

        {/* Assessment History */}
        <Card>
          <CardHeader>
            <CardTitle>Assessment History</CardTitle>
            <CardDescription>Past assessments with score and finding count</CardDescription>
          </CardHeader>
          <CardContent>
            {historyReversed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No assessment history yet.</p>
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
                        {new Date(entry.assessed_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{entry.overall_score}</TableCell>
                      <TableCell>
                        <span className={cn("font-bold", GRADE_COLORS[entry.overall_grade] ?? GRADE_COLORS.C)}>
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

        {/* Findings Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Findings Summary</CardTitle>
            <CardDescription>Latest findings grouped by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                <Badge
                  key={s}
                  variant={severityFilter.has(s) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer capitalize",
                    severityFilter.has(s) && SEVERITY_COLORS[s]
                  )}
                  onClick={() => toggleSeverity(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No findings data available.</p>
            ) : filteredFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No findings match the selected filters.</p>
            ) : (
              <ul className="space-y-2">
                {filteredFindings.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 py-2 border-b border-border last:border-0"
                  >
                    <Badge className={cn("shrink-0 capitalize", SEVERITY_COLORS[f.severity])}>
                      {f.severity}
                    </Badge>
                    <span className="text-sm text-foreground">{f.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Compliance Status */}
        {frameworks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>Posture per selected framework</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {frameworks.map((fw) => (
                  <div key={fw.framework} className="flex flex-wrap items-center gap-4">
                    <span className="font-medium text-foreground">{fw.framework}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">
                        Pass: {fw.pass}
                      </Badge>
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                        Partial: {fw.partial}
                      </Badge>
                      <Badge variant="outline" className="text-red-600 dark:text-red-400">
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
        <Card>
          <CardHeader>
            <CardTitle>Report Downloads</CardTitle>
            <CardDescription>Download your assessment reports</CardDescription>
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

        {/* Request Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Request Assessment</CardTitle>
            <CardDescription>Request a new security assessment from your MSP</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRequestAssessment}>
              Request Assessment
            </Button>
          </CardContent>
        </Card>

        {/* Feedback Section */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback</CardTitle>
            <CardDescription>Rate your experience (1–5 stars)</CardDescription>
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
                      feedbackStars >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
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
            <Button onClick={handleFeedbackSubmit} disabled={feedbackStars === 0}>
              <Send className="h-4 w-4" />
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
