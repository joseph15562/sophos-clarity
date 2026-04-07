/** Rich mock datasets for workspace UI (Mission Control, Insights, API, Updates, etc.). */

export interface SparklinePoint {
  day: string;
  value: number;
}

export interface ThreatActivityDay {
  date: string;
  blocked: number;
  ips: number;
  web: number;
}

export interface MissionAlertRow {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /** What the alert is (Central description / category). */
  summary: string;
  customer: string;
  /** Firewall hostname when known; otherwise a short fallback. */
  device: string;
  ts: string;
}

export interface TopRiskCustomer {
  name: string;
  alerts: number;
}

export interface FleetHealthSlice {
  name: "Online" | "Offline" | "Warning" | "Unknown";
  value: number;
  color: string;
}

export interface RecentDocCard {
  id: string;
  /** Resolved customer / org label (placeholders like "(This tenant)" mapped to org name when possible). */
  customer: string;
  /** Hostname(s) or technical report labels for the assessed firewall(s). */
  firewalls: string;
  date: string;
  pages: number;
}

export const MOCK_CUSTOMER_SPARKLINE: SparklinePoint[] = Array.from({ length: 90 }, (_, i) => ({
  day: `d${i}`,
  value: 38 + Math.floor(Math.sin(i / 11) * 4) + (i > 70 ? 1 : 0) + (i % 17 === 0 ? 1 : 0),
}));

export const MOCK_DEVICE_SPARKLINE: SparklinePoint[] = Array.from({ length: 90 }, (_, i) => ({
  day: `d${i}`,
  value: 1180 + i * 1.2 + Math.floor(Math.sin(i / 8) * 15),
}));

export const MOCK_ALERT_SPARKLINE: SparklinePoint[] = Array.from({ length: 90 }, (_, i) => ({
  day: `d${i}`,
  value: Math.max(0, 8 + Math.floor(Math.sin(i / 5) * 6) + (i % 23 < 3 ? 4 : 0)),
}));

export const MOCK_THREAT_ACTIVITY: ThreatActivityDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return {
    date: d.toISOString().slice(5, 10),
    blocked: 1200 + i * 40 + (i % 7) * 80,
    ips: 400 + i * 12 + (i % 5) * 60,
    web: 2200 + i * 55 + (i % 4) * 100,
  };
});

export const MOCK_MISSION_ALERTS: MissionAlertRow[] = [
  {
    id: "1",
    severity: "CRITICAL",
    summary: "Active threat blocked — malware signature match on WAN",
    customer: "Westfield NHS Foundation",
    device: "fw-lon-dc-01",
    ts: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: "2",
    severity: "HIGH",
    summary: "IPS: suspicious outbound connection to known C2 range",
    customer: "Northern Retail Group",
    device: "xgs-manchester-4500",
    ts: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: "3",
    severity: "HIGH",
    summary: "HA pair — secondary node missed heartbeat (failover risk)",
    customer: "Borough of Swindon Council",
    device: "ha-pair-primary",
    ts: new Date(Date.now() - 52 * 60_000).toISOString(),
  },
  {
    id: "4",
    severity: "MEDIUM",
    summary: "Web filter: user hit blocked category (high-risk)",
    customer: "Pennine Building Society",
    device: "fw-leeds-br",
    ts: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: "5",
    severity: "LOW",
    summary: "VPN tunnel rekey completed (informational)",
    customer: "Cheltenham Academy Trust",
    device: "fw-campus-edge",
    ts: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    id: "6",
    severity: "MEDIUM",
    summary: "SSL certificate on WAN service expires in 14 days",
    customer: "Hartley & Webb Solicitors",
    device: "fw-chancery-01",
    ts: new Date(Date.now() - 8 * 3_600_000).toISOString(),
  },
];

export const MOCK_TOP_RISK_CUSTOMERS: TopRiskCustomer[] = [
  { name: "Swindon Council", alerts: 48 },
  { name: "Northern Retail", alerts: 36 },
  { name: "Westfield NHS", alerts: 31 },
  { name: "Hartley & Webb", alerts: 22 },
  { name: "Vertex Partners", alerts: 14 },
];

export const MOCK_FLEET_HEALTH: FleetHealthSlice[] = [
  { name: "Online", value: 1188, color: "#22c55e" },
  { name: "Warning", value: 62, color: "#f59e0b" },
  { name: "Offline", value: 28, color: "#ef4444" },
  { name: "Unknown", value: 6, color: "#64748b" },
];

export const MOCK_RECENT_DOCS: RecentDocCard[] = [
  {
    id: "d1",
    customer: "Pennine Building Society",
    firewalls: "fw-leeds-br, fw-dr-02",
    date: "2026-04-01",
    pages: 42,
  },
  {
    id: "d2",
    customer: "Cheltenham Academy Trust",
    firewalls: "fw-campus-edge",
    date: "2026-03-31",
    pages: 38,
  },
  {
    id: "d3",
    customer: "Vertex Partners",
    firewalls: "3 firewalls",
    date: "2026-03-30",
    pages: 56,
  },
  {
    id: "d4",
    customer: "Westfield NHS Foundation",
    firewalls: "fw-lon-dc-01",
    date: "2026-03-29",
    pages: 51,
  },
  {
    id: "d5",
    customer: "Northern Retail Group",
    firewalls: "xgs-manchester-4500",
    date: "2026-03-28",
    pages: 44,
  },
];

