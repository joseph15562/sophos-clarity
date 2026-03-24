import { useState, useEffect, lazy, Suspense, type ReactNode } from "react";
import { X, LayoutDashboard, FileText, History, Settings, ChevronRight, Wifi, Users, Activity, Shield, Trash2, Bell, Mail, Plane, Plug, Fingerprint, Code, Eye, ClipboardCheck, Globe, Webhook, FileStack } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { RerunSetupButton } from "@/components/SetupWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { computeRiskScore } from "@/lib/risk-score";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiDocumentation } from "@/components/ApiDocumentation";
import { ClientPortalView, type Assessment } from "@/components/ClientPortalView";
import { loadHistory } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";

const TenantDashboard = lazy(() => import("@/components/TenantDashboard").then((m) => ({ default: m.TenantDashboard })));
const LicenceExpiryWidget = lazy(() => import("@/components/LicenceExpiryWidget").then((m) => ({ default: m.LicenceExpiryWidget })));
const AssessmentScheduler = lazy(() => import("@/components/AssessmentScheduler").then((m) => ({ default: m.AssessmentScheduler })));
const SavedReportsLibrary = lazy(() => import("@/components/SavedReportsLibrary").then((m) => ({ default: m.SavedReportsLibrary })));
const AssessmentHistory = lazy(() => import("@/components/AssessmentHistory").then((m) => ({ default: m.AssessmentHistory })));
const ConfigHistory = lazy(() => import("@/components/ConfigHistory").then((m) => ({ default: m.ConfigHistory })));
const CentralIntegration = lazy(() => import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })));
const InviteStaff = lazy(() => import("@/components/InviteStaff").then((m) => ({ default: m.InviteStaff })));
const AuditLog = lazy(() => import("@/components/AuditLog").then((m) => ({ default: m.AuditLog })));
const AlertSettings = lazy(() => import("@/components/AlertSettings").then((m) => ({ default: m.AlertSettings })));
const ScheduledReportSettings = lazy(() => import("@/components/ScheduledReportSettings").then((m) => ({ default: m.ScheduledReportSettings })));
const AgentManager = lazy(() => import("@/components/AgentManager").then((m) => ({ default: m.AgentManager })));
const MfaEnrollment = lazy(() => import("@/components/MfaEnrollment").then((m) => ({ default: m.MfaEnrollment })));
const PasskeyManager = lazy(() => import("@/components/PasskeyManager").then((m) => ({ default: m.PasskeyManager })));
const CustomFrameworkBuilder = lazy(() => import("@/components/CustomFrameworkBuilder").then((m) => ({ default: m.CustomFrameworkBuilder })));
const PortalConfigurator = lazy(() => import("@/components/PortalConfigurator").then((m) => ({ default: m.PortalConfigurator })));
const WebhookSettings = lazy(() => import("@/components/WebhookSettings").then((m) => ({ default: m.WebhookSettings })));
const ReportTemplateSettings = lazy(() => import("@/components/ReportTemplateSettings").then((m) => ({ default: m.ReportTemplateSettings })));

type TabId = "dashboard" | "reports" | "history" | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
  guestVisible: boolean;
}

const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" />, guestVisible: false },
  { id: "reports", label: "Reports", icon: <FileText className="h-3.5 w-3.5" />, guestVisible: false },
  { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" />, guestVisible: false },
  { id: "settings", label: "Settings", icon: <Settings className="h-3.5 w-3.5" />, guestVisible: false },
];

interface Props {
  open: boolean;
  onClose: () => void;
  isGuest: boolean;
  orgName?: string;
  analysisResults: Record<string, AnalysisResult>;
  customerName: string;
  environment: string;
  onLoadReports: (args: unknown) => void;
  savedReportsTrigger?: number;
  hasFiles: boolean;
  initialTab?: TabId;
  onRerunSetup?: () => void;
  localMode: boolean;
  onLocalModeChange: (enabled: boolean) => void;
  /** Optional: called when client clicks "Download Latest Report" in Client View preview */
  onDownloadReport?: () => void;
}

function Skeleton() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-4 bg-muted/40 rounded w-3/4" />
      <div className="h-4 bg-muted/40 rounded w-1/2" />
      <div className="h-32 bg-muted/40 rounded" />
    </div>
  );
}

