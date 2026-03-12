import { Moon, Sun, LogOut, Building2, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface AppHeaderProps {
  hasFiles: boolean;
  fileCount: number;
  customerName: string;
  environment: string;
  selectedFrameworks: string[];
  reportCount: number;
}

export function AppHeader({ hasFiles, fileCount, customerName, environment, selectedFrameworks, reportCount }: AppHeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { user, org, isGuest, signOut } = useAuth();

  const showContext = hasFiles || customerName || selectedFrameworks.length > 0;

  return (
    <>
      <header className="border-b border-[#10037C]/20 bg-[#001A47] sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
          <div className="flex-1">
            <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">
              Sophos FireComply
            </h1>
            <p className="text-[11px] text-[#6A889B]">
              Firewall Configuration Assessment & Compliance Reporting
            </p>
          </div>

          {/* Auth status */}
          {!isGuest && (
            <div className="flex items-center gap-2 shrink-0">
              {org && (
                <span className="flex items-center gap-1.5 text-[10px] text-[#6A889B]">
                  <Building2 className="h-3 w-3" />
                  <span className="font-medium text-white/80 max-w-[120px] truncate">{org.name}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-[#6A889B]">
                <User className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{user?.email?.split("@")[0]}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="shrink-0 text-[#6A889B] hover:text-white hover:bg-[#10037C]/40 h-7 w-7"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isGuest && (
            <span className="text-[9px] text-[#6A889B] px-2 py-0.5 rounded bg-white/5 shrink-0">Guest</span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="shrink-0 text-[#6A889B] hover:text-white hover:bg-[#10037C]/40"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {showContext && (
        <div className="border-b border-border bg-muted/50 no-print">
          <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground overflow-x-auto">
            {customerName && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold text-foreground">{customerName}</span>
                {environment && <span className="opacity-60">· {environment}</span>}
              </span>
            )}
            {hasFiles && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00995a] dark:bg-[#00F2B3]" />
                {fileCount} firewall{fileCount !== 1 ? "s" : ""} loaded
              </span>
            )}
            {selectedFrameworks.length > 0 && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="opacity-60">Frameworks:</span>
                {selectedFrameworks.map((fw) => (
                  <span key={fw} className="px-1.5 py-0.5 rounded bg-[#2006F7]/10 dark:bg-[#2006F7]/20 text-[#10037C] dark:text-[#009CFB] font-medium">
                    {fw}
                  </span>
                ))}
              </span>
            )}
            {reportCount > 0 && (
              <span className="flex items-center gap-1 shrink-0 ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2006F7]" />
                {reportCount} report{reportCount !== 1 ? "s" : ""} generated
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
