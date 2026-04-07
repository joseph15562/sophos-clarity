import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ProductRouteTelemetry } from "@/components/ProductRouteTelemetry";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import NotFound from "./pages/NotFound";
import { WorkspaceCommandPalette } from "@/components/WorkspaceCommandPalette";
import { NotificationsProvider } from "@/hooks/use-notifications";
import { AssistChromeProvider } from "@/contexts/assist-chrome-context";
import { GlobalAssistChrome } from "@/components/GlobalAssistChrome";
import { OrgCentralPrefetch } from "@/components/OrgCentralPrefetch";

const Index = lazy(() => import("./pages/Index"));
const MissionControlPage = lazy(() => import("./pages/MissionControlPage"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const HealthCheck = lazy(() => import("./pages/HealthCheck2"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const SharedHealthCheck = lazy(() => import("./pages/SharedHealthCheck"));
const ConfigUpload = lazy(() => import("./pages/ConfigUpload"));
const TeamInviteAccept = lazy(() => import("./pages/TeamInviteAccept"));
const ThemePreview = lazy(() => import("./pages/ThemePreview"));
const FleetCommand = lazy(() => import("./pages/FleetCommand"));
const CustomerManagement = lazy(() => import("./pages/CustomerManagement"));
const DriftMonitor = lazy(() => import("./pages/DriftMonitor"));
const ReportCentre = lazy(() => import("./pages/ReportCentre"));
const SavedReportViewer = lazy(() => import("./pages/SavedReportViewer"));
const PortfolioInsights = lazy(() => import("./pages/PortfolioInsights"));
const PlaybookLibrary = lazy(() => import("./pages/PlaybookLibrary"));
const ApiHub = lazy(() => import("./pages/ApiHub"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const TrustPage = lazy(() => import("./pages/TrustPage"));
const ChangelogPage = lazy(() => import("./pages/ChangelogPage"));
const HelpLayout = lazy(() => import("./pages/help/HelpLayout"));
const HelpHomePage = lazy(() => import("./pages/help/HelpHomePage"));
const HelpSiteMapPage = lazy(() => import("./pages/help/HelpSiteMapPage"));
const HelpGuideTopicPage = lazy(() => import("./pages/help/HelpGuideTopicPage"));
const HelpAssessTabPage = lazy(() => import("./pages/help/HelpAssessTabPage"));
const HelpAssessTabSectionPage = lazy(() => import("./pages/help/HelpAssessTabSectionPage"));
const HelpAssessHubPage = lazy(() => import("./pages/help/HelpAssessHubPage"));
const HelpWorkspacePageDoc = lazy(() => import("./pages/help/HelpWorkspacePageDoc"));
const HelpWorkspaceGroupPage = lazy(() => import("./pages/help/HelpWorkspaceGroupPage"));
const CentralHub = lazy(() => import("./pages/central/CentralHub"));
const CentralOverview = lazy(() => import("./pages/central/CentralOverview"));
const CentralTenantsPage = lazy(() => import("./pages/central/CentralTenantsPage"));
const CentralAlertsPage = lazy(() => import("./pages/central/CentralAlertsPage"));
const CentralLicensingPage = lazy(() => import("./pages/central/CentralLicensingPage"));
const CentralSyncPage = lazy(() => import("./pages/central/CentralSyncPage"));
const CentralFirewallPage = lazy(() => import("./pages/central/CentralFirewallPage"));
const CentralFirewallsPage = lazy(() => import("./pages/central/CentralFirewallsPage"));
const CentralMdrFeedPage = lazy(() => import("./pages/central/CentralMdrFeedPage"));
const CentralGroupsPage = lazy(() => import("./pages/central/CentralGroupsPage"));

function FocusReset() {
  const location = useLocation();
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      main.focus({ preventScroll: true });
    } else {
      document.body.focus({ preventScroll: true });
    }
    const anchorId = location.hash?.replace(/^#/, "").trim();
    if (anchorId) {
      requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "auto", block: "start" });
      });
      return;
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="sophos-firecomply-theme"
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Sonner />
        <ErrorBoundary fallbackTitle="Sophos FireComply failed to load">
          <a
            href="#main-content"
            className="sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:whitespace-normal focus:[clip:auto]"
          >
            Skip to main content
          </a>
          <BrowserRouter>
            <AssistChromeProvider>
              <NotificationsProvider>
                <OrgCentralPrefetch />
                <FocusReset />
                <ProductRouteTelemetry />
                <WorkspaceCommandPalette />
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<MissionControlPage />} />
                    <Route path="/shared/:token" element={<SharedReport />} />
                    <Route path="/portal/:tenantId" element={<ClientPortal />} />
                    <Route path="/health-check" element={<HealthCheck />} />
                    <Route path="/health-check/shared/:token" element={<SharedHealthCheck />} />
                    <Route path="/upload/:token" element={<ConfigUpload />} />
                    <Route path="/team-invite/:token" element={<TeamInviteAccept />} />
                    <Route path="/preview" element={<ThemePreview />} />
                    <Route path="/command" element={<FleetCommand />} />
                    <Route path="/customers" element={<CustomerManagement />} />
                    <Route path="/central" element={<CentralHub />}>
                      <Route index element={<Navigate to="overview" replace />} />
                      <Route path="overview" element={<CentralOverview />} />
                      <Route path="tenants" element={<CentralTenantsPage />} />
                      <Route path="firewalls" element={<CentralFirewallsPage />} />
                      <Route path="alerts" element={<CentralAlertsPage />} />
                      <Route path="mdr" element={<CentralMdrFeedPage />} />
                      <Route path="groups" element={<CentralGroupsPage />} />
                      <Route path="licensing" element={<CentralLicensingPage />} />
                      <Route path="sync" element={<CentralSyncPage />} />
                      <Route
                        path="firewall/:tenantId/:firewallId"
                        element={<CentralFirewallPage />}
                      />
                    </Route>
                    <Route path="/drift" element={<DriftMonitor />} />
                    <Route path="/reports" element={<ReportCentre />} />
                    <Route path="/reports/saved/:id" element={<SavedReportViewer />} />
                    <Route path="/insights" element={<PortfolioInsights />} />
                    <Route path="/playbooks" element={<PlaybookLibrary />} />
                    <Route path="/api" element={<ApiHub />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/trust" element={<TrustPage />} />
                    <Route path="/changelog" element={<ChangelogPage />} />
                    <Route path="/help" element={<HelpLayout />}>
                      <Route index element={<HelpHomePage />} />
                      <Route path="site-map" element={<HelpSiteMapPage />} />
                      <Route path="guides/:slug" element={<HelpGuideTopicPage />} />
                      <Route
                        path="pages/assess/sections/:sectionSlug"
                        element={<HelpAssessTabSectionPage />}
                      />
                      <Route path="pages/assess/:tabSlug" element={<HelpAssessTabPage />} />
                      <Route path="pages/assess" element={<HelpAssessHubPage />} />
                      <Route path="pages/groups/:groupSlug" element={<HelpWorkspaceGroupPage />} />
                      <Route path="pages/:pageSlug" element={<HelpWorkspacePageDoc />} />
                    </Route>
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <GlobalAssistChrome />
              </NotificationsProvider>
            </AssistChromeProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