/** Insights — threat blocked per day (30d) */
export const MOCK_INSIGHTS_THREAT_DAILY = MOCK_THREAT_ACTIVITY.map((d) => ({
  date: d.date,
  total: d.blocked + d.ips + d.web,
}));

export const MOCK_THREAT_CATEGORIES = [
  { name: "Malware", value: 4200 },
  { name: "Phishing", value: 3100 },
  { name: "IPS", value: 2800 },
  { name: "Web", value: 5100 },
];

export const MOCK_TOP_THREAT_TYPES = [
  { name: "TLS anomaly", pct: 92 },
  { name: "Malicious DNS", pct: 78 },
  { name: "C2 beaconing", pct: 64 },
  { name: "Exploit kit", pct: 41 },
  { name: "Spam relay", pct: 33 },
];

export interface ComplianceSeriesPoint {
  month: string;
  gdpr: number;
  hipaa: number;
  nist: number;
  pci: number;
}

export const MOCK_COMPLIANCE_SERIES: ComplianceSeriesPoint[] = [
  { month: "Nov", gdpr: 72, hipaa: 68, nist: 74, pci: 70 },
  { month: "Dec", gdpr: 74, hipaa: 71, nist: 76, pci: 72 },
  { month: "Jan", gdpr: 76, hipaa: 73, nist: 78, pci: 75 },
  { month: "Feb", gdpr: 78, hipaa: 75, nist: 80, pci: 77 },
  { month: "Mar", gdpr: 80, hipaa: 78, nist: 82, pci: 79 },
  { month: "Apr", gdpr: 82, hipaa: 80, nist: 84, pci: 81 },
];

/** GitHub-style heatmap: week rows, day columns — values 0–4 activity level (deterministic) */
export interface ScatterCustomer {
  id: string;
  name: string;
  devices: number;
  riskScore: number;
  alerts: number;
  environment: string;
  topFinding: string;
}

export const MOCK_SCATTER_CUSTOMERS: ScatterCustomer[] = [
  {
    id: "c1",
    name: "Swindon Council",
    devices: 12,
    riskScore: 44,
    alerts: 22,
    environment: "Government",
    topFinding: "Exposed management",
  },
  {
    id: "c2",
    name: "Pennine BS",
    devices: 6,
    riskScore: 91,
    alerts: 2,
    environment: "Financial",
    topFinding: "None critical",
  },
  {
    id: "c3",
    name: "Bright Academy",
    devices: 3,
    riskScore: 72,
    alerts: 5,
    environment: "Education",
    topFinding: "Web policy gaps",
  },
  {
    id: "c4",
    name: "CityHealth NHS",
    devices: 14,
    riskScore: 58,
    alerts: 12,
    environment: "Healthcare",
    topFinding: "VPN hardening",
  },
  {
    id: "c5",
    name: "Northern Retail",
    devices: 14,
    riskScore: 56,
    alerts: 18,
    environment: "Retail",
    topFinding: "IPS bypass risk",
  },
  {
    id: "c6",
    name: "Vertex Partners",
    devices: 8,
    riskScore: 85,
    alerts: 4,
    environment: "Professional",
    topFinding: "Logging gaps",
  },
  {
    id: "c7",
    name: "Hartley & Webb",
    devices: 2,
    riskScore: 73,
    alerts: 6,
    environment: "Legal",
    topFinding: "Email filter",
  },
];

export interface RecommendationCard {
  id: string;
  priority: "P1" | "P2" | "P3";
  customer: string;
  text: string;
  effort: "Low" | "Med" | "High";
}

export const MOCK_RECOMMENDATIONS: RecommendationCard[] = [
  {
    id: "r1",
    priority: "P1",
    customer: "Swindon Council",
    text: "Patch XGS HA pair — firmware two MR behind advisory SFOS-2026-014.",
    effort: "Med",
  },
  {
    id: "r2",
    priority: "P1",
    customer: "Northern Retail",
    text: "Enable synchronized security heartbeat on 6 branch firewalls reporting stale.",
    effort: "Low",
  },
  {
    id: "r3",
    priority: "P2",
    customer: "Westfield NHS",
    text: "Tighten VPN portal MFA alignment with DSPT control 4.2.1 evidence pack.",
    effort: "High",
  },
  {
    id: "r4",
    priority: "P2",
    customer: "Hartley & Webb",
    text: "Re-run full assessment — last report older than 30 days.",
    effort: "Low",
  },
  {
    id: "r5",
    priority: "P3",
    customer: "Cheltenham Academy",
    text: "Optional: enable TLS 1.3-only profile on student VLAN ruleset.",
    effort: "Med",
  },
];

