import { HelpCircle, Compass, BarChart3, Shield, GitCompare, Wrench, Map, LayoutGrid, Link2, Download, Share2, Users, Bell, Clock, Building2, Zap, Gauge } from "lucide-react";
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-[10px] text-muted-foreground hover:text-foreground hover:border-[#2006F7]/30 transition-colors shadow-sm"
          title="Guided tours"
          aria-label="Guided tours"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Tours
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56 max-h-[70vh] overflow-y-auto">
        {/* Getting Started */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Getting Started</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => startGettingStartedTour()}>
            <Compass className="h-3.5 w-3.5 mr-2 shrink-0" /> Getting Started
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Analysis & Findings */}
        {hasFiles && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Analysis & Findings</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startDashboardTour()}>
                <BarChart3 className="h-3.5 w-3.5 mr-2 shrink-0" /> Dashboard Guide
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startRiskScoreTour()}>
                <Gauge className="h-3.5 w-3.5 mr-2 shrink-0" /> Risk Score Explained
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startComplianceTour()}>
                <Shield className="h-3.5 w-3.5 mr-2 shrink-0" /> Compliance Mapping
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startConfigDiffTour()}>
                <GitCompare className="h-3.5 w-3.5 mr-2 shrink-0" /> Config Comparison
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startRemediationTour()}>
                <Wrench className="h-3.5 w-3.5 mr-2 shrink-0" /> Remediation Workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startBaselineTour()}>
                <GitCompare className="h-3.5 w-3.5 mr-2 shrink-0" /> Baselines & What-If
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startMapsTour()}>
                <Map className="h-3.5 w-3.5 mr-2 shrink-0" /> Geographic & Network Maps
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startWidgetTour()}>
                <LayoutGrid className="h-3.5 w-3.5 mr-2 shrink-0" /> Widget Customiser
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Setup & Integration */}
        {!isGuest && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Setup & Integration</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startCentralTour(cb)}>
                <Link2 className="h-3.5 w-3.5 mr-2 shrink-0" /> Connect to Sophos Central
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startConnectorTour(cb)}>
                <Download className="h-3.5 w-3.5 mr-2 shrink-0" /> Set Up Connector Agent
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Exports & Sharing */}
        {(hasReports || !isGuest) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Exports & Sharing</DropdownMenuLabel>
              {hasReports && (
                <DropdownMenuItem onClick={() => startExportTour()}>
                  <Download className="h-3.5 w-3.5 mr-2 shrink-0" /> How to Export
                </DropdownMenuItem>
              )}
              {!isGuest && (
                <DropdownMenuItem onClick={() => startPortalTour(cb)}>
                  <Share2 className="h-3.5 w-3.5 mr-2 shrink-0" /> Client Portal
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}

        {/* Team & Settings */}
        {!isGuest && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Team & Settings</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => startManagementTour(cb)}>
                <Building2 className="h-3.5 w-3.5 mr-2 shrink-0" /> Management Panel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTeamTour(cb)}>
                <Users className="h-3.5 w-3.5 mr-2 shrink-0" /> Team & Security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startAlertsTour(cb)}>
                <Bell className="h-3.5 w-3.5 mr-2 shrink-0" /> Alerts & Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startSchedulingTour(cb)}>
                <Clock className="h-3.5 w-3.5 mr-2 shrink-0" /> Scheduling
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startTenantDashboardTour(cb)}>
                <BarChart3 className="h-3.5 w-3.5 mr-2 shrink-0" /> Tenant Dashboard
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Tips */}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Tips</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => startPowerUserTour()}>
            <Zap className="h-3.5 w-3.5 mr-2 shrink-0" /> Power User Tips
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
