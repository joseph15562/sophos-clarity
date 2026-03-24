import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const HealthCheck = lazy(() => import("./pages/HealthCheck2"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const SharedHealthCheck = lazy(() => import("./pages/SharedHealthCheck"));
const ConfigUpload = lazy(() => import("./pages/ConfigUpload"));
const TeamInviteAccept = lazy(() => import("./pages/TeamInviteAccept"));
const ThemePreview = lazy(() => import("./pages/ThemePreview"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="sophos-firecomply-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary fallbackTitle="Sophos FireComply failed to load">
          <a
            href="#main-content"
            className="sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:whitespace-normal focus:[clip:auto]"
          >
            Skip to main content
          </a>
          <BrowserRouter>
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