function SettingsSection({ title, icon, subtitle, children }: { title: string; icon?: ReactNode; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/85 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors group ${open ? "bg-[#2006F7]/[0.03] dark:bg-brand-accent/[0.08]" : "hover:bg-muted/20"}`}
      >
        {icon && <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${open ? "bg-brand-accent/10 dark:bg-[#00EDFF]/10" : "bg-muted/20 group-hover:bg-muted/30"}`}>{icon}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">{title}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200 shrink-0 ${open ? "rotate-90 text-brand-accent" : ""}`} />
      </button>
      {open && <div className="border-t border-border/40 bg-background/50">{children}</div>}
    </div>
  );
}

function DataGovernanceSection({ orgId: _orgId }: { orgId?: string }) {
  const { org } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleDelete = async () => {
    const id = org?.id;
    if (!id) return;
    setDeleting(true);
    try {
      await supabase.from("finding_snapshots").delete().eq("org_id", id);
      await supabase.from("remediation_status").delete().eq("org_id", id);
      await supabase.from("shared_reports").delete().eq("org_id", id);
      await supabase.from("alert_rules").delete().eq("org_id", id);
      await supabase.from("audit_log").delete().eq("org_id", id);
      await supabase.from("saved_reports").delete().eq("org_id", id);
      await supabase.from("assessments").delete().eq("org_id", id);
      await supabase.from("central_firewalls").delete().eq("org_id", id);
      await supabase.from("central_tenants").delete().eq("org_id", id);
      await supabase.from("central_credentials").delete().eq("org_id", id);
      setDeleted(true);
      setShowConfirm(false);
    } catch (err) {
      console.warn("[DataGovernance] Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-xs text-muted-foreground leading-relaxed">
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">Data Residency</p>
        <p>Cloud data is stored in the Sophos FireComply platform database hosted on Supabase. Firewall configuration files are processed client-side in your browser and are never uploaded or stored on any server. Raw configuration data does not leave your machine.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">What We Store in the Cloud</p>
        <p>Assessments, saved reports, finding snapshots, remediation progress, alert rules, shared report links, audit logs, Sophos Central credentials (encrypted), and cached firewall metadata. All data is scoped to your organisation with row-level security.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">AI Report Generation</p>
        <p>When generating AI reports, configuration data is <span className="font-semibold text-foreground">anonymised before transmission</span>. IP addresses, hostnames, and network names are replaced with placeholder values. The anonymised data is sent to Google Gemini via a Supabase Edge Function. No raw configuration data is stored by the AI provider.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">Deterministic Analysis</p>
        <p>Security findings, risk scoring, and compliance mappings are computed entirely in your browser. No raw config data leaves your machine for analysis.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">External Services</p>
        <p>The following optional features make external API calls from your browser:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><span className="font-medium text-foreground">AI Reports</span> — anonymised config sent to Google Gemini via Supabase Edge Function</li>
          <li><span className="font-medium text-foreground">Geo-IP Lookup</span> — public IPs sent to ip-api.com to resolve geographic location (no authentication data)</li>
          <li><span className="font-medium text-foreground">CVE Correlation</span> — service names queried against the NIST NVD API for known vulnerabilities (no firewall data sent)</li>
        </ul>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">Sophos Central API</p>
        <p>API credentials are encrypted with AES-256-GCM before storage. The encryption key is held separately in the server environment and is not accessible from the database. API calls to Sophos Central are proxied through a server-side function — credentials are never exposed to the browser after initial setup.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">Connector Agent</p>
        <p>The FireComply Connector agent runs on your network and communicates with your Sophos firewalls via their local XML API. Assessment results are submitted to the FireComply platform via an authenticated server-side function. The agent stores its API key locally and never exposes firewall credentials externally.</p>
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-foreground text-[11px]">Shared Reports</p>
        <p>When you share a report, a time-limited public link is created (default 7 days). The report content is stored on the platform and accessible without authentication via the share token. No firewall configuration data is included — only the generated report text.</p>
      </div>

      {org?.id && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="font-semibold text-foreground text-[11px]">Delete All Data</p>
          <p>Permanently remove all cloud-stored data for this workspace: assessments, saved reports, finding snapshots, remediation status, alert rules, shared reports, audit logs, Central credentials, and cached firewall data.</p>
          {deleted ? (
            <p className="text-[#00F2B3] font-semibold">All data deleted successfully.</p>
          ) : showConfirm ? (
            <div className="space-y-2">
              <p className="text-[#EA0022] font-semibold">This action cannot be undone. Type "DELETE" to confirm.</p>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full text-xs"
                placeholder='Type "DELETE" to confirm'
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || deleting}
                  variant="destructive"
                  className="gap-1.5 text-[10px] h-8"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleting ? "Deleting…" : "Delete All Data"}
                </Button>
                <Button onClick={() => { setShowConfirm(false); setConfirmText(""); }} variant="outline" className="text-[10px] h-8">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowConfirm(true)}
              variant="outline"
              className="gap-1.5 text-[10px] h-8 border-[#EA0022]/30 text-[#EA0022] hover:bg-[#EA0022]/5 hover:text-[#EA0022]"
            >
              <Trash2 className="h-3 w-3" /> Delete All Data…
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ManagementDrawer({
  open,
  onClose,
  isGuest,
  orgName,
  analysisResults,
  customerName,
  environment,
  onLoadReports,
  savedReportsTrigger,
  hasFiles,
  initialTab,
  onRerunSetup,
  localMode,
  onLocalModeChange,
  onDownloadReport,
}: Props) {
  const { org, isViewerOnly, canManageTeam } = useAuth();
  const [clientViewOpen, setClientViewOpen] = useState(false);
  const [clientViewAssessments, setClientViewAssessments] = useState<Assessment[]>([]);
  const [clientViewScoreHistory, setClientViewScoreHistory] = useState<ScoreHistoryEntry[]>([]);

  useEffect(() => {
    if (!clientViewOpen) return;
    let cancelled = false;
    (async () => {
      const useCloud = !isGuest && !!org;
      const snapshots = useCloud ? await loadHistoryCloud() : await loadHistory();
      if (cancelled) return;
      const assessments: Assessment[] = snapshots
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((s) => ({
          id: s.id,
          date: new Date(s.timestamp).toISOString(),
          score: s.overallScore,
          grade: s.overallGrade,
          label: s.environment,
        }));
      if (Object.keys(analysisResults).length > 0) {
        const scores = Object.values(analysisResults).map((r) => computeRiskScore(r).overall);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const grade = avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 40 ? "D" : "F";
        assessments.unshift({
          id: "current",
          date: new Date().toISOString(),
          score: avgScore,
          grade,
          label: "Current",
        });
      }
      setClientViewAssessments(assessments);

      if (org?.id) {
        const history = await loadScoreHistory(org.id, undefined, 30);
        if (!cancelled) setClientViewScoreHistory(history);
      } else {
        setClientViewScoreHistory([]);
      }
    })();
    return () => { cancelled = true; };
  }, [clientViewOpen, isGuest, org, analysisResults]);
  const visibleTabs = TABS.filter((t) => t.guestVisible || !isGuest);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? visibleTabs[0]?.id ?? "reports");

  useEffect(() => {
    if (initialTab && open) setActiveTab(initialTab);
  }, [initialTab, open]);

  if (!open) return null;

  const currentTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg border-l border-brand-accent/10 bg-[radial-gradient(circle_at_top_right,rgba(32,6,247,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,251,255,0.98))] dark:bg-[radial-gradient(circle_at_top_right,rgba(32,6,247,0.16),transparent_26%),linear-gradient(180deg,rgba(9,13,24,0.99),rgba(12,17,30,0.99))] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border/70 shrink-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />
          <div className="flex items-center gap-3 px-5 py-4 bg-card/70 backdrop-blur-sm">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent mb-1">Workspace controls</p>
              <h2 className="text-base font-display font-black text-foreground truncate">
                {isGuest ? "Settings" : (orgName || "Management")}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {isGuest ? "Reports & assessment history" : "Dashboard, reports, team controls, integrations"}
              </p>
            </div>
            <div className="flex items-center gap-1">
            {canManageTeam && (
              <Dialog open={clientViewOpen} onOpenChange={setClientViewOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-1.5 text-[10px] h-8"
                    title="Preview client portal view"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Client View
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                  <div className="min-h-[400px]">
                    <ClientPortalView
                      customerName={customerName || "Customer"}
                      assessments={clientViewAssessments}
                      scoreHistory={clientViewScoreHistory}
                      onDownloadReport={onDownloadReport}
                      orgId={org?.id}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

        {/* Tabs */}
        <div className="border-b border-border/70 bg-card/60 shrink-0 px-3 py-2">
          <div className="flex gap-2 rounded-2xl bg-muted/30 p-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                data-tour={`drawer-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition-all ${
                  currentTab === tab.id
                    ? "bg-background text-brand-accent shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentTab === "dashboard" && (
            <div className="space-y-0">
              <Suspense fallback={<Skeleton />}>
                <div data-tour="tenant-dashboard">
                  <TenantDashboard />
                </div>
              </Suspense>
              {!isGuest && org?.id && (
                <Suspense fallback={<Skeleton />}>
                  <div className="px-4 pb-2" data-tour="score-trend-chart">
                    <ScoreTrendChart orgId={org.id} />
                  </div>
                </Suspense>
              )}
              <Suspense fallback={<Skeleton />}>
                <div className="px-4 pb-4 space-y-4">
                  <div data-tour="licence-expiry">
                    <LicenceExpiryWidget />
                  </div>
                  <div data-tour="assessment-scheduler">
                    <AssessmentScheduler />
                  </div>
                </div>
              </Suspense>
            </div>
          )}

          {currentTab === "reports" && (
            <div className="p-4">
              <Suspense fallback={<Skeleton />}>
                <SavedReportsLibrary onLoadReports={onLoadReports} refreshTrigger={savedReportsTrigger} />
              </Suspense>
            </div>
          )}

          {currentTab === "history" && (
            <div className="p-4 space-y-6">
              {hasFiles ? (
                <Suspense fallback={<Skeleton />}>
                  <AssessmentHistory
                    analysisResults={analysisResults}
                    customerName={customerName}
                    environment={environment}
                  />
                </Suspense>
              ) : (
                <div className="text-center py-12 space-y-2">
                  <History className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    Upload a firewall config to view assessment history.
                  </p>
                </div>
              )}
              <Suspense fallback={<Skeleton />}>
                <ConfigHistory refreshTrigger={savedReportsTrigger} />
              </Suspense>
            </div>
          )}

          {currentTab === "settings" && (
            <div className="p-4 sm:p-5 space-y-2.5">
              {onRerunSetup && <RerunSetupButton onClick={onRerunSetup} />}

              {/* Local Mode toggle */}
              <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.05),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.12),rgba(0,242,179,0.04))] overflow-hidden shadow-card">
                <div className="flex items-center justify-between px-5 py-4 gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
                      <Plane className="h-4.5 w-4.5 text-brand-accent" />
                    </div>
                    <div>
                      <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">Local Mode</p>
                      <p className="text-[10px] text-muted-foreground/60">Air-gapped / offline operation with no external API calls</p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={localMode}
                    onClick={() => onLocalModeChange(!localMode)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2006F7] focus-visible:ring-offset-2 ${
                      localMode ? "bg-[#2006F7] dark:bg-[#00EDFF]" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                        localMode ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {localMode && (
                  <div className="border-t border-border/70 px-4 py-3 bg-[#F29400]/5 dark:bg-[#F29400]/10">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Local mode enabled.</strong> AI report generation and Sophos Central integration are disabled. All analysis, scoring, and compliance mapping run client-side. Data is saved to IndexedDB/localStorage only.
                    </p>
                  </div>
                )}
              </div>

              {!localMode && (
              <SettingsSection title="Sophos Central API" icon={<Wifi className="h-3.5 w-3.5 text-[#005BC8]" />} subtitle="Manage your API connection">
                <div className="p-4">
                  <Suspense fallback={<Skeleton />}>
                    <CentralIntegration />
                  </Suspense>
                </div>
              </SettingsSection>
              )}
              {!localMode && !isViewerOnly && (
              <SettingsSection title="FireComply Connector Agents" icon={<Plug className="h-3.5 w-3.5 text-[#6B5BFF]" />} subtitle="Automated firewall monitoring agents">
                <div className="p-4">
                  <Suspense fallback={<Skeleton />}>
                    <AgentManager />
                  </Suspense>
                </div>
              </SettingsSection>
              )}
              {canManageTeam && (
              <div data-tour="drawer-team">
                <SettingsSection title="Team Management" icon={<Users className="h-3.5 w-3.5 text-[#2006F7]" />} subtitle="Invite and manage team members">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <InviteStaff />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              )}
              {canManageTeam && (
              <div data-tour="drawer-portal">
                <SettingsSection title="Client Portal" icon={<Globe className="h-3.5 w-3.5 text-[#009CFB]" />} subtitle="Branding, sections & customer access">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <PortalConfigurator />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              )}
              <SettingsSection title="Security" icon={<Fingerprint className="h-3.5 w-3.5 text-[#00F2B3]" />} subtitle="MFA and passkey settings">
                <div className="p-4 space-y-6">
                  <div data-tour="drawer-mfa">
                    <Suspense fallback={<Skeleton />}>
                      <MfaEnrollment />
                    </Suspense>
                  </div>
                  <div data-tour="drawer-passkeys">
                    <Suspense fallback={<Skeleton />}>
                      <PasskeyManager />
                    </Suspense>
                  </div>
                </div>
              </SettingsSection>
              <div data-tour="drawer-audit">
                <SettingsSection title="Activity Log" icon={<Activity className="h-3.5 w-3.5 text-[#6B5BFF]" />} subtitle="Review workspace activity">
                  <Suspense fallback={<Skeleton />}>
                    <AuditLog />
                  </Suspense>
                </SettingsSection>
              </div>
              <div data-tour="drawer-alerts">
                <SettingsSection title="Alerts" icon={<Bell className="h-3.5 w-3.5 text-[#F29400]" />} subtitle="Email and webhook notifications">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <AlertSettings />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              {canManageTeam && (
              <div data-tour="drawer-webhooks">
                <SettingsSection title="Integrations (Webhook)" icon={<Webhook className="h-3.5 w-3.5 text-[#5A00FF]" />} subtitle="Notify a URL when reports are saved">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <WebhookSettings />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              )}
              <div data-tour="drawer-scheduled-reports">
                <SettingsSection title="Scheduled Reports" icon={<Mail className="h-3.5 w-3.5 text-[#009CFB]" />} subtitle="Auto-send compliance reports to clients">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <ScheduledReportSettings />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              <div data-tour="custom-frameworks">
                <SettingsSection title="Custom Compliance Frameworks" icon={<ClipboardCheck className="h-3.5 w-3.5 text-[#5A00FF]" />} subtitle="Create and manage custom compliance frameworks">
                  <div className="p-4">
                    <Suspense fallback={<Skeleton />}>
                      <CustomFrameworkBuilder />
                    </Suspense>
                  </div>
                </SettingsSection>
              </div>
              {canManageTeam && (
              <SettingsSection title="Report template" icon={<FileStack className="h-3.5 w-3.5 text-[#5A00FF]" />} subtitle="Custom sections/headings for generated reports">
                <div className="p-4">
                  <Suspense fallback={<Skeleton />}>
                    <ReportTemplateSettings />
                  </Suspense>
                </div>
              </SettingsSection>
              )}
              <SettingsSection title="API Documentation" icon={<Code className="h-3.5 w-3.5 text-[#6B5BFF]" />} subtitle="REST API reference">
                <div className="p-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-2 text-[11px] font-medium text-brand-accent hover:underline">
                        <Code className="h-3.5 w-3.5" />
                        View API Reference
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                      <ApiDocumentation />
                    </DialogContent>
                  </Dialog>
                </div>
              </SettingsSection>
              <SettingsSection title="How We Handle Your Data" icon={<Shield className="h-3.5 w-3.5 text-[#00F2B3]" />} subtitle="Data privacy and governance">
                <DataGovernanceSection orgId={orgName} />
              </SettingsSection>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
