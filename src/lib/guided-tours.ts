import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

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
    { element: sel("step-upload"), popover: { title: "Upload Firewall Exports", description: "Drop your Sophos config HTML exports here, or click to browse. You can export these from the Sophos XGS Config Viewer.", side: "bottom", align: "center" } },
    { element: sel("agent-fleet"), popover: { title: "Connected Firewalls", description: "Load configs directly from your connected Sophos Central agents — no HTML export needed.", side: "top", align: "center" } },
    { element: sel("step-context"), popover: { title: "Assessment Context", description: "Set the customer name, environment, and compliance frameworks to tag your findings.", side: "top", align: "center" } },
    { element: sel("step-reports"), popover: { title: "Generate Reports", description: "Generate technical reports, executive briefs, and compliance packs from your analysis.", side: "top", align: "center" } },
    { element: sel("management-panel"), popover: { title: "Management Panel", description: "Access saved reports, config history, team settings, Sophos Central integration, and more.", side: "bottom", align: "start" } },
    { element: sel("theme-toggle"), popover: { title: "Theme", description: "Switch between dark and light mode.", side: "bottom", align: "end" } },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// 2. Dashboard Guide
// ---------------------------------------------------------------------------
export function startDashboardTour() {
  const t = createTour([
    { element: sel("priority-actions"), popover: { title: "Priority Actions", description: "Critical and high-severity findings that need immediate attention, with remediation steps.", side: "bottom", align: "center" } },
    { element: sel("stats-bar"), popover: { title: "At-a-Glance Metrics", description: "Firewalls loaded, rules parsed, sections extracted, and issues found.", side: "bottom", align: "center" } },
    { element: sel("analysis-tabs"), popover: { title: "Analysis Tabs", description: "Deep-dive into security analysis, compliance mapping, rule optimisation, and remediation playbooks.", side: "bottom", align: "center" } },
    { element: sel("inspection-posture"), popover: { title: "Inspection Posture", description: "Web filtering, IPS, and application control coverage across your WAN-facing rules.", side: "top", align: "center" } },
    { element: sel("export-buttons"), popover: { title: "Export", description: "Export your findings as a CSV risk register or Excel spreadsheet for offline use.", side: "bottom", align: "center" } },
    { element: sel("ai-chat-trigger"), popover: { title: "AI Chat", description: "Ask the AI assistant questions about your firewall configuration and get contextual answers.", side: "left", align: "center" } },
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
      { element: sel("score-dial"), popover: { title: "Risk Score", description: "Your overall risk score from 0–100, based on weighted analysis across multiple security categories.", side: "right", align: "center" } },
      { element: sel("score-grade"), popover: { title: "Grade", description: "Letter grade for quick assessment. <strong>A</strong> = 90+, <strong>B</strong> = 75+, <strong>C</strong> = 60+, <strong>D</strong> = 40+, <strong>F</strong> = below 40.", side: "bottom", align: "center" } },
      { element: sel("score-categories"), popover: { title: "Category Breakdown", description: "Scores split across: Rule Hygiene, Inspection Coverage, Access Control, Network Segmentation, Logging & Visibility, and Authentication.", side: "top", align: "center" } },
      { element: sel("score-simulator"), popover: { title: "Remediation Impact Simulator", description: "Select recommended remediation actions and instantly see how they would improve your score, grade, and coverage.", side: "top", align: "center" } },
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
      { element: sel("framework-selector"), popover: { title: "Framework Selection", description: "Choose from NIST 800-53, ISO 27001, CIS, PCI DSS, HIPAA, HITECH, Essential Eight, Cyber Essentials, and more.", side: "bottom", align: "center" } },
      { element: sel("compliance-heatmap"), popover: { title: "Compliance Heatmap", description: "View a heatmap of control coverage, gaps, and readiness per framework.", side: "top", align: "center" } },
      { element: sel("sophos-best-practice"), popover: { title: "Sophos Best Practice", description: "Automatic checks against the Sophos recommended configuration baseline.", side: "top", align: "center" } },
      { element: sel("custom-frameworks"), popover: { title: "Custom Frameworks", description: "Build your own compliance framework in Settings with custom controls and mappings.", side: "top", align: "center" } },
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
      { element: sel("compare-before"), popover: { title: "Before Config", description: "Choose the baseline configuration.", side: "bottom", align: "center" } },
      { element: sel("compare-after"), popover: { title: "After Config", description: "Choose the updated configuration to compare against.", side: "bottom", align: "center" } },
      { element: sel("compare-button"), popover: { title: "Run Comparison", description: "Generate a diff showing added, removed, and modified rules and settings. Green = additions, red = removals, amber = modifications.", side: "bottom", align: "center" } },
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
      { element: sel("remediation-playbooks"), popover: { title: "Remediation Playbooks", description: "Step-by-step guides to fix each finding on a Sophos XGS firewall, with severity and impact.", side: "top", align: "center" } },
      { element: sel("change-approval"), popover: { title: "Change Approval", description: "Submit remediation plans for approval. Track status: draft → pending → approved or rejected.", side: "top", align: "center" } },
      { element: sel("remediation-progress"), popover: { title: "Progress Tracking", description: "Track remediation progress across all findings.", side: "top", align: "center" } },
      { element: sel("remediation-roadmap"), popover: { title: "Remediation Roadmap", description: "View the prioritised roadmap of fixes.", side: "top", align: "center" } },
      { element: sel("findings-bulk"), popover: { title: "Bulk Actions", description: "Select multiple findings for bulk status updates.", side: "top", align: "center" } },
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
      { element: sel("compare-baseline"), popover: { title: "Compare to Baseline", description: "Compare your current analysis against a saved baseline to detect config drift.", side: "top", align: "center" } },
      { element: sel("baseline-manager"), popover: { title: "Baseline Manager", description: "Save a snapshot of your current config as a baseline for future comparison.", side: "top", align: "center" } },
      { element: sel("score-simulator"), popover: { title: "Remediation Impact Simulator", description: "Select recommended actions and instantly see projected risk reduction, grade improvement, and coverage gains.", side: "top", align: "center" } },
    ];
    const visible = filterVisible(steps);
    if (visible.length < steps.length) {
      visible.push({ element: sel("widget-customiser"), popover: { title: "Enable More Widgets", description: "Some tools are hidden. Click the <strong>Widgets</strong> button to enable <strong>Baseline Manager</strong> and other tools on the Tools tab.", side: "bottom", align: "center" } });
    }
    const t = driver({
      showProgress: true, animate: true, overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8, stageRadius: 10, popoverOffset: 12,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next →", prevBtnText: "← Back", doneBtnText: "Done",
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
      { element: sel("attack-surface"), popover: { title: "Attack Surface Map", description: "Visualise your network's attack surface based on firewall rules and exposed services.", side: "top", align: "center" } },
      { element: sel("fleet-map"), popover: { title: "Geographic Fleet Map", description: "View your firewalls' external IP addresses and their geographic locations.", side: "top", align: "center" } },
      { element: sel("zone-map"), popover: { title: "Network Zone Map", description: "Zone-to-zone traffic flow and security level visualisation.", side: "top", align: "center" } },
    ];
    const visible = filterVisible(steps);
    if (visible.length < steps.length) {
      visible.push({ element: sel("widget-customiser"), popover: { title: "Enable More Widgets", description: "Some maps are hidden. Click the <strong>Widgets</strong> button to enable <strong>Geographic Fleet Map</strong> (Tools tab) and <strong>Network Zone Map</strong> (Security tab).", side: "bottom", align: "center" } });
    }
    const t = driver({
      showProgress: true, animate: true, overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8, stageRadius: 10, popoverOffset: 12,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next →", prevBtnText: "← Back", doneBtnText: "Done",
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
    { element: sel("widget-customiser"), popover: { title: "Widget Customiser", description: "Toggle optional widgets on each analysis tab. Enable or disable Peer Benchmark, Insurance Readiness, Evidence Collection, and more.", side: "bottom", align: "center" } },
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
          { element: sel("central-section"), popover: { title: "Sophos Central API", description: "Connect your Sophos Central account to pull live firewall data, licence info, and alerts.", side: "left", align: "start" } },
          { popover: { title: "How to Get API Credentials", description: "<strong>Step 1:</strong> Sign in to <strong>central.sophos.com</strong><br/><br/><strong>Step 2:</strong> Go to <strong>Settings & Policies → API Credentials Management</strong><br/><br/><strong>Step 3:</strong> Click <strong>Add Credential</strong>. Name it 'FireComply' and select <strong>Service Principal Read-Only</strong><br/><br/><strong>Step 4:</strong> Copy the <strong>Client ID</strong> and <strong>Client Secret</strong><br/><br/><strong>Step 5:</strong> Paste them into the form and click <strong>Connect</strong>" } },
          { element: sel("central-client-id"), popover: { title: "Client ID", description: "Paste your Sophos Central Client ID here.", side: "top", align: "center" } },
          { element: sel("central-client-secret"), popover: { title: "Client Secret", description: "Paste your Client Secret here. It will be encrypted at rest.", side: "top", align: "center" } },
          { element: sel("central-connect-btn"), popover: { title: "Connect", description: "Click to connect to Sophos Central. Your credentials are encrypted and stored securely.", side: "top", align: "center" } },
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
          { element: sel("connector-section"), popover: { title: "FireComply Connector Agents", description: "Connector agents run on your network and automatically pull firewall configs on a schedule.", side: "left", align: "start" } },
          { element: sel("connector-register"), popover: { title: "Register Agent", description: "Register a new agent to generate an API key. Enter the firewall name, IP address, and schedule.", side: "bottom", align: "center" } },
          { popover: { title: "Setup Flow", description: "<strong>Step 1:</strong> Click <strong>Register Agent</strong> and fill in your firewall details — an API key will be generated<br/><br/><strong>Step 2:</strong> Download the connector app for your OS<br/><br/><strong>Step 3:</strong> Open the connector, paste the API key, and add your firewall's IP and API credentials<br/><br/><strong>Step 4:</strong> The agent will pull configs on schedule and submit assessments automatically" } },
          { element: sel("connector-download"), popover: { title: "Download Connector", description: "Download the FireComply Connector for Windows, macOS, or Linux.", side: "top", align: "center" } },
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
    { element: sel("export-zip"), popover: { title: "Download All", description: "Download all reports as a ZIP containing PDF, Word, and HTML versions.", side: "bottom", align: "center" } },
    { element: sel("export-pdf"), popover: { title: "Download PDF", description: "Export the current report as a branded PDF document.", side: "bottom", align: "center" } },
    { element: sel("export-word"), popover: { title: "Download Word", description: "Export as a Word document for editing and customisation.", side: "bottom", align: "center" } },
    { element: sel("share-report"), popover: { title: "Share Report", description: "Generate a shareable link with optional expiry and download permissions.", side: "bottom", align: "center" } },
    { element: sel("export-risk-register"), popover: { title: "Export Risk Register", description: "Download findings as a CSV risk register for GRC tools.", side: "bottom", align: "center" } },
    { element: sel("export-excel"), popover: { title: "Export Excel", description: "Download the full analysis as an Excel spreadsheet.", side: "bottom", align: "center" } },
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
          { element: sel("drawer-portal"), popover: { title: "Client Portal", description: "Set up a branded portal to share assessment results with your customers.", side: "left", align: "start" } },
          { popover: { title: "Portal Features", description: "Choose what to show: risk scores, findings, reports, and your branding. Preview what your customer will see, then send them the portal link for read-only access." } },
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
        { element: sel("drawer-tab-dashboard"), popover: { title: "Dashboard", description: "Tenant overview, score trends, licence expiry, and scheduled assessments.", side: "bottom", align: "center" } },
        { element: sel("drawer-tab-reports"), popover: { title: "Reports", description: "Browse and load previously saved reports.", side: "bottom", align: "center" } },
        { element: sel("drawer-tab-history"), popover: { title: "History", description: "Assessment history and config version changes over time.", side: "bottom", align: "center" } },
        { element: sel("drawer-tab-settings"), popover: { title: "Settings", description: "Sophos Central, connector agents, team members, alerts, webhooks, compliance frameworks, and more.", side: "bottom", align: "center" } },
        { element: sel("drawer-audit"), popover: { title: "Activity Log", description: "Full audit trail of all actions taken in FireComply.", side: "top", align: "center" } },
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
          { element: sel("drawer-team"), popover: { title: "Team Management", description: "Invite team members by email and assign roles.", side: "left", align: "start" } },
          { popover: { title: "Roles", description: "<strong>Admin:</strong> Full access to all features<br/><br/><strong>Engineer:</strong> Run assessments and manage agents<br/><br/><strong>Member:</strong> View analysis and generate reports<br/><br/><strong>Viewer:</strong> Read-only access" } },
          { element: sel("drawer-mfa"), popover: { title: "Multi-Factor Authentication", description: "Enable MFA for an extra layer of security on your account.", side: "top", align: "center" } },
          { element: sel("drawer-passkeys"), popover: { title: "Passkeys", description: "Set up passkeys for fast, passwordless sign-in.", side: "top", align: "center" } },
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
    { element: sel("notification-bell"), popover: { title: "Notifications", description: "In-app notifications appear here. Click to view and manage.", side: "bottom", align: "center" } },
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
              { element: sel("drawer-alerts"), popover: { title: "Alert Settings", description: "Configure email alerts for critical findings, agent offline, config drift, and licence expiry.", side: "left", align: "start" } },
              { element: sel("drawer-webhooks"), popover: { title: "Webhook Settings", description: "Set up a webhook URL to push events to your PSA, RMM, or ticketing system.", side: "top", align: "center" } },
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
        { element: sel("assessment-scheduler"), popover: { title: "Assessment Scheduler", description: "Schedule recurring assessments per customer: 30, 60, or 90 day cycles. Get notified when assessments are overdue.", side: "top", align: "center" } },
        { element: sel("drawer-scheduled-reports"), popover: { title: "Scheduled Reports", description: "Automatically generate and send reports on a weekly, monthly, or quarterly basis to specified recipients.", side: "top", align: "center" } },
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
        { element: sel("tenant-dashboard"), popover: { title: "Tenant Dashboard", description: "View all customers with their latest scores and assessment dates.", side: "right", align: "start" } },
        { element: sel("score-trend-chart"), popover: { title: "Score Trends", description: "Track score changes over time across your customer base.", side: "top", align: "center" } },
        { element: sel("licence-expiry"), popover: { title: "Licence Expiry", description: "Monitor Sophos licence expiry dates and get early warnings.", side: "top", align: "center" } },
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
    { element: sel("shortcuts-button"), popover: { title: "Keyboard Shortcuts", description: "Press <strong>?</strong> to see all keyboard shortcuts.", side: "top", align: "end" } },
    { popover: { title: "Key Shortcuts", description: "<strong>Ctrl+G</strong> — Generate all reports<br/><strong>Ctrl+S</strong> — Save reports<br/><strong>1-9</strong> — Switch between reports<br/><strong>Ctrl+D</strong> — Toggle management drawer<br/><strong>Ctrl+/</strong> — Open AI chat" } },
    { element: sel("score-simulator"), popover: { title: "Remediation Impact Simulator", description: "Select recommended remediation actions and see projected score, grade, and coverage improvements.", side: "top", align: "center" } },
    { element: sel("attack-surface"), popover: { title: "Attack Surface Map", description: "Visualise your network's attack surface based on firewall rules.", side: "top", align: "center" } },
    { element: sel("rule-optimiser"), popover: { title: "Rule Optimiser", description: "Find redundant, shadowed, and overlapping firewall rules.", side: "top", align: "center" } },
    { element: sel("remediation-playbooks"), popover: { title: "Remediation Playbooks", description: "Step-by-step guides to fix every finding on a Sophos XGS firewall.", side: "top", align: "center" } },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// Micro-tours — short contextual spotlights per analysis tab
// ---------------------------------------------------------------------------

const MICRO_TOUR_PREFIX = "firecomply-micro-tour-tab-";

function hasMicroTourRun(tab: string): boolean {
  try {
    return localStorage.getItem(MICRO_TOUR_PREFIX + tab) === "1";
  } catch {
    return false;
  }
}

function markMicroTourRun(tab: string): void {
  try {
    localStorage.setItem(MICRO_TOUR_PREFIX + tab, "1");
  } catch {
    /* ignore */
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
        description: "Export your risk register as CSV, Excel, or interactive HTML for offline review.",
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
    { element: sel("health-check"), popover: { title: "Sophos SE Health Check", description: "A dedicated tool for Sophos Sales Engineers to run best-practice health checks on customer firewalls.", side: "bottom", align: "center" } },
    { element: sel("hc-upload"), popover: { title: "Upload Config", description: "Drop in the customer's entities.xml or HTML config viewer export. You can also request the customer uploads it for you via a secure link.", side: "bottom", align: "center" } },
    { element: sel("hc-upload-requests"), popover: { title: "Upload Requests", description: "View pending and completed upload requests from customers. Load uploaded configs directly from here.", side: "top", align: "center" } },
    { element: sel("hc-central"), popover: { title: "Sophos Central API", description: "Connect the customer's Sophos Central to discover firewalls, auto-detect licence tiers, and pull firmware data. Credentials stay in your session only.", side: "bottom", align: "center" } },
    { element: sel("hc-management"), popover: { title: "Management", description: "Open the management panel to update your display name, SE title, and profile settings.", side: "bottom", align: "end" } },
    { element: sel("hc-history"), popover: { title: "Saved Reports", description: "View and reopen previously saved health checks. Switch between your reports, team reports, and all teams.", side: "top", align: "center" } },
  ]);
  t.drive();
}

// ---------------------------------------------------------------------------
// Health Check Tour — Results & Export
// ---------------------------------------------------------------------------
export function startHealthCheckResultsTour(): void {
  const t = createTour([
    { element: sel("hc-customer-details"), popover: { title: "Customer Details", description: "Fill in the customer name, email, and who the report is prepared for. These fields are required before you can export or email the report.", side: "bottom", align: "center" } },
    { element: sel("hc-licence-toggle"), popover: { title: "Licence Tier", description: "Toggle between Standard and Xstream Protection. This determines which best practice checks apply. If Central is connected, the tier is auto-detected.", side: "bottom", align: "center" } },
    { element: sel("hc-bp-results"), popover: { title: "Best Practice Results", description: "Detailed pass/fail/warning results for every Sophos best practice check. You can add notes to individual findings and view remediation guides.", side: "top", align: "center" } },
    { element: sel("hc-export"), popover: { title: "Save & Export", description: "Save the health check, download as PDF + HTML, export findings as CSV, or email the report directly to the customer. Set follow-up reminders for 3 or 6 months.", side: "top", align: "center" } },
    { element: sel("hc-score-trend"), popover: { title: "Score Trend", description: "Track how this customer's health check score changes over time, matched by firewall serial number.", side: "top", align: "center" } },
    { element: sel("hc-team-dashboard"), popover: { title: "Team Dashboard", description: "Operational stats for your team — total checks, average scores, common findings, and recent activity.", side: "top", align: "center" } },
  ]);
  t.drive();
}
