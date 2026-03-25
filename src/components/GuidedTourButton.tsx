import {
  HelpCircle,
  Compass,
  BarChart3,
  Shield,
  GitCompare,
  Wrench,
  Map,
  LayoutGrid,
  Link2,
  Download,
  Share2,
  Users,
  Bell,
  Clock,
  Building2,
  Zap,
  Gauge,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TourCallbacks } from "@/lib/guided-tours";
import {
  startGettingStartedTour,
  startDashboardTour,
  startRiskScoreTour,
  startComplianceTour,
  startConfigDiffTour,
  startRemediationTour,
  startBaselineTour,
  startMapsTour,
  startWidgetTour,
  startCentralTour,
  startConnectorTour,
  startExportTour,
  startPortalTour,
  startManagementTour,
  startTeamTour,
  startAlertsTour,
  startSchedulingTour,
  startTenantDashboardTour,
  startPowerUserTour,
} from "@/lib/guided-tours";

const LBL =
  "flex items-center gap-2 px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-brand-accent";
const ITEM =
  "relative rounded-xl px-2.5 py-2 text-[12px] font-medium text-foreground/90 cursor-pointer transition-all duration-150 hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.06] focus:bg-white/80 dark:focus:bg-white/[0.06] focus:text-foreground";
const ICON = "h-3.5 w-3.5 mr-2.5 shrink-0";
const SEP = "my-1.5 h-px bg-white/80 dark:bg-white/[0.06]";

interface Props {
  hasFiles: boolean;
  hasReports: boolean;
  isGuest: boolean;
  tourCallbacks: TourCallbacks;
}

export function GuidedTourButton({ hasFiles, hasReports, isGuest, tourCallbacks }: Props) {
  const cb = tourCallbacks;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] text-[10px] font-bold text-slate-800 hover:text-slate-950 dark:text-muted-foreground dark:hover:text-foreground transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
          style={{
            background: "linear-gradient(145deg, rgba(0,242,179,0.06), rgba(0,242,179,0.02))",
          }}
          title="Guided tours"
          aria-label="Guided tours"
        >
          <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full blur-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-25 pointer-events-none bg-[#00F2B3]" />
          <Compass className="h-3 w-3 text-[#00F2B3]" />
          Tours
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="relative overflow-hidden w-64 max-h-[70vh] overflow-y-auto rounded-2xl border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-xl shadow-elevated p-2"
        style={{
          background: "linear-gradient(145deg, rgba(12,18,34,0.96), rgba(8,13,26,0.98))",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,242,179,0.25), transparent)",
          }}
        />
        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[28px] opacity-15 pointer-events-none bg-[#00F2B3]" />

        {/* Getting Started */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className={LBL}>
            <Compass className="h-3 w-3 text-[#00F2B3]" />
            Getting Started
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => startGettingStartedTour()} className={ITEM}>
            <Compass className={ICON} style={{ color: "#00F2B3" }} /> Getting Started
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Analysis & Findings */}
        {hasFiles && (
          <>
            <DropdownMenuSeparator className={SEP} />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={LBL}>
                <BarChart3 className="h-3 w-3 text-brand-accent" />
                Analysis & Findings
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startDashboardTour()} className={ITEM}>
                <BarChart3 className={ICON} style={{ color: "#2006F7" }} /> Dashboard Guide
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startRiskScoreTour(cb)} className={ITEM}>
                <Gauge className={ICON} style={{ color: "#F29400" }} /> Risk Score Explained
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startComplianceTour(cb)} className={ITEM}>
                <Shield className={ICON} style={{ color: "#00F2B3" }} /> Compliance Mapping
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startConfigDiffTour(cb)} className={ITEM}>
                <GitCompare className={ICON} style={{ color: "#00EDFF" }} /> Config Comparison
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startRemediationTour(cb)} className={ITEM}>
                <Wrench className={ICON} style={{ color: "#F29400" }} /> Remediation Workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startBaselineTour(cb)} className={ITEM}>
                <GitCompare className={ICON} style={{ color: "#5A00FF" }} /> Baselines & Simulator
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startMapsTour(cb)} className={ITEM}>
                <Map className={ICON} style={{ color: "#009CFB" }} /> Geographic & Network Maps
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startWidgetTour()} className={ITEM}>
                <LayoutGrid className={ICON} style={{ color: "#2006F7" }} /> Widget Customiser
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Setup & Integration */}
        {!isGuest && (
          <>
            <DropdownMenuSeparator className={SEP} />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={LBL}>
                <Link2 className="h-3 w-3 text-[#00EDFF]" />
                Setup & Integration
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startCentralTour(cb)} className={ITEM}>
                <Link2 className={ICON} style={{ color: "#00EDFF" }} /> Connect to Sophos Central
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startConnectorTour(cb)} className={ITEM}>
                <Download className={ICON} style={{ color: "#00F2B3" }} /> Set Up Connector Agent
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Exports & Sharing */}
        {(hasReports || !isGuest) && (
          <>
            <DropdownMenuSeparator className={SEP} />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={LBL}>
                <Share2 className="h-3 w-3 text-[#5A00FF]" />
                Exports & Sharing
              </DropdownMenuLabel>
              {hasReports && (
                <DropdownMenuItem onClick={() => startExportTour()} className={ITEM}>
                  <Download className={ICON} style={{ color: "#5A00FF" }} /> How to Export
                </DropdownMenuItem>
              )}
              {!isGuest && (
                <DropdownMenuItem onClick={() => startPortalTour(cb)} className={ITEM}>
                  <Share2 className={ICON} style={{ color: "#2006F7" }} /> Client Portal
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}

        {/* Team & Settings */}
        {!isGuest && (
          <>
            <DropdownMenuSeparator className={SEP} />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={LBL}>
                <Building2 className="h-3 w-3 text-[#F29400]" />
                Team & Settings
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startManagementTour(cb)} className={ITEM}>
                <Building2 className={ICON} style={{ color: "#F29400" }} /> Management Panel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTeamTour(cb)} className={ITEM}>
                <Users className={ICON} style={{ color: "#009CFB" }} /> Team & Security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startAlertsTour(cb)} className={ITEM}>
                <Bell className={ICON} style={{ color: "#EA0022" }} /> Alerts & Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startSchedulingTour(cb)} className={ITEM}>
                <Clock className={ICON} style={{ color: "#00EDFF" }} /> Scheduling
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTenantDashboardTour(cb)} className={ITEM}>
                <BarChart3 className={ICON} style={{ color: "#2006F7" }} /> Tenant Dashboard
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Tips */}
        <DropdownMenuSeparator className={SEP} />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={LBL}>
            <Zap className="h-3 w-3 text-[#F8C300]" />
            Tips
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => startPowerUserTour()} className={ITEM}>
            <Zap className={ICON} style={{ color: "#F8C300" }} /> Power User Tips
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
