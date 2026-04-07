import {
  Building2,
  ChevronDown,
  FileText,
  History,
  LayoutDashboard,
  MousePointerClick,
  Settings,
} from "lucide-react";
import {
  FeatureButton,
  FeatureOverlay,
  MockHistoryChart,
  MockSavedReports,
  MockSettingsPanel,
  MockTenantDashboard,
} from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
  orgName?: string;
};

export function GuideManagementStep({ activeOverlay, setActiveOverlay, orgName }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "mgmt-dashboard" && (
        <FeatureOverlay
          title="Multi-Tenant Dashboard"
          subtitle="Overview of all customer assessments"
          onClose={() => setActiveOverlay(null)}
        >
          <MockTenantDashboard />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you see:</strong> Every customer&apos;s
              latest risk score, grade, firewall count, and score trend at a glance. Includes
              licence expiry warnings for your managed estate.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "mgmt-reports" && (
        <FeatureOverlay
          title="Saved Reports"
          subtitle="Browse and reload previously saved reports"
          onClose={() => setActiveOverlay(null)}
        >
          <MockSavedReports />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you see:</strong> A searchable library of
              every report your team has saved. Filter by customer, report type, or date. Click any
              row to reload the full report in the viewer.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "mgmt-history" && (
        <FeatureOverlay
          title="Assessment History"
          subtitle="Track scores over time per customer"
          onClose={() => setActiveOverlay(null)}
        >
          <MockHistoryChart />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you see:</strong> A trend line of risk scores
              for each customer over time. Demonstrate security improvements and track the impact of
              your remediation work.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "mgmt-settings" && (
        <FeatureOverlay
          title="Settings"
          subtitle="Central API, security, team, alerts, and more"
          onClose={() => setActiveOverlay(null)}
        >
          <MockSettingsPanel />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you see:</strong> Manage your Sophos Central
              API, connector agents, team members and roles, client portal branding, MFA and
              passkeys, alert rules, custom compliance frameworks, and audit log — all in one place.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          The Management Panel
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Click your <strong className="text-foreground">organisation name</strong> in the top
          navbar to open it. Click each tab below to preview.
        </p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-[#001A47] px-4 py-2.5 flex items-center gap-3">
          <img
            src="/sophos-icon-white.svg"
            alt=""
            className="h-5 w-5"
            loading="lazy"
            decoding="async"
          />
          <span className="text-[11px] font-bold text-white flex-1">Sophos FireComply</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20">
            <Building2 className="h-3 w-3 text-white/70" />
            <span className="text-[10px] font-medium text-white">{orgName || "Your Org"}</span>
            <ChevronDown className="h-2.5 w-2.5 text-white/70" />
          </div>
          <MousePointerClick className="h-4 w-4 text-[#00EDFF] animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <FeatureButton
          icon={<LayoutDashboard className="h-4 w-4" />}
          title="Dashboard"
          desc="Multi-tenant overview of all customer scores and licence expiry"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("mgmt-dashboard")}
        />
        <FeatureButton
          icon={<FileText className="h-4 w-4" />}
          title="Reports"
          desc="Browse and reload all previously saved reports"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("mgmt-reports")}
        />
        <FeatureButton
          icon={<History className="h-4 w-4" />}
          title="History"
          desc="Track assessment scores over time per customer"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("mgmt-history")}
        />
        <FeatureButton
          icon={<Settings className="h-4 w-4" />}
          title="Settings"
          desc="Central API, team management, activity log, and re-run setup"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("mgmt-settings")}
        />
      </div>
    </div>
  );
}
