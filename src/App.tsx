import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ProductRouteTelemetry } from "@/components/ProductRouteTelemetry";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import NotFound from "./pages/NotFound";
import { WorkspaceCommandPalette } from "@/components/WorkspaceCommandPalette";

const Index = lazy(() => import("./pages/Index"));
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

function FocusReset() {
  const location = useLocation();
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      main.focus({ preventScroll: true });
    } else {
      document.body.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);
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
            <FocusReset />
            <ProductRouteTelemetry />
            <WorkspaceCommandPalette />
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/shared/:token" element={<SharedReport />} />
                <Route path="/portal/:tenantId" element={<ClientPortal />} />
                <Route path="/health-check" element={<HealthCheck />} />
                <Route path="/health-check/shared/:token" element={<SharedHealthCheck />} />
                <Route path="/upload/:token" element={<ConfigUpload />} />
                <Route path="/team-invite/:token" element={<TeamInviteAccept />} />
                <Route path="/preview" element={<ThemePreview />} />
                <Route path="/command" element={<FleetCommand />} />
                <Route path="/customers" element={<CustomerManagement />} />
                <Route path="/drift" element={<DriftMonitor />} />
                <Route path="/reports" element={<ReportCentre />} />
                <Route path="/reports/saved/:id" element={<SavedReportViewer />} />
                <Route path="/insights" element={<PortfolioInsights />} />
                <Route path="/playbooks" element={<PlaybookLibrary />} />
                <Route path="/api" element={<ApiHub />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/trust" element={<TrustPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
