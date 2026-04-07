import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { CustomerDirectoryEntry } from "@/lib/customer-directory";
import {
  customerOpenAlerts,
  customerCrmStatus,
  customerInitials,
  avatarHueFromName,
} from "@/lib/customer-ui-helpers";
import { Monitor, FileText, Bell, Settings } from "lucide-react";

export function CustomerDetailSheet({
  customer,
  open,
  onOpenChange,
  onConfigurePortal,
  onManageAccess,
}: {
  customer: CustomerDirectoryEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfigurePortal: (c: CustomerDirectoryEntry) => void;
  onManageAccess: (c: CustomerDirectoryEntry) => void;
}) {
  const hue = customer ? avatarHueFromName(customer.name) : 0;
  const crm = customer ? customerCrmStatus(customer) : "Active";
  const alerts = customer ? customerOpenAlerts(customer) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-border/60 bg-background">
        {!customer ? (
          <p className="text-sm text-muted-foreground p-4">No customer selected.</p>
        ) : (
          <>
            <SheetHeader className="space-y-3 text-left border-b border-border/50 pb-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
                >
                  {customerInitials(customer.name)}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight">{customer.name}</SheetTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {customer.sector} · {customer.countryFlag} {customer.country}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    CRM: <span className="font-medium text-foreground">{crm}</span> · Risk score{" "}
                    <span className="font-mono">{100 - customer.score}</span> (inv. of security
                    score)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link
                    to={`/command?${new URLSearchParams({ customer: customer.name }).toString()}`}
                  >
                    <Monitor className="h-3.5 w-3.5 mr-1" />
                    Fleet
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/?${new URLSearchParams({ customer: customer.name }).toString()}`}>
                    New assessment
                  </Link>
                </Button>
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1">
                <TabsTrigger value="overview" className="text-[10px] sm:text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="fleet" className="text-[10px] sm:text-xs">
                  Fleet
                </TabsTrigger>
                <TabsTrigger value="reports" className="text-[10px] sm:text-xs">
                  Reports
                </TabsTrigger>
                <TabsTrigger value="alerts" className="text-[10px] sm:text-xs">
                  Alerts
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-[10px] sm:text-xs">
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Security score</p>
                    <p className="text-2xl font-bold tabular-nums">{customer.score}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Devices</p>
                    <p className="text-2xl font-bold tabular-nums">{customer.firewallCount}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Last assessed <strong className="text-foreground">{customer.lastAssessed}</strong>
                  . Open alerts (synthetic): <strong className="text-foreground">{alerts}</strong>.
                </p>
              </TabsContent>

              <TabsContent value="fleet" className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  {customer.firewallCount} firewall{customer.firewallCount === 1 ? "" : "s"} in
                  directory.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    to={`/command?${new URLSearchParams({ customer: customer.name }).toString()}`}
                  >
                    Open in Fleet Command
                  </Link>
                </Button>
              </TabsContent>

              <TabsContent value="reports" className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Saved reports live in the report library filtered by customer name.
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/reports">Open reports</Link>
                </Button>
              </TabsContent>

              <TabsContent value="alerts" className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bell className="h-4 w-4" />
                  {alerts} open (layout placeholder). Connect Sophos Central for live alerts.
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/central/alerts">Central alerts</Link>
                </Button>
              </TabsContent>

              <TabsContent value="settings" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Portal slug:{" "}
                  <code className="rounded bg-muted px-1">{customer.portalSlug || "—"}</code>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onOpenChange(false);
                      onConfigurePortal(customer);
                    }}
                  >
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    Configure portal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onManageAccess(customer);
                    }}
                  >
                    Portal access
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