/** API hub mocks */
export const MOCK_API_CALLS_HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h.toString().padStart(2, "0")}:00`,
  calls: 80 + Math.floor(Math.sin(h / 3) * 40) + (h > 8 && h < 18 ? 60 : 20),
}));

export const MOCK_API_BY_ENDPOINT = [
  { path: "/api/assessments", calls: 842 },
  { path: "/api/firewalls", calls: 620 },
  { path: "/api/reports", calls: 410 },
  { path: "/api/customers", calls: 380 },
  { path: "/api/parse-config", calls: 195 },
];

export interface MockApiKeyRow {
  id: string;
  name: string;
  masked: string;
  created: string;
  lastUsed: string;
  permissions: string;
}

export const MOCK_API_KEYS: MockApiKeyRow[] = [
  {
    id: "k1",
    name: "RMM nightly sync",
    masked: "sk-fc…x7q2",
    created: "2026-01-12",
    lastUsed: "2026-04-02",
    permissions: "read:firewalls, read:assessments",
  },
  {
    id: "k2",
    name: "ConnectWise script",
    masked: "sk-fc…9m1p",
    created: "2025-11-03",
    lastUsed: "2026-03-28",
    permissions: "read:reports",
  },
];

export interface MockApiRequestRow {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  latencyMs: number;
  ts: string;
}

export const MOCK_API_RECENT_REQUESTS: MockApiRequestRow[] = [
  {
    id: "q1",
    endpoint: "/api/assessments",
    method: "GET",
    status: 200,
    latencyMs: 118,
    ts: "14:22:01",
  },
  {
    id: "q2",
    endpoint: "/api/firewalls",
    method: "GET",
    status: 200,
    latencyMs: 92,
    ts: "14:21:58",
  },
  {
    id: "q3",
    endpoint: "/api/reports/generate",
    method: "POST",
    status: 202,
    latencyMs: 240,
    ts: "14:21:44",
  },
  {
    id: "q4",
    endpoint: "/api/customers",
    method: "GET",
    status: 200,
    latencyMs: 76,
    ts: "14:21:12",
  },
  {
    id: "q5",
    endpoint: "/api/parse-config",
    method: "POST",
    status: 200,
    latencyMs: 1820,
    ts: "14:20:55",
  },
];

/** Updates / threat feed */
export interface ThreatIntelCard {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  cve?: string;
  title: string;
  products: string;
  description: string;
  published: string;
  category: "Firewall" | "Endpoint" | "Network" | "Critical";
  /** When set (e.g. regulatory digest rows), "View advisory" opens this URL. */
  link?: string;
}

export const MOCK_THREAT_INTEL: ThreatIntelCard[] = [
  {
    id: "t1",
    severity: "CRITICAL",
    cve: "CVE-2026-18442",
    title: "Sophos XGS — pre-auth management interface issue",
    products: "SFOS 20.x",
    description: "Vendor advisory recommends MR patch within 72h for internet-exposed management.",
    published: "2026-03-30",
    category: "Firewall",
  },
  {
    id: "t2",
    severity: "HIGH",
    title: "Sophos Central — agent update for TLS 1.3 default",
    products: "Endpoint / Server",
    description: "Rollout note: confirm protected machines pick up the new agent build this week.",
    published: "2026-03-28",
    category: "Endpoint",
  },
  {
    id: "t3",
    severity: "MEDIUM",
    title: "SFOS hotfix — VPN and SD-WAN stability",
    products: "XGS / virtual",
    description: "Maintenance release addresses edge-case tunnel drops under heavy UDP load.",
    published: "2026-03-25",
    category: "Network",
  },
];

export interface FirmwareRow {
  model: string;
  current: string;
  latest: string;
  released: string;
  /** Demo sample rows use vendor-style labels; Central-backed rows use "Synced inventory". */
  status: "Up to Date" | "Update Available" | "Critical Update" | "Synced inventory";
  notes: string;
}

export const MOCK_FIRMWARE_TABLE: FirmwareRow[] = [
  {
    model: "XGS 4500",
    current: "20.0.1 MR-1",
    latest: "20.0.2 MR-2",
    released: "2026-03-18",
    status: "Update Available",
    notes: "VPN hardening",
  },
  {
    model: "XGS 3300",
    current: "20.0.2 MR-2",
    latest: "20.0.2 MR-2",
    released: "2026-03-18",
    status: "Up to Date",
    notes: "—",
  },
  {
    model: "XGS 2100",
    current: "19.5.3",
    latest: "20.0.2 MR-2",
    released: "2026-03-18",
    status: "Critical Update",
    notes: "Security fixes",
  },
];

/** Drift history timeline markers */
export interface DriftHistoryMarker {
  id: string;
  label: string;
  date: string;
  customer: string;
}

export const MOCK_DRIFT_HISTORY: DriftHistoryMarker[] = [
  { id: "h1", label: "Rules delta", date: "2026-04-01", customer: "Vertex Partners" },
  { id: "h2", label: "NAT change", date: "2026-03-28", customer: "Vertex Partners" },
  { id: "h3", label: "Policy sync", date: "2026-03-22", customer: "Pennine BS" },
  { id: "h4", label: "Full diff", date: "2026-03-15", customer: "Northern Retail" },
];
