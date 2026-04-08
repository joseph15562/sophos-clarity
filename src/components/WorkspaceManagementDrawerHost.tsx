import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth, useAuthProvider } from "@/hooks/use-auth";
import {
  readManagePanelParams,
  settingsSectionExpandAllowed,
  stripManagePanelParams,
} from "@/lib/workspace-deeplink";
import { trackProductEvent } from "@/lib/product-telemetry";
import type { AnalysisResult } from "@/lib/analyse-config";

const EMPTY_ANALYSIS = {} as Record<string, AnalysisResult>;

/**
 * Opens Workspace Controls from `?panel=&section=` on hub routes (everything except `/` Assess).
 * Assess (`/`) continues to handle the same params in {@link Index}; this avoids redirecting
 * Fleet / Customers / Central / … to home when clicking the org button in the header.
 */
function WorkspaceManagementDrawerHostInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { org, isGuest, isViewerOnly, canManageTeam } = useAuth();
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<
    "dashboard" | "reports" | "history" | "settings" | undefined
  >(undefined);
  const [initialSettingsSection, setInitialSettingsSection] = useState<string | undefined>(
    undefined,
  );

  const isAssessRoot = location.pathname === "/";

  useEffect(() => {
    if (isAssessRoot) {
      setOpen(false);
      setInitialTab(undefined);
      setInitialSettingsSection(undefined);
    }
  }, [isAssessRoot]);

  useEffect(() => {
    if (isAssessRoot || isGuest || !org) return;
    const parsed = readManagePanelParams(searchParams);
    if (!parsed) return;

    const sec = parsed.section;
    const blocked =
      parsed.panel === "settings" &&
      !!sec &&
      !settingsSectionExpandAllowed(sec, {
        canManageTeam,
        isViewerOnly,
        localMode: false,
      });
    if (blocked) {
      trackProductEvent("manage_deeplink_blocked_viewer", {
        section: sec,
        panel: parsed.panel,
      });
      toast.warning("Ask an org admin to open this workspace settings section.");
      setInitialTab("settings");
      setInitialSettingsSection(undefined);
    } else {
      setInitialTab(parsed.panel);
      setInitialSettingsSection(parsed.section);
    }
    setOpen(true);

    const next = stripManagePanelParams(searchParams);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, isAssessRoot, isGuest, org, isViewerOnly, canManageTeam]);

  const onClose = useCallback(() => {
    setOpen(false);
    setInitialSettingsSection(undefined);
    setInitialTab(undefined);
  }, []);

  const onLoadReports = useCallback(() => {
    toast.info("Open Assess to load a saved report into the workspace.");
    navigate("/");
  }, [navigate]);

  if (isGuest || !org) return null;

  return (
    <ErrorBoundary
      fallbackTitle="Management panel failed to load"
      resetKeys={[open]}
      onError={() => setOpen(false)}
    >
      <ManagementDrawer
        open={open}
        onClose={onClose}
        isGuest={false}
        orgName={org.name}
        analysisResults={EMPTY_ANALYSIS}
        customerName={org.name ?? ""}
        environment=""
        onLoadReports={onLoadReports}
        hasFiles={false}
        initialTab={initialTab}
        initialSettingsSection={initialSettingsSection}
        localMode={false}
        onLocalModeChange={() => {}}
        linkedCloudAssessmentId={null}
      />
    </ErrorBoundary>
  );
}

/** Mounted once under the router; carries its own {@link AuthProvider} because it sits outside per-page providers. */
export function WorkspaceManagementDrawerHost() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <WorkspaceManagementDrawerHostInner />
    </AuthProvider>
  );
}
