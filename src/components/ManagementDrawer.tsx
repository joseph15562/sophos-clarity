import { useState, lazy, Suspense, type ReactNode } from "react";
import { X, LayoutDashboard, FileText, History, Settings, ChevronRight } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { RerunSetupButton } from "@/components/SetupWizard";

const TenantDashboard = lazy(() => import("@/components/TenantDashboard").then((m) => ({ default: m.TenantDashboard })));
const LicenceExpiryWidget = lazy(() => import("@/components/LicenceExpiryWidget").then((m) => ({ default: m.LicenceExpiryWidget })));
const SavedReportsLibrary = lazy(() => import("@/components/SavedReportsLibrary").then((m) => ({ default: m.SavedReportsLibrary })));
const AssessmentHistory = lazy(() => import("@/components/AssessmentHistory").then((m) => ({ default: m.AssessmentHistory })));
const CentralIntegration = lazy(() => import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })));
const InviteStaff = lazy(() => import("@/components/InviteStaff").then((m) => ({ default: m.InviteStaff })));
const AuditLog = lazy(() => import("@/components/AuditLog").then((m) => ({ default: m.AuditLog })));

type TabId = "dashboard" | "reports" | "history" | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
  guestVisible: boolean;
}

const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" />, guestVisible: false },
  { id: "reports", label: "Reports", icon: <FileText className="h-3.5 w-3.5" />, guestVisible: true },
  { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" />, guestVisible: true },
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

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="border-t border-border">{children}</div>}
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
}: Props) {
  const visibleTabs = TABS.filter((t) => t.guestVisible || !isGuest);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? visibleTabs[0]?.id ?? "reports");

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
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-display font-bold text-foreground truncate">
              {orgName || "Management"}
            </h2>
            <p className="text-[10px] text-muted-foreground">
              {isGuest ? "Reports & assessment history" : "Dashboard, reports & settings"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card shrink-0 px-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
                currentTab === tab.id
                  ? "border-[#2006F7] text-[#2006F7] dark:text-[#6B5BFF]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentTab === "dashboard" && (
            <div className="space-y-0">
              <Suspense fallback={<Skeleton />}>
                <TenantDashboard />
              </Suspense>
              <Suspense fallback={<Skeleton />}>
                <div className="px-4 pb-4">
                  <LicenceExpiryWidget />
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
            <div className="p-4">
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
            </div>
          )}

          {currentTab === "settings" && (
            <div className="p-4 space-y-3">
              {onRerunSetup && <RerunSetupButton onClick={onRerunSetup} />}
              <SettingsSection title="Sophos Central API">
                <div className="p-4">
                  <Suspense fallback={<Skeleton />}>
                    <CentralIntegration />
                  </Suspense>
                </div>
              </SettingsSection>
              <SettingsSection title="Team Management">
                <div className="p-4">
                  <Suspense fallback={<Skeleton />}>
                    <InviteStaff />
                  </Suspense>
                </div>
              </SettingsSection>
              <SettingsSection title="Activity Log">
                <Suspense fallback={<Skeleton />}>
                  <AuditLog />
                </Suspense>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
