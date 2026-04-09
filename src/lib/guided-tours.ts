import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { warnOptionalError } from "@/lib/client-error-feedback";

export interface TourCallbacks {
  openDrawer?: () => void;
  setDrawerTab?: (tab: string) => void;
  setAnalysisTab?: (tab: string) => void;
}

function sel(id: string) {
  return `[data-tour="${id}"]`;
}

function filterVisible(steps: DriveStep[]): DriveStep[] {
  return steps.filter((s) => {
    if (!s.element) return true;
    const el = typeof s.element === "string" ? document.querySelector(s.element) : s.element;
    return !!el;
  });
}

function createTour(steps: DriveStep[]): Driver {
  const visible = filterVisible(steps);
  return driver({
    showProgress: true,
    animate: true,
    overlayColor: "rgba(0,0,0,0.6)",
    stagePadding: 8,
    stageRadius: 10,
    popoverOffset: 12,
    progressText: "Step {{current}} of {{total}}",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Done",
    steps: visible,
  });
}

// ---------------------------------------------------------------------------
// 1. Getting Started
// ---------------------------------------------------------------------------
export function startGettingStartedTour() {
  const t = createTour([
    {
      element: sel("step-upload"),
      popover: {
        title: "Upload Firewall Exports",
        description:
          "Drop your Sophos config HTML or XML exports here, or click to browse. You can export these from the Sophos XGS Config Viewer.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("agent-fleet"),
      popover: {
        title: "Connected Firewalls",
        description:
          "Load configs directly from your connected Sophos Central agents — no HTML export needed.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("step-context"),
      popover: {
        title: "Assessment Context",
        description:
          "Set the customer name, environment, and compliance frameworks to tag your findings.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("step-reports"),
      popover: {
        title: "Generate Reports",
        description:
          "Generate technical reports, executive briefs, and compliance packs from your analysis.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("management-panel"),
      popover: {
        title: "Management Panel",
        description:
          "Access saved reports, config history, team settings, Sophos Central integration, and more.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: sel("theme-toggle"),
      popover: {
        title: "Theme",
        description: "Switch between dark and light mode.",
        side: "bottom",
        align: "end",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// 2. Dashboard Guide
// ---------------------------------------------------------------------------
export function startDashboardTour() {
  const t = createTour([
    {
      element: sel("priority-actions"),
      popover: {
        title: "Priority Actions",
        description:
          "Critical and high-severity findings that need immediate attention, with remediation steps.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("stats-bar"),
      popover: {
        title: "At-a-Glance Metrics",
        description: "Firewalls loaded, rules parsed, sections extracted, and issues found.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("analysis-tabs"),
      popover: {
        title: "Analysis Tabs",
        description:
          "Deep-dive into security analysis, compliance mapping, rule optimisation, and remediation playbooks.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("inspection-posture"),
      popover: {
        title: "Inspection Posture",
        description:
          "Web filtering, IPS, and application control coverage across your WAN-facing rules.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("export-buttons"),
      popover: {
        title: "Export",
        description:
          "Export your findings as a CSV risk register or Excel spreadsheet for offline use.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("ai-chat-trigger"),
      popover: {
        title: "AI Chat",
        description:
          "Ask the AI assistant questions about your firewall configuration and get contextual answers.",
        side: "left",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// 3. Risk Score Explained
// ---------------------------------------------------------------------------
export function startRiskScoreTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("overview");
  setTimeout(() => {
    const t = createTour([
      {
        element: sel("score-dial"),
        popover: {
          title: "Risk Score",
          description:
            "Your overall risk score from 0–100, based on weighted analysis across multiple security categories.",
          side: "right",
          align: "center",
        },
      },
      {
        element: sel("score-grade"),
        popover: {
          title: "Grade",
          description:
            "Letter grade for quick assessment. <strong>A</strong> = 90+, <strong>B</strong> = 75+, <strong>C</strong> = 60+, <strong>D</strong> = 40+, <strong>F</strong> = below 40.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: sel("score-categories"),
        popover: {
          title: "Category Breakdown",
          description:
            "Scores split across: Rule Hygiene, Inspection Coverage, Access Control, Network Segmentation, Logging & Visibility, and Authentication.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("score-simulator"),
        popover: {
          title: "Remediation Impact Simulator",
          description:
            "Select recommended remediation actions and instantly see how they would improve your score, grade, and coverage.",
          side: "top",
          align: "center",
        },
      },
    ]);
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 4. Compliance Mapping
// ---------------------------------------------------------------------------
export function startComplianceTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("compliance");
  setTimeout(() => {
    const t = createTour([
      {
        element: sel("framework-selector"),
        popover: {
          title: "Framework Selection",
          description:
            "Choose from NIST 800-53, ISO 27001, CIS, SOC 2, PCI DSS, HIPAA, HITECH, Essential Eight, Cyber Essentials, and more.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: sel("compliance-heatmap"),
        popover: {
          title: "Compliance Heatmap",
          description: "View a heatmap of control coverage, gaps, and readiness per framework.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("sophos-best-practice"),
        popover: {
          title: "Sophos Best Practice",
          description: "Automatic checks against the Sophos recommended configuration baseline.",
          side: "top",
          align: "center",
        },
      },
    ]);
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 5. Config Comparison
// ---------------------------------------------------------------------------
export function startConfigDiffTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("compare");
  setTimeout(() => {
    const t = createTour([
      {
        element: sel("compare-before"),
        popover: {
          title: "Before Config",
          description: "Choose the baseline configuration.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: sel("compare-after"),
        popover: {
          title: "After Config",
          description: "Choose the updated configuration to compare against.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: sel("compare-button"),
        popover: {
          title: "Run Comparison",
          description:
            "Generate a diff showing added, removed, and modified rules and settings. Green = additions, red = removals, amber = modifications.",
          side: "bottom",
          align: "center",
        },
      },
    ]);
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 6. Remediation Workflow
// ---------------------------------------------------------------------------
export function startRemediationTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("remediation");
  setTimeout(() => {
    const t = createTour([
      {
        element: sel("remediation-playbooks"),
        popover: {
          title: "Remediation Playbooks",
          description:
            "Step-by-step guides to fix each finding on a Sophos XGS firewall, with severity and impact.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("remediation-progress"),
        popover: {
          title: "Progress Tracking",
          description: "Track remediation progress across all findings.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("remediation-roadmap"),
        popover: {
          title: "Remediation Roadmap",
          description: "View the prioritised roadmap of fixes.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("findings-bulk"),
        popover: {
          title: "Bulk Actions",
          description: "Select multiple findings for bulk status updates.",
          side: "top",
          align: "center",
        },
      },
    ]);
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 7. Baselines & Remediation Simulator
// ---------------------------------------------------------------------------
export function startBaselineTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("tools");
  setTimeout(() => {
    const steps: DriveStep[] = [
      {
        element: sel("compare-baseline"),
        popover: {
          title: "Compare to Baseline",
          description:
            "Compare your current analysis against a saved baseline to detect config drift.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("baseline-manager"),
        popover: {
          title: "Baseline Manager",
          description:
            "Save a snapshot of your current config as a baseline for future comparison.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("score-simulator"),
        popover: {
          title: "Remediation Impact Simulator",
          description:
            "Select recommended actions and instantly see projected risk reduction, grade improvement, and coverage gains.",
          side: "top",
          align: "center",
        },
      },
    ];
    const visible = filterVisible(steps);
    if (visible.length < steps.length) {
      visible.push({
        element: sel("widget-customiser"),
        popover: {
          title: "Enable More Widgets",
          description:
            "Some tools are hidden. Click the <strong>Widgets</strong> button to enable <strong>Baseline Manager</strong> and other tools on the Tools tab.",
          side: "bottom",
          align: "center",
        },
      });
    }
    const t = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8,
      stageRadius: 10,
      popoverOffset: 12,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done",
      steps: visible,
    });
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 8. Geographic & Network Maps
// ---------------------------------------------------------------------------
export function startMapsTour(cb?: TourCallbacks) {
  if (cb?.setAnalysisTab) cb.setAnalysisTab("tools");
  setTimeout(() => {
    const steps: DriveStep[] = [
      {
        element: sel("attack-surface"),
        popover: {
          title: "Attack Surface Map",
          description:
            "Visualise your network's attack surface based on firewall rules and exposed services.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("fleet-map"),
        popover: {
          title: "Geographic Fleet Map",
          description: "View your firewalls' external IP addresses and their geographic locations.",
          side: "top",
          align: "center",
        },
      },
      {
        element: sel("zone-map"),
        popover: {
          title: "Network Zone Map",
          description: "Zone-to-zone traffic flow and security level visualisation.",
          side: "top",
          align: "center",
        },
      },
    ];
    const visible = filterVisible(steps);
    if (visible.length < steps.length) {
      visible.push({
        element: sel("widget-customiser"),
        popover: {
          title: "Enable More Widgets",
          description:
            "Some maps are hidden. Click the <strong>Widgets</strong> button to enable <strong>Geographic Fleet Map</strong> (Tools tab) and <strong>Network Zone Map</strong> (Security tab).",
          side: "bottom",
          align: "center",
        },
      });
    }
    const t = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8,
      stageRadius: 10,
      popoverOffset: 12,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done",
      steps: visible,
    });
    t.drive();
  }, 300);
}

// ---------------------------------------------------------------------------
// 9. Widget Customiser
// ---------------------------------------------------------------------------
export function startWidgetTour() {
  const t = createTour([
    {
      element: sel("widget-customiser"),
      popover: {
        title: "Widget Customiser",
        description:
          "Toggle optional widgets on each analysis tab. Enable or disable Evidence Collection, Coverage Matrix, and more. Insurance Readiness lives on its own tab.",
        side: "bottom",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// 10. Connect to Sophos Central
// ---------------------------------------------------------------------------
export function startCentralTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("settings");
    setTimeout(() => {
      const el = document.querySelector(sel("central-section"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const t = createTour([
          {
            element: sel("central-section"),
            popover: {
              title: "Sophos Central API",
              description:
                "Connect your Sophos Central account to pull live firewall data, licence info, and alerts.",
              side: "left",
              align: "start",
            },
          },
          {
            popover: {
              title: "How to Get API Credentials",
              description:
                "<strong>Step 1:</strong> Sign in to <strong>central.sophos.com</strong><br/><br/><strong>Step 2:</strong> Go to <strong>Settings & Policies → API Credentials Management</strong><br/><br/><strong>Step 3:</strong> Click <strong>Add Credential</strong>. Name it 'FireComply' and select <strong>Service Principal Read-Only</strong><br/><br/><strong>Step 4:</strong> Copy the <strong>Client ID</strong> and <strong>Client Secret</strong><br/><br/><strong>Step 5:</strong> Paste them into the form and click <strong>Connect</strong>",
            },
          },
          {
            element: sel("central-client-id"),
            popover: {
              title: "Client ID",
              description: "Paste your Sophos Central Client ID here.",
              side: "top",
              align: "center",
            },
          },
          {
            element: sel("central-client-secret"),
            popover: {
              title: "Client Secret",
              description: "Paste your Client Secret here. It will be encrypted at rest.",
              side: "top",
              align: "center",
            },
          },
          {
            element: sel("central-connect-btn"),
            popover: {
              title: "Connect",
              description:
                "Click to connect to Sophos Central. Your credentials are encrypted and stored securely.",
              side: "top",
              align: "center",
            },
          },
        ]);
        t.drive();
      }, 300);
    }, 200);
  }, 200);
}

// ---------------------------------------------------------------------------
// 11. Set Up Connector Agent
// ---------------------------------------------------------------------------
export function startConnectorTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("settings");
    setTimeout(() => {
      const el = document.querySelector(sel("connector-section"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const t = createTour([
          {
            element: sel("connector-section"),
            popover: {
              title: "FireComply Connector Agents",
              description:
                "Connector agents run on your network and automatically pull firewall configs on a schedule.",
              side: "left",
              align: "start",
            },
          },
          {
            element: sel("connector-register"),
            popover: {
              title: "Register Agent",
              description:
                "Register a new agent to generate an API key. Enter the firewall name, IP address, and schedule.",
              side: "bottom",
              align: "center",
            },
          },
          {
            popover: {
              title: "Setup Flow",
              description:
                "<strong>Step 1:</strong> Click <strong>Register Agent</strong> and fill in your firewall details — an API key will be generated<br/><br/><strong>Step 2:</strong> Download the connector app for your OS<br/><br/><strong>Step 3:</strong> Open the connector, paste the API key, and add your firewall's IP and API credentials<br/><br/><strong>Step 4:</strong> The agent will pull configs on schedule and submit assessments automatically",
            },
          },
          {
            element: sel("connector-download"),
            popover: {
              title: "Download Connector",
              description: "Download the FireComply Connector for Windows, macOS, or Linux.",
              side: "top",
              align: "center",
            },
          },
        ]);
        t.drive();
      }, 300);
    }, 200);
  }, 200);
}

// ---------------------------------------------------------------------------
// 12. How to Export
// ---------------------------------------------------------------------------
export function startExportTour() {
  const t = createTour([
    {
      element: sel("export-zip"),
      popover: {
        title: "Download All",
        description: "Download all reports as a ZIP containing PDF, Word, and HTML versions.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("export-pdf"),
      popover: {
        title: "Download PDF",
        description: "Export the current report as a branded PDF document.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("export-word"),
      popover: {
        title: "Download Word",
        description: "Export as a Word document for editing and customisation.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("share-report"),
      popover: {
        title: "Share Report",
        description: "Generate a shareable link with optional expiry and download permissions.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("export-risk-register"),
      popover: {
        title: "Export Risk Register",
        description: "Download findings as a CSV risk register for GRC tools.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("export-excel"),
      popover: {
        title: "Export Excel",
        description: "Download the full analysis as an Excel spreadsheet.",
        side: "bottom",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// 13. Client Portal
// ---------------------------------------------------------------------------
export function startPortalTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("settings");
    setTimeout(() => {
      const el = document.querySelector(sel("drawer-portal"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const t = createTour([
          {
            element: sel("drawer-portal"),
            popover: {
              title: "Client Portal",
              description:
                "Set up a branded portal to share assessment results with your customers.",
              side: "left",
              align: "start",
            },
          },
          {
            popover: {
              title: "Portal Features",
              description:
                "Choose what to show: risk scores, findings, reports, and your branding. Preview what your customer will see, then send them the portal link for read-only access.",
            },
          },
        ]);
        t.drive();
      }, 300);
    }, 200);
  }, 200);
}

// ---------------------------------------------------------------------------
// 14. Management Panel Overview
// ---------------------------------------------------------------------------
export function startManagementTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("dashboard");
    setTimeout(() => {
      const t = createTour([
        {
          element: sel("drawer-tab-dashboard"),
          popover: {
            title: "Dashboard",
            description: "Tenant overview, score trends, and licence expiry tracking.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: sel("drawer-tab-reports"),
          popover: {
            title: "Reports",
            description: "Browse and load previously saved reports.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: sel("drawer-tab-history"),
          popover: {
            title: "History",
            description: "Assessment history and config version changes over time.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: sel("drawer-tab-settings"),
          popover: {
            title: "Settings",
            description:
              "Sophos Central, connector agents, team members, alerts, webhooks, compliance frameworks, and more.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: sel("drawer-audit"),
          popover: {
            title: "Activity Log",
            description: "Full audit trail of all actions taken in FireComply.",
            side: "top",
            align: "center",
          },
        },
      ]);
      t.drive();
    }, 300);
  }, 200);
}

// ---------------------------------------------------------------------------
// 15. Team & Security
// ---------------------------------------------------------------------------
export function startTeamTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("settings");
    setTimeout(() => {
      const el = document.querySelector(sel("drawer-team"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        const t = createTour([
          {
            element: sel("drawer-team"),
            popover: {
              title: "Team Management",
              description: "Invite team members by email and assign roles.",
              side: "left",
              align: "start",
            },
          },
          {
            popover: {
              title: "Roles",
              description:
                "<strong>Admin:</strong> Full access to all features<br/><br/><strong>Engineer:</strong> Run assessments and manage agents<br/><br/><strong>Member:</strong> View analysis and generate reports<br/><br/><strong>Viewer:</strong> Read-only access",
            },
          },
          {
            element: sel("drawer-mfa"),
            popover: {
              title: "Multi-Factor Authentication",
              description: "Enable MFA for an extra layer of security on your account.",
              side: "top",
              align: "center",
            },
          },
          {
            element: sel("drawer-passkeys"),
            popover: {
              title: "Passkeys",
              description: "Set up passkeys for fast, passwordless sign-in.",
              side: "top",
              align: "center",
            },
          },
        ]);
        t.drive();
      }, 300);
    }, 200);
  }, 200);
}

// ---------------------------------------------------------------------------
// 16. Alerts & Notifications
// ---------------------------------------------------------------------------
export function startAlertsTour(cb?: TourCallbacks) {
  const t = createTour([
    {
      element: sel("notification-bell"),
      popover: {
        title: "Notifications",
        description: "In-app notifications appear here. Click to view and manage.",
        side: "bottom",
        align: "center",
      },
    },
  ]);

  const origDone = t.getConfig().onDestroyed;
  t.setConfig({
    ...t.getConfig(),
    onDestroyed: (...args: unknown[]) => {
      if (typeof origDone === "function") (origDone as (...a: unknown[]) => void)(...args);
      if (cb?.openDrawer) cb.openDrawer();
      setTimeout(() => {
        if (cb?.setDrawerTab) cb.setDrawerTab("settings");
        setTimeout(() => {
          const el = document.querySelector(sel("drawer-alerts"));
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const t2 = createTour([
              {
                element: sel("drawer-alerts"),
                popover: {
                  title: "Alert Settings",
                  description:
                    "Configure email alerts for critical findings, agent offline, config drift, and licence expiry.",
                  side: "left",
                  align: "start",
                },
              },
              {
                element: sel("drawer-webhooks"),
                popover: {
                  title: "Webhook Settings",
                  description:
                    "Set up a webhook URL to push events to your PSA, RMM, or ticketing system.",
                  side: "top",
                  align: "center",
                },
              },
            ]);
            t2.drive();
          }, 300);
        }, 200);
      }, 200);
    },
  });

  t.drive();
}

// ---------------------------------------------------------------------------
// 17. Scheduling
// ---------------------------------------------------------------------------
export function startSchedulingTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("dashboard");
    setTimeout(() => {
      const t = createTour([
        {
          element: sel("drawer-scheduled-reports"),
          popover: {
            title: "Scheduled Reports",
            description:
              "Automatically generate and send reports on a weekly, monthly, or quarterly basis to specified recipients.",
            side: "top",
            align: "center",
          },
        },
      ]);
      t.drive();
    }, 300);
  }, 200);
}

// ---------------------------------------------------------------------------
// 18. Tenant Dashboard
// ---------------------------------------------------------------------------
export function startTenantDashboardTour(cb?: TourCallbacks) {
  if (cb?.openDrawer) cb.openDrawer();
  setTimeout(() => {
    if (cb?.setDrawerTab) cb.setDrawerTab("dashboard");
    setTimeout(() => {
      const t = createTour([
        {
          element: sel("tenant-dashboard"),
          popover: {
            title: "Tenant Dashboard",
            description: "View all customers with their latest scores and assessment dates.",
            side: "right",
            align: "start",
          },
        },
        {
          element: sel("score-trend-chart"),
          popover: {
            title: "Score Trends",
            description: "Track score changes over time across your customer base.",
            side: "top",
            align: "center",
          },
        },
        {
          element: sel("licence-expiry"),
          popover: {
            title: "Licence Expiry",
            description: "Monitor Sophos licence expiry dates and get early warnings.",
            side: "top",
            align: "center",
          },
        },
      ]);
      t.drive();
    }, 300);
  }, 200);
}

// ---------------------------------------------------------------------------
// 19. Power User Tips
// ---------------------------------------------------------------------------
export function startPowerUserTour() {
  const t = createTour([
    {
      element: sel("shortcuts-button"),
      popover: {
        title: "Keyboard Shortcuts",
        description: "Press <strong>?</strong> to see all keyboard shortcuts.",
        side: "top",
        align: "end",
      },
    },
    {
      popover: {
        title: "Key Shortcuts",
        description:
          "<strong>Ctrl+G</strong> — Generate all reports<br/><strong>Ctrl+S</strong> — Save reports<br/><strong>1-9</strong> — Switch between reports<br/><strong>Ctrl+D</strong> — Toggle management drawer<br/><strong>Ctrl+/</strong> — Open AI chat",
      },
    },
    {
      element: sel("score-simulator"),
      popover: {
        title: "Remediation Impact Simulator",
        description:
          "Select recommended remediation actions and see projected score, grade, and coverage improvements.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("attack-surface"),
      popover: {
        title: "Attack Surface Map",
        description: "Visualise your network's attack surface based on firewall rules.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("rule-optimiser"),
      popover: {
        title: "Rule Optimiser",
        description: "Find redundant, shadowed, and overlapping firewall rules.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("remediation-playbooks"),
      popover: {
        title: "Remediation Playbooks",
        description: "Step-by-step guides to fix every finding on a Sophos XGS firewall.",
        side: "top",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// Workspace & hub — page shell tours (data-tour anchors on each route)
// ---------------------------------------------------------------------------

const STEP_WORKSPACE_NAV: DriveStep = {
  element: sel("workspace-primary-nav"),
  popover: {
    title: "Workspace navigation",
    description:
      "Switch between Mission control, Assess, Fleet, Customers, Sophos Central, Reports, Insights, and the rest of the hub.",
    side: "bottom",
    align: "center",
  },
};

const STEP_CENTRAL_SUBNAV: DriveStep = {
  element: sel("central-subnav"),
  popover: {
    title: "Central sections",
    description:
      "Drill into Overview, Tenants, Firewalls, Alerts, MDR, Groups, Licensing, and Sync for your connected Sophos Central workspace.",
    side: "bottom",
    align: "center",
  },
};

const STEP_SHORTCUTS_HUB: DriveStep = {
  element: sel("shortcuts-button"),
  popover: {
    title: "Keyboard shortcuts",
    description: "Press Shift+? or use this button to see shortcuts for the page you're on.",
    side: "top",
    align: "end",
  },
};

const STEP_MANAGEMENT_HUB: DriveStep = {
  element: sel("management-panel"),
  popover: {
    title: "Management panel",
    description:
      "Saved reports, Sophos Central setup, team settings, and more open from the menu in the header.",
    side: "bottom",
    align: "start",
  },
};

function pageSurfaceStep(
  tourId: string,
  title: string,
  description: string,
  side: "top" | "bottom" = "bottom",
): DriveStep {
  return {
    element: sel(tourId),
    popover: { title, description, side, align: "center" },
  };
}

/** Highlighted workspace / hub region (popover centered). */
function wsStep(
  tourId: string,
  title: string,
  description: string,
  side: "top" | "bottom" | "left" | "right" = "bottom",
): DriveStep {
  return {
    element: sel(tourId),
    popover: { title, description, side, align: "center" },
  };
}

export type RunHubPageTourOpts = {
  includeWorkspaceNav?: boolean;
  centralSubnav?: boolean;
  includeShortcuts?: boolean;
  includeManagement?: boolean;
};

/** Shell + page steps + shortcuts + management; missing elements are skipped via filterVisible. */
export function runHubPageTour(pageSteps: DriveStep[], opts?: RunHubPageTourOpts) {
  const steps: DriveStep[] = [];
  if (opts?.includeWorkspaceNav !== false) {
    steps.push(STEP_WORKSPACE_NAV);
  }
  if (opts?.centralSubnav) {
    steps.push(STEP_CENTRAL_SUBNAV);
  }
  steps.push(...pageSteps);
  if (opts?.includeShortcuts !== false) {
    steps.push(STEP_SHORTCUTS_HUB);
  }
  if (opts?.includeManagement !== false) {
    steps.push(STEP_MANAGEMENT_HUB);
  }
  createTour(steps).drive();
}

/** Workspace tab bar, shortcuts, and management (steps omit missing anchors). */
export function startWorkspaceShellTour() {
  createTour([STEP_WORKSPACE_NAV, STEP_SHORTCUTS_HUB, STEP_MANAGEMENT_HUB]).drive();
}

export function startAssessPageTour() {
  runHubPageTour(
    [
      {
        popover: {
          title: "Assess workspace",
          description:
            "Upload configs, set customer context, run analysis, and ship reports. Follow the highlights below — steps skip anything not on screen yet (for example until files are loaded).",
          side: "bottom",
          align: "center",
        },
      },
      wsStep(
        "step-upload",
        "Upload & files",
        "Drop Sophos HTML or XML exports here, or add files. This kicks off parsing and scoring for your firewall assessment.",
        "bottom",
      ),
      wsStep(
        "agent-fleet",
        "Connected firewalls",
        "When Sophos Central agents are linked, configs can sync without manual HTML or XML exports.",
        "top",
      ),
      wsStep(
        "step-context",
        "Assessment context",
        "Customer name, environment, and frameworks tag every finding and report for this engagement.",
        "top",
      ),
      wsStep(
        "step-reports",
        "Reports",
        "Generate technical, executive, and compliance outputs once analysis has run.",
        "top",
      ),
      wsStep(
        "analysis-tabs",
        "Analysis tabs",
        "Switch between Overview, findings, compliance, maps, compare, and more after analysis completes.",
        "bottom",
      ),
      wsStep(
        "priority-actions",
        "Priority actions",
        "Critical and high findings surface first with remediation context.",
        "bottom",
      ),
      pageSurfaceStep(
        "tour-page-assess",
        "Full workspace",
        "Scroll the page for upload requests, connector setup, and the full analysis canvas.",
        "top",
      ),
    ],
    { includeWorkspaceNav: false },
  );
}

export function startMissionControlPageTour() {
  runHubPageTour([
    wsStep(
      "tour-mc-kpis",
      "Portfolio KPIs",
      "Customers, fleet size, critical Central alerts, and blended compliance give you a one-glance MSP posture. Live data appears when you are signed in with Central synced.",
      "bottom",
    ),
    wsStep(
      "tour-mc-activity",
      "Threat or workspace activity",
      "The chart reflects Sophos Central telemetry when connected, otherwise assessment activity — check the subtitle for the source.",
      "bottom",
    ),
    wsStep(
      "tour-mc-alerts",
      "Recent alerts",
      "Latest Central alerts with severity, customer, and device. Use Investigate to open the Central alerts hub for the full feed.",
      "top",
    ),
    wsStep(
      "tour-mc-top-risk",
      "Top customers by risk",
      "Ranking uses Central alert volume when tenants are synced, otherwise posture score — use this to prioritise follow-ups.",
      "bottom",
    ),
    wsStep(
      "tour-mc-fleet-health",
      "Fleet health",
      "Online versus offline and health slices across cached inventory help you spot sync or connectivity issues.",
      "bottom",
    ),
    wsStep(
      "tour-mc-quick-actions",
      "Quick actions",
      "Jump straight to a new assessment, reports, customer onboarding, or the playbook library.",
      "bottom",
    ),
    wsStep(
      "tour-mc-recent-docs",
      "Recent documents",
      "Saved report packages with quick links into the viewer or the full report library.",
      "top",
    ),
  ]);
}

export function startFleetPageTour() {
  runHubPageTour([
    wsStep(
      "tour-fleet-settings",
      "Workspace strip",
      "Org-level hints and Central sync context for fleet data appear here when you are signed in.",
      "bottom",
    ),
    wsStep(
      "tour-fleet-jump",
      "Quick navigation",
      "Jump to Assess, Customers, Central, Reports, Insights, Drift, or API without hunting the tab bar.",
      "bottom",
    ),
    wsStep(
      "tour-fleet-stats",
      "Fleet statistics",
      "Totals for devices, average score, critical findings, licence alerts, and customer sites frame the whole fleet.",
      "bottom",
    ),
    wsStep(
      "tour-fleet-drop-hint",
      "Drop to analyse",
      "Drag a Sophos config export onto a firewall card to open an instant assessment for that device.",
      "top",
    ),
    wsStep(
      "tour-fleet-tabs",
      "List or map",
      "Toggle between the sortable fleet list and the geographic map of devices.",
      "bottom",
    ),
    wsStep(
      "tour-fleet-filters",
      "Search & filters",
      "Search hostname, customer, or model; filter by grade and status; sort and spotlight weak or attention-needed firewalls.",
      "bottom",
    ),
    wsStep(
      "tour-fleet-list",
      "Fleet list & cards",
      "Expand tenants, open assessments, and export CSV from the live inventory.",
      "top",
    ),
    wsStep(
      "tour-fleet-map",
      "Map view",
      "Geographic distribution of firewalls when you switch to the Map tab.",
      "top",
    ),
  ]);
}

export function startCustomersPageTour() {
  runHubPageTour([
    wsStep(
      "tour-cust-settings",
      "Workspace strip",
      "Customer-directory settings and sync hints for this org show here when signed in.",
      "bottom",
    ),
    wsStep(
      "tour-cust-summary",
      "Directory summary",
      "Counts for total customers, active portals, overdue assessments, average score, and tracked firewalls.",
      "bottom",
    ),
    wsStep(
      "tour-cust-pulse",
      "Portfolio pulse",
      "Grade A/B mix across the directory — use it when briefing leadership; drill in with filters and exports.",
      "bottom",
    ),
    wsStep(
      "tour-cust-jump",
      "Workspace shortcuts",
      "One-click jumps to Mission control, Assess, Fleet, Central, Reports, Insights, and Playbooks.",
      "bottom",
    ),
    wsStep(
      "tour-cust-toolbar",
      "Search & actions",
      "Filter the directory, export, and onboard customers from this toolbar.",
      "bottom",
    ),
    wsStep(
      "tour-cust-directory",
      "Customer directory",
      "Per-customer posture, portals, and links into Fleet or Assess — your canonical MSP customer list.",
      "top",
    ),
  ]);
}

export function startCentralOverviewPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-connect-banner",
        "Connection status",
        "If Central is not connected, open workspace settings from here. Once connected, cached sync data powers the rest of the hub.",
        "bottom",
      ),
      wsStep(
        "tour-central-summary-cards",
        "Sync snapshot",
        "Connection state, cached tenant count, firewall inventory, and a shortcut to the Sync tab for refresh.",
        "bottom",
      ),
      wsStep(
        "tour-central-api-hosts",
        "API hosts",
        "When available, resolved Central API endpoints for your connector are listed for troubleshooting.",
        "top",
      ),
      wsStep(
        "tour-central-explore",
        "Explore Central",
        "Cards deep-link into Tenants, Firewalls, Alerts, MDR, Groups, Licensing, and Sync — each has its own tour from the subnav.",
        "top",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralTenantsPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-tenants-intro",
        "Cached tenants",
        "Rows reflect your last successful sync — not a live directory listing. Refresh from Sync or the header when data is stale.",
        "bottom",
      ),
      wsStep(
        "tour-central-tenants-table",
        "Tenant table",
        "Tenant name, region, and firewall counts help you verify coverage before drilling into Firewalls or Alerts.",
        "top",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralFirewallsPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-fw-intro",
        "Firewall inventory",
        "Cached Sophos Central firewalls for your org. Use sync to refresh models, firmware, and online state.",
        "bottom",
      ),
      wsStep(
        "tour-central-fw-table",
        "Inventory table",
        "Filter and open a device for tenant-scoped detail and deep links back to Fleet command.",
        "top",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralAlertsPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-alerts-controls",
        "Alert controls",
        "Filter by severity and tenant, search text, and refresh the batched Central feed.",
        "bottom",
      ),
      wsStep(
        "tour-central-alerts-table",
        "Alert feed",
        "Latest alerts across synced tenants — use Mission control for a shorter recent list or triage here in full.",
        "top",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralMdrPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-mdr-shell",
        "MDR feed",
        "Threat indicators and MDR-oriented signals from Central appear here when data is available.",
        "bottom",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralGroupsPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-groups-shell",
        "Firewall groups",
        "Central firewall groups for policy and inventory alignment — use alongside the per-firewall inventory.",
        "bottom",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralLicensingPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-licensing-shell",
        "Licensing",
        "Device and SKU visibility derived from cached Central data — refresh from Sync when licences change.",
        "bottom",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralSyncPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-sync-shell",
        "Sync & API",
        "Connector status, manual refresh, and API details to keep tenants and firewalls current.",
        "bottom",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startCentralFirewallDetailPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-central-fw-detail-shell",
        "Firewall detail",
        "Tenant-scoped device view with health, metadata, and links back to the wider inventory and Fleet.",
        "bottom",
      ),
    ],
    { centralSubnav: true },
  );
}

export function startReportsHubPageTour() {
  runHubPageTour([
    wsStep(
      "tour-reports-stats",
      "Report metrics",
      "Totals, monthly volume, pending delivery, and delivered counts summarise report activity for the workspace.",
      "bottom",
    ),
    wsStep(
      "tour-reports-filters",
      "Filters & search",
      "Narrow by date, customer, environment, and free-text search across the library.",
      "bottom",
    ),
    wsStep(
      "tour-reports-library",
      "Report library",
      "Sortable table of generated reports — open a row to view HTML or manage delivery.",
      "top",
    ),
    wsStep(
      "tour-reports-scheduled",
      "Scheduled reports",
      "Expand to review cadence, next run, and active toggles for automated customer delivery.",
      "top",
    ),
    wsStep(
      "tour-reports-sidebar",
      "Tips & actions",
      "Side panel guidance and shortcuts for generation workflows when present.",
      "top",
    ),
  ]);
}

export function startSavedReportViewerPageTour() {
  runHubPageTour([
    wsStep(
      "tour-saved-breadcrumb",
      "Navigation",
      "Return to Report centre or stay in the saved document context from the header strip.",
      "bottom",
    ),
    wsStep(
      "tour-saved-document",
      "Saved report",
      "Read-only rendered report — same document shell as live assessments for consistent customer delivery.",
      "top",
    ),
  ]);
}

export function startInsightsPageTour() {
  runHubPageTour([
    wsStep(
      "tour-ins-header",
      "Security intelligence",
      "Cross-customer trends and portfolio analytics — switch time windows to change every chart.",
      "bottom",
    ),
    wsStep(
      "tour-ins-risk-strip",
      "Portfolio risk strip",
      "Customers below target, stale assessments, and weakest scores surface for prioritisation.",
      "bottom",
    ),
    wsStep(
      "tour-ins-settings",
      "Workspace strip",
      "Insights-specific workspace settings when signed in.",
      "bottom",
    ),
    wsStep(
      "tour-ins-time-range",
      "Time range",
      "7D through 12M and Custom control the window for threat and trend visuals.",
      "bottom",
    ),
    wsStep(
      "tour-ins-threat",
      "Threat landscape",
      "Modelled traffic and category mix for the selected period — use for exec briefings.",
      "top",
    ),
    wsStep(
      "tour-ins-widgets",
      "Insight widgets",
      "Additional portfolio widgets and breakdowns fill the rest of the page as you scroll.",
      "top",
    ),
  ]);
}

export function startDriftPageTour() {
  runHubPageTour([
    wsStep(
      "tour-drift-selector",
      "Firewall & snapshots",
      "Pick a firewall to scope cached snapshots and timeline data (connector-driven when deployed).",
      "bottom",
    ),
    wsStep(
      "tour-drift-compare",
      "Manual config compare",
      "Upload baseline and current exports for a structured diff when you need an ad-hoc comparison.",
      "bottom",
    ),
    wsStep(
      "tour-drift-timeline",
      "Stats & snapshot timeline",
      "Snapshot counts, score trend, and the interactive timeline — select a node to inspect change details.",
      "top",
    ),
    wsStep(
      "tour-drift-history",
      "Drift history",
      "Customer-scoped history cards for engagement-level storytelling (demo data where shown).",
      "top",
    ),
    wsStep(
      "tour-drift-alerts",
      "Drift alert rules",
      "Expand to toggle which drift conditions should raise notifications for your team.",
      "bottom",
    ),
  ]);
}

export function startPlaybooksPageTour() {
  runHubPageTour([
    wsStep(
      "tour-pb-header",
      "Playbook library",
      "Remediation guides mapped to Sophos best-practice checks — use alongside Assess findings.",
      "bottom",
    ),
    wsStep(
      "tour-pb-search",
      "Search",
      "Filter hundreds of playbooks by keyword to match the finding you are fixing.",
      "bottom",
    ),
    wsStep(
      "tour-pb-categories",
      "Categories",
      "Chip filters by security domain — combine with search to narrow fast.",
      "bottom",
    ),
    wsStep(
      "tour-pb-stats",
      "Library stats",
      "Totals, categories, average effort, and completion tracking for your team.",
      "bottom",
    ),
    wsStep(
      "tour-pb-grid",
      "Playbook cards",
      "Open a card for step-by-step remediation content you can follow on live firewalls.",
      "top",
    ),
  ]);
}

export function startApiHubPageTour() {
  runHubPageTour([
    wsStep(
      "tour-api-hero",
      "API & integrations",
      "Automate FireComply: marketplace integrations, REST explorer, webhooks, and connector agents — all from this hub.",
      "bottom",
    ),
    wsStep(
      "tour-api-tabs",
      "Hub sections",
      "Switch tabs to configure third-party apps, try API calls, manage webhook endpoints, or review agent connectivity.",
      "bottom",
    ),
    wsStep(
      "tour-api-panel",
      "Workspace tools",
      "The strip and body under the tabs reflect your org — keys, examples, and lists update per section.",
      "top",
    ),
  ]);
}

export function startTrustPageTour() {
  runHubPageTour([
    wsStep(
      "tour-trust-hero",
      "Trust centre",
      "Security, privacy, and compliance posture for the FireComply platform — share with customer risk teams.",
      "bottom",
    ),
    wsStep(
      "tour-trust-security",
      "Security practices",
      "How we protect data, infrastructure, and access — alignment questions start here.",
      "bottom",
    ),
    wsStep(
      "tour-trust-privacy",
      "Privacy & data",
      "Data handling, retention themes, and subprocessors customers ask about in reviews.",
      "top",
    ),
    wsStep(
      "tour-trust-compliance",
      "Compliance & assurances",
      "Framework mappings, questionnaires, and downloadable artefacts when available.",
      "top",
    ),
  ]);
}

export function startChangelogPageTour() {
  runHubPageTour([
    wsStep(
      "tour-changelog-hero",
      "Updates",
      "Product changes, threat intel, and firmware references — the in-app companion to the technical changelog.",
      "bottom",
    ),
    wsStep(
      "tour-changelog-panels",
      "Highlights",
      "Overview panels summarise what shipped recently without reading the full history.",
      "bottom",
    ),
    wsStep(
      "tour-changelog-history",
      "Detailed history",
      "Month-by-month bullets for auditors and power users who need exact shipped behaviour.",
      "top",
    ),
  ]);
}

export function startAuditPageTour() {
  runHubPageTour([
    wsStep(
      "tour-audit-actions",
      "Open in drawer",
      "The same audit log is available inside the management drawer — use whichever fits your workflow.",
      "bottom",
    ),
    wsStep(
      "tour-audit-log",
      "Activity log",
      "Immutable-style workspace events for sign-ins, settings, and report actions when signed in.",
      "top",
    ),
  ]);
}

export function startNotFoundPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-nf-message",
        "Unknown URL",
        "This path is not registered in the app — the address may be a typo or an old bookmark.",
        "top",
      ),
      wsStep(
        "tour-nf-cta",
        "Get back on track",
        "Use Back to FireComply or the workspace tabs (when signed in) to return to a known area.",
        "bottom",
      ),
    ],
    { includeWorkspaceNav: false },
  );
}

export function startSharedReportPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-shared-header",
        "Shared report",
        "Read-only assessment shared by link — branding and customer name come from the publisher.",
        "bottom",
      ),
      wsStep(
        "tour-shared-downloads",
        "Downloads",
        "When enabled, export Word or print PDF for offline sharing — respect your org policy on redistribution.",
        "bottom",
      ),
      wsStep(
        "tour-shared-body",
        "Report content",
        "Full findings and narrative as delivered; link expiry is shown in the header strip.",
        "top",
      ),
    ],
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startSharedReportErrorPageTour() {
  runHubPageTour(
    [
      wsStep(
        "tour-shared-error",
        "Link issue",
        "The share may be invalid, expired, or unavailable — request a fresh link from the report owner.",
        "top",
      ),
    ],
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startClientPortalPageTour() {
  runHubPageTour(
    filterVisible([
      wsStep(
        "tour-portal-shell",
        "Client portal",
        "Read-only customer view of assessments and reports your MSP published — scoped to this tenant.",
        "bottom",
      ),
      wsStep(
        "tour-portal-header",
        "Branding & session",
        "Customer name, optional MSP branding, sign out, and theme — same portal identity on every tab.",
        "bottom",
      ),
      wsStep(
        "tour-portal-tabs",
        "Sections",
        "Switch between dashboard, findings, compliance, and published reports without leaving the portal.",
        "bottom",
      ),
      wsStep(
        "tour-portal-main",
        "Content",
        "Scores, findings, and documents for this tenant — what your customer is cleared to see.",
        "top",
      ),
    ]),
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startConfigUploadPageTour() {
  runHubPageTour(
    filterVisible([
      wsStep(
        "tour-upload-token-shell",
        "Secure upload",
        "Tokenised upload flow for customers to submit configs without a full workspace login.",
        "bottom",
      ),
      wsStep(
        "tour-upload-header",
        "Health check context",
        "Confirms this is the Sophos Firewall Health Check intake — not the full workspace.",
        "bottom",
      ),
      wsStep(
        "tour-upload-dropzone",
        "Drop or choose file",
        "Submit the firewall export (e.g. entities.xml); progress shows while the file uploads.",
        "top",
      ),
    ]),
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startTeamInvitePageTour() {
  runHubPageTour(
    filterVisible([
      wsStep(
        "tour-invite-shell",
        "Team invite",
        "Accept an invitation to join an organisation — sign in with the invited email when prompted.",
        "bottom",
      ),
      wsStep(
        "tour-invite-brand",
        "FireComply",
        "You landed on a one-time team invite link scoped to Sophos FireComply.",
        "bottom",
      ),
      wsStep(
        "tour-invite-card",
        "Status & next step",
        "Loading, success, sign-in, or error states appear here — follow the prompt to finish joining.",
        "top",
      ),
    ]),
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startThemePreviewPageTour() {
  runHubPageTour(
    filterVisible([
      wsStep(
        "tour-theme-header",
        "Theme preview",
        "Internal preview of colours, typography, and components — not customer data.",
        "bottom",
      ),
      wsStep(
        "tour-theme-workspace",
        "Live hub chrome",
        "Workspace subpage headers and buttons as they render on real routes — toggle light/dark in your OS or app.",
        "bottom",
      ),
      wsStep(
        "tour-theme-landing",
        "Marketing surfaces",
        "Hero and trust patterns used on first-run experiences — scroll for more component blocks below.",
        "top",
      ),
      wsStep(
        "tour-theme-palette",
        "Brand tokens",
        "Named Sophos palette swatches the UI derives accents and states from.",
        "top",
      ),
    ]),
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export function startSharedHealthCheckPageTour() {
  runHubPageTour(
    filterVisible([
      wsStep(
        "tour-shc-shell",
        "Shared health check",
        "Read-only SE health check delivered via link — same HTML report the engineer saved.",
        "bottom",
      ),
      wsStep(
        "tour-shc-actions",
        "Download & print",
        "Save HTML or open print/PDF when sharing allows — customer and expiry show in the bar.",
        "top",
      ),
      wsStep(
        "tour-shc-report",
        "Report body",
        "The embedded health check HTML — scroll the full assessment as the engineer delivered it.",
        "top",
      ),
    ]),
    { includeWorkspaceNav: false, includeManagement: false },
  );
}

export type WorkspacePageTourMeta = { label: string; start: () => void };

function centralTourMeta(path: string): WorkspacePageTourMeta {
  if (path.includes("/central/firewall/")) {
    return { label: "This page (Central · Firewall)", start: startCentralFirewallDetailPageTour };
  }
  const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
  const sub = parts[1] ?? "overview";
  switch (sub) {
    case "tenants":
      return { label: "This page (Central · Tenants)", start: startCentralTenantsPageTour };
    case "firewalls":
      return { label: "This page (Central · Firewalls)", start: startCentralFirewallsPageTour };
    case "alerts":
      return { label: "This page (Central · Alerts)", start: startCentralAlertsPageTour };
    case "mdr":
      return { label: "This page (Central · MDR)", start: startCentralMdrPageTour };
    case "groups":
      return { label: "This page (Central · Groups)", start: startCentralGroupsPageTour };
    case "licensing":
      return { label: "This page (Central · Licensing)", start: startCentralLicensingPageTour };
    case "sync":
      return { label: "This page (Central · Sync)", start: startCentralSyncPageTour };
    default:
      return { label: "This page (Central · Overview)", start: startCentralOverviewPageTour };
  }
}

/**
 * Tours menu: “This page” for the current route. Token/share flows included where UI exists.
 */
export function getWorkspacePageTourMeta(pathname: string): WorkspacePageTourMeta | null {
  const path = pathname.split("?")[0] || pathname;

  if (path === "/preview") {
    return { label: "This page (Theme preview)", start: startThemePreviewPageTour };
  }
  if (path.startsWith("/shared/")) {
    return { label: "This page (Shared report)", start: startSharedReportPageTour };
  }
  if (path.startsWith("/portal/")) {
    return { label: "This page (Client portal)", start: startClientPortalPageTour };
  }
  if (path.startsWith("/upload/")) {
    return { label: "This page (Config upload)", start: startConfigUploadPageTour };
  }
  if (path.startsWith("/team-invite/")) {
    return { label: "This page (Team invite)", start: startTeamInvitePageTour };
  }

  if (path === "/") {
    return { label: "This page (Assess)", start: startAssessPageTour };
  }
  if (path === "/dashboard") {
    return { label: "This page (Mission control)", start: startMissionControlPageTour };
  }
  if (path === "/command") {
    return { label: "This page (Fleet)", start: startFleetPageTour };
  }
  if (path === "/customers") {
    return { label: "This page (Customers)", start: startCustomersPageTour };
  }
  if (path === "/central" || path.startsWith("/central/")) {
    return centralTourMeta(path);
  }
  if (path === "/reports") {
    return { label: "This page (Reports)", start: startReportsHubPageTour };
  }
  if (path.startsWith("/reports/")) {
    return { label: "This page (Saved report)", start: startSavedReportViewerPageTour };
  }
  if (path === "/insights") {
    return { label: "This page (Insights)", start: startInsightsPageTour };
  }
  if (path === "/drift") {
    return { label: "This page (Drift)", start: startDriftPageTour };
  }
  if (path === "/playbooks") {
    return { label: "This page (Playbooks)", start: startPlaybooksPageTour };
  }
  if (path === "/api") {
    return { label: "This page (API)", start: startApiHubPageTour };
  }
  if (path === "/trust") {
    return { label: "This page (Trust)", start: startTrustPageTour };
  }
  if (path === "/changelog") {
    return { label: "This page (Updates)", start: startChangelogPageTour };
  }
  if (path === "/help" || path.startsWith("/help/")) {
    return null;
  }
  if (path === "/audit") {
    return { label: "This page (Activity log)", start: startAuditPageTour };
  }
  if (path.startsWith("/health-check/shared/")) {
    return { label: "This page (Shared health check)", start: startSharedHealthCheckPageTour };
  }
  if (path.startsWith("/health-check")) {
    return { label: "This page (Health check)", start: startHealthCheckTour };
  }

  return { label: "This page (Not found)", start: startNotFoundPageTour };
}

// ---------------------------------------------------------------------------
// Micro-tours — short contextual spotlights per analysis tab
// ---------------------------------------------------------------------------

const MICRO_TOUR_PREFIX = "firecomply-micro-tour-tab-";

function hasMicroTourRun(tab: string): boolean {
  try {
    return localStorage.getItem(MICRO_TOUR_PREFIX + tab) === "1";
  } catch (e) {
    warnOptionalError("guided-tours.hasMicroTourRun", e);
    return false;
  }
}

function markMicroTourRun(tab: string): void {
  try {
    localStorage.setItem(MICRO_TOUR_PREFIX + tab, "1");
  } catch (e) {
    warnOptionalError("guided-tours.markMicroTourRun", e);
  }
}

const MICRO_TOUR_STEPS: Record<string, DriveStep[]> = {
  overview: [
    {
      element: sel("widget-customiser"),
      popover: {
        title: "Customise Widgets",
        description:
          "Turn on more Overview widgets — Assessment Pulse, Quick Actions, Findings by Age, and more.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("export-buttons"),
      popover: {
        title: "Export Options",
        description:
          "Export your risk register as CSV, Excel, or interactive HTML for offline review.",
        side: "bottom",
        align: "center",
      },
    },
  ],
  security: [
    {
      element: sel("widget-customiser"),
      popover: {
        title: "Security Widgets",
        description:
          "Enable Category Score Bars, Coverage Matrix, Finding Heatmap, and more from the widget menu.",
        side: "bottom",
        align: "center",
      },
    },
  ],
  compliance: [
    {
      element: sel("sophos-best-practice"),
      popover: {
        title: "Sophos Best Practice",
        description:
          "Automatic checks against Sophos recommended configuration — scored by licence tier.",
        side: "top",
        align: "center",
      },
    },
  ],
  optimisation: [
    {
      element: sel("widget-customiser"),
      popover: {
        title: "Optimisation Widgets",
        description: "Enable Config Complexity, Unused Objects, and Rule Analysis widgets.",
        side: "bottom",
        align: "center",
      },
    },
  ],
  tools: [
    {
      element: sel("compare-baseline"),
      popover: {
        title: "Compare to Baseline",
        description: "Compare your current config against a saved baseline to detect drift.",
        side: "top",
        align: "center",
      },
    },
  ],
  remediation: [
    {
      element: sel("remediation-playbooks"),
      popover: {
        title: "Remediation Playbooks",
        description: "Step-by-step guides to fix each finding, with severity and impact context.",
        side: "top",
        align: "center",
      },
    },
  ],
};

export function startMicroTourForTab(tab: string): void {
  if (hasMicroTourRun(tab)) return;
  const steps = MICRO_TOUR_STEPS[tab];
  if (!steps || steps.length === 0) return;

  const visible = filterVisible(steps);
  if (visible.length === 0) return;

  const t = driver({
    showProgress: visible.length > 1,
    animate: true,
    overlayColor: "rgba(0,0,0,0.5)",
    stagePadding: 8,
    stageRadius: 10,
    popoverOffset: 12,
    progressText: "{{current}} / {{total}}",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Got it",
    steps: visible,
    onDestroyed: () => markMicroTourRun(tab),
  });
  t.drive();
}

// ---------------------------------------------------------------------------
// Health Check Tour — Landing (data sources)
// ---------------------------------------------------------------------------
export function startHealthCheckTour(): void {
  const t = createTour([
    {
      element: sel("health-check"),
      popover: {
        title: "Sophos SE Health Check",
        description:
          "A dedicated tool for Sophos Sales Engineers to run best-practice health checks on customer firewalls.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("hc-upload"),
      popover: {
        title: "Upload Config",
        description:
          "Drop in the customer's entities.xml or HTML config viewer export. You can also request the customer uploads it for you via a secure link.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("hc-upload-requests"),
      popover: {
        title: "Upload Requests",
        description:
          "View pending and completed upload requests from customers. Load uploaded configs directly from here.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("hc-central"),
      popover: {
        title: "Sophos Central API",
        description:
          "Connect the customer's Sophos Central to discover firewalls, auto-detect licence tiers, and pull firmware data. Credentials stay in your session only.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("hc-management"),
      popover: {
        title: "Management",
        description:
          "Open the management panel to update your display name, SE title, and profile settings.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: sel("hc-history"),
      popover: {
        title: "Saved Reports",
        description:
          "View and reopen previously saved health checks. Switch between your reports, team reports, and all teams.",
        side: "top",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// Health Check Tour — Results & Export
// ---------------------------------------------------------------------------
export function startHealthCheckResultsTour(): void {
  const t = createTour([
    {
      element: sel("hc-customer-details"),
      popover: {
        title: "Customer Details",
        description:
          "Fill in the customer name, email, and who the report is prepared for. These fields are required before you can export or email the report.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("hc-licence-toggle"),
      popover: {
        title: "Licence Tier",
        description:
          "Toggle between Standard and Xstream Protection. This determines which best practice checks apply. If Central is connected, the tier is auto-detected.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("hc-bp-results"),
      popover: {
        title: "Best Practice Results",
        description:
          "Detailed pass/fail/warning results for every Sophos best practice check. You can add notes to individual findings and view remediation guides.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("hc-export"),
      popover: {
        title: "Save & Export",
        description:
          "Save the health check, download as PDF + HTML, export findings as CSV, or email the report directly to the customer. Set follow-up reminders for 3 or 6 months.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("hc-score-trend"),
      popover: {
        title: "Score Trend",
        description:
          "Track how this customer's health check score changes over time, matched by firewall serial number.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("hc-team-dashboard"),
      popover: {
        title: "Team Dashboard",
        description:
          "Operational stats for your team — total checks, average scores, common findings, and recent activity.",
        side: "top",
        align: "center",
      },
    },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// Login / Auth Gate Tour
// ---------------------------------------------------------------------------
export function startLoginTour() {
  const t = createTour([
    {
      element: sel("auth-tabs"),
      popover: {
        title: "Sign In or Create Account",
        description:
          "Use 'Sign In' if you already have an account, or switch to 'Create Account' to register with your email. You'll receive a confirmation link before your first sign-in.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: sel("auth-passkey"),
      popover: {
        title: "Passkey Sign-In",
        description:
          "Sign in instantly with a passkey — your device's biometric (Face ID, Touch ID, or Windows Hello) or a hardware security key. No password needed. You can set up passkeys after your first email sign-in from Settings → Security.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("auth-demo"),
      popover: {
        title: "Demo Mode",
        description:
          "Explore the full app with sample data — no account required. Assessments, reports, dashboards, and all features are pre-populated so you can see what FireComply does before signing up.",
        side: "top",
        align: "center",
      },
    },
    {
      element: sel("auth-guest"),
      popover: {
        title: "Guest Mode",
        description:
          "Start using the app immediately without an account. Upload configs and run assessments — everything stays in your browser. Sign in later to unlock cloud saves, teams, client portals, and email reports.",
        side: "top",
        align: "center",
      },
    },
  ]);
  t.drive();
}
