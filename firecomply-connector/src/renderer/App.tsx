import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { SetupWizard } from "./pages/SetupWizard";
import { Dashboard } from "./pages/Dashboard";
import { LogViewer } from "./pages/LogViewer";
import { SettingsPage } from "./pages/Settings";

export function App() {
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);

  useEffect(() => {
    window.electronAPI?.loadConfig().then((cfg: unknown) => {
      setHasConfig(!!cfg);
    }).catch(() => setHasConfig(false));
  }, []);

  if (hasConfig === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/setup" element={<SetupWizard onComplete={() => setHasConfig(true)} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logs" element={<LogViewer />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to={hasConfig ? "/dashboard" : "/setup"} replace />} />
      </Routes>
    </HashRouter>
  );
}
