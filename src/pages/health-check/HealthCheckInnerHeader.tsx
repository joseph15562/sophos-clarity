import { Link } from "react-router-dom";
import { ArrowLeft, FileText, HelpCircle, PanelRight, Shield, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { startHealthCheckTour, startHealthCheckResultsTour } from "@/lib/guided-tours";

type SeProfile = { email: string };

export function HealthCheckInnerHeader({
  seProfile,
  teamsLength,
  activeStep,
  onOpenManagement,
  onSignOut,
}: {
  seProfile: SeProfile | null;
  teamsLength: number;
  activeStep: string;
  onOpenManagement: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center shrink-0">
          <Shield className="h-6 w-6 text-brand-accent" />
        </div>
        <div className="mr-auto shrink-0">
          <h1 className="text-base sm:text-lg font-display font-bold tracking-tight">
            Sophos Firewall Health Check
          </h1>
          <p className="text-[10px] text-muted-foreground hidden sm:block">
            Sales Engineer quick check — Sophos best practices (not compliance frameworks)
          </p>
        </div>
        {seProfile && teamsLength > 0 && <TeamSwitcher />}
        {seProfile && (
          <span className="text-xs text-muted-foreground hidden lg:inline shrink-0">
            {seProfile.email}
          </span>
        )}
        {seProfile && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5 shrink-0"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Tours</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => startHealthCheckTour()}>
                  <Upload className="h-3.5 w-3.5 mr-2 shrink-0" /> Getting Started
                </DropdownMenuItem>
                {activeStep === "results" && (
                  <DropdownMenuItem onClick={() => startHealthCheckResultsTour()}>
                    <FileText className="h-3.5 w-3.5 mr-2 shrink-0" /> Results & Export
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5 shrink-0"
              data-tour="hc-management"
              onClick={onOpenManagement}
            >
              <PanelRight className="h-4 w-4" />
              <span className="hidden sm:inline">Management</span>
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" className="rounded-lg shrink-0" onClick={onSignOut}>
          Sign out
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg gap-1.5 shrink-0" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">FireComply app</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
