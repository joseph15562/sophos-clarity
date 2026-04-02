/**
 * Canned Sophos Central API responses for the demo workspace.
 *
 * When the sophos-central Edge Function detects orgId === DEMO_ORG_ID it returns
 * these instead of calling the live Sophos API.
 */

export const DEMO_ORG_ID = Deno.env.get("DEMO_ORG_ID") ??
  "00000000-0000-0000-0000-000000000000";

function rollingLastSynced(): string {
  return new Date(Date.now() - 5 * 60_000).toISOString();
}

// ── Tenant IDs (stable UUIDs used across seed + canned responses) ──

const T = {
  cheltenham: "d0000001-0000-0000-0000-000000000001",
  westfield: "d0000001-0000-0000-0000-000000000002",
  swindon: "d0000001-0000-0000-0000-000000000003",
  pennine: "d0000001-0000-0000-0000-000000000004",
  rheinland: "d0000001-0000-0000-0000-000000000005",
  clinique: "d0000001-0000-0000-0000-000000000006",
  nordic: "d0000001-0000-0000-0000-000000000007",
  lakewood: "d0000001-0000-0000-0000-000000000008",
  summit: "d0000001-0000-0000-0000-000000000009",
  atlas: "d0000001-0000-0000-0000-00000000000a",
} as const;

export { T as DEMO_TENANT_IDS };

// ── Status ──

export function demoCentralStatus() {
  return {
    connected: true,
    partner_id: "f1000000-0000-0000-0000-000000000001",
    partner_type: "partner",
    api_hosts: {
      global: "https://api-eu01.central.sophos.com",
      dataRegion: "https://api-eu01.central.sophos.com",
    },
    connected_at: "2025-09-15T09:00:00Z",
    last_synced_at: rollingLastSynced(),
  };
}

// ── Tenants ──

interface DemoTenant {
  id: string;
  name: string;
  dataRegion: string;
  apiHost: string;
  billingType: string;
}

export function demoCentralTenants(): { items: DemoTenant[] } {
  return {
    items: [
      {
        id: T.cheltenham,
        name: "Cheltenham Academy Trust",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.westfield,
        name: "Westfield NHS Foundation",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.swindon,
        name: "Borough of Swindon Council",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.pennine,
        name: "Pennine Building Society",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.rheinland,
        name: "Rheinland Logistik GmbH",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.clinique,
        name: "Clinique Saint-Martin",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.nordic,
        name: "Nordic Insurance Group",
        dataRegion: "eu01",
        apiHost: "https://api-eu01.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.lakewood,
        name: "Lakewood Medical Center",
        dataRegion: "us03",
        apiHost: "https://api-us03.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.summit,
        name: "Summit Ridge Credit Union",
        dataRegion: "us03",
        apiHost: "https://api-us03.central.sophos.com",
        billingType: "usage",
      },
      {
        id: T.atlas,
        name: "Atlas Global Industries",
        dataRegion: "us03",
        apiHost: "https://api-us03.central.sophos.com",
        billingType: "usage",
      },
    ],
  };
}

// ── Firewalls ──

let _fwCounter = 0;
function fwId(): string {
  _fwCounter++;
  return `f0000000-0000-0000-0000-${String(_fwCounter).padStart(12, "0")}`;
}

interface DemoFirewall {
  id: string;
  serialNumber: string;
  hostname: string;
  name: string;
  firmwareVersion: string;
  model: string;
  status: { connected: boolean; managing: string; suspended: boolean };
  cluster?: {
    id: string;
    status: "primary" | "auxiliary";
    mode: string;
  };
  group?: null;
  externalIpv4Addresses: string[];
  geoLocation?: { latitude: number; longitude: number };
  _tenantId: string;
}

function fw(
  tenantId: string,
  serial: string,
  hostname: string,
  name: string,
  model: string,
  firmware: string,
  ip: string,
  geo?: { latitude: number; longitude: number },
  cluster?: { id: string; status: "primary" | "auxiliary"; mode: string },
): DemoFirewall {
  return {
    id: fwId(),
    serialNumber: serial,
    hostname,
    name,
    firmwareVersion: firmware,
    model,
    status: { connected: true, managing: "partner", suspended: false },
    cluster: cluster ?? undefined,
    group: null,
    externalIpv4Addresses: [ip],
    geoLocation: geo,
    _tenantId: tenantId,
  };
}

function haPair(
  tenantId: string,
  serialPrimary: string,
  serialAux: string,
  hostname: string,
  namePrimary: string,
  nameAux: string,
  model: string,
  firmware: string,
  ipPrimary: string,
  ipAux: string,
  geo?: { latitude: number; longitude: number },
): [DemoFirewall, DemoFirewall] {
  const clusterId = crypto.randomUUID();
  return [
    fw(
      tenantId,
      serialPrimary,
      hostname,
      namePrimary,
      model,
      firmware,
      ipPrimary,
      geo,
      {
        id: clusterId,
        status: "primary",
        mode: "active-passive",
      },
    ),
    fw(tenantId, serialAux, hostname, nameAux, model, firmware, ipAux, geo, {
      id: clusterId,
      status: "auxiliary",
      mode: "active-passive",
    }),
  ];
}

const UK_GEO = { latitude: 51.898, longitude: -2.081 };
const DE_GEO = { latitude: 50.938, longitude: 6.960 };
const FR_GEO = { latitude: 48.857, longitude: 2.352 };
const SE_GEO = { latitude: 59.329, longitude: 18.069 };
const US_GEO = { latitude: 41.882, longitude: -87.628 };
const JP_GEO = { latitude: 35.682, longitude: 139.692 };
const AU_GEO = { latitude: -33.868, longitude: 151.209 };

function buildDemoFirewalls(): DemoFirewall[] {
  const all: DemoFirewall[] = [];

  // Cheltenham Academy Trust (4 FWs, UK): 1 HA pair + 2 standalone
  all.push(
    ...haPair(
      T.cheltenham,
      "C1CH00000001",
      "C1CH00000002",
      "fw-cheltenham-hq.local",
      "cheltenham-hq-primary",
      "cheltenham-hq-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.10",
      "203.0.113.11",
      UK_GEO,
    ),
    fw(
      T.cheltenham,
      "C1CH00000003",
      "fw-cheltenham-west.local",
      "cheltenham-west-campus",
      "XGS 87",
      "SFOS 20.0.2 MR-3",
      "203.0.113.12",
      UK_GEO,
    ),
    fw(
      T.cheltenham,
      "C1CH00000004",
      "fw-cheltenham-east.local",
      "cheltenham-east-campus",
      "XGS 87",
      "SFOS 21.0.0 GA",
      "203.0.113.13",
      UK_GEO,
    ),
  );

  // Westfield NHS Foundation (8 FWs, UK): 2 HA pairs + 4 standalone
  all.push(
    ...haPair(
      T.westfield,
      "C1WF00000001",
      "C1WF00000002",
      "fw-westfield-main.local",
      "westfield-main-primary",
      "westfield-main-auxiliary",
      "XGS 4500",
      "SFOS 20.0.2 MR-3",
      "203.0.113.20",
      "203.0.113.21",
      UK_GEO,
    ),
    ...haPair(
      T.westfield,
      "C1WF00000003",
      "C1WF00000004",
      "fw-westfield-satellite.local",
      "westfield-satellite-primary",
      "westfield-satellite-auxiliary",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.22",
      "203.0.113.23",
      UK_GEO,
    ),
    fw(
      T.westfield,
      "C1WF00000005",
      "fw-westfield-gp1.local",
      "westfield-gp-surgery-north",
      "XGS 87",
      "SFOS 20.0.2 MR-3",
      "203.0.113.24",
      UK_GEO,
    ),
    fw(
      T.westfield,
      "C1WF00000006",
      "fw-westfield-gp2.local",
      "westfield-gp-surgery-south",
      "XGS 87",
      "SFOS 20.0.2 MR-3",
      "203.0.113.25",
      UK_GEO,
    ),
    fw(
      T.westfield,
      "C1WF00000007",
      "fw-westfield-gp3.local",
      "westfield-gp-surgery-east",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.26",
      UK_GEO,
    ),
    fw(
      T.westfield,
      "C1WF00000008",
      "fw-westfield-gp4.local",
      "westfield-gp-surgery-west",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.27",
      UK_GEO,
    ),
  );

  // Borough of Swindon Council (6 FWs, UK): 1 HA pair + 4 standalone
  all.push(
    ...haPair(
      T.swindon,
      "C1SW00000001",
      "C1SW00000002",
      "fw-swindon-civic.local",
      "swindon-civic-primary",
      "swindon-civic-auxiliary",
      "XGS 4500",
      "SFOS 20.0.2 MR-3",
      "203.0.113.30",
      "203.0.113.31",
      UK_GEO,
    ),
    fw(
      T.swindon,
      "C1SW00000003",
      "fw-swindon-library.local",
      "swindon-library",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.32",
      UK_GEO,
    ),
    fw(
      T.swindon,
      "C1SW00000004",
      "fw-swindon-depot.local",
      "swindon-depot",
      "XGS 136",
      "SFOS 20.0.2 MR-3",
      "203.0.113.33",
      UK_GEO,
    ),
    fw(
      T.swindon,
      "C1SW00000005",
      "fw-swindon-leisure.local",
      "swindon-leisure-centre",
      "XGS 2300",
      "SFOS 21.0.0 GA",
      "203.0.113.34",
      UK_GEO,
    ),
    fw(
      T.swindon,
      "C1SW00000006",
      "fw-swindon-archive.local",
      "swindon-archive-hall",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.35",
      UK_GEO,
    ),
  );

  // Pennine Building Society (3 FWs, UK): 1 HA pair + 1 standalone
  all.push(
    ...haPair(
      T.pennine,
      "C1PN00000001",
      "C1PN00000002",
      "fw-pennine-hq.local",
      "pennine-hq-primary",
      "pennine-hq-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.40",
      "203.0.113.41",
      UK_GEO,
    ),
    fw(
      T.pennine,
      "C1PN00000003",
      "fw-pennine-branch.local",
      "pennine-branch-sheffield",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.42",
      UK_GEO,
    ),
  );

  // Rheinland Logistik GmbH (5 FWs, DE): 1 HA pair + 3 standalone
  all.push(
    ...haPair(
      T.rheinland,
      "C1RL00000001",
      "C1RL00000002",
      "fw-rheinland-dc.local",
      "rheinland-cologne-dc-primary",
      "rheinland-cologne-dc-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.50",
      "203.0.113.51",
      DE_GEO,
    ),
    fw(
      T.rheinland,
      "C1RL00000003",
      "fw-rheinland-dort.local",
      "rheinland-dortmund-warehouse",
      "XGS 136",
      "SFOS 20.0.2 MR-3",
      "203.0.113.52",
      DE_GEO,
    ),
    fw(
      T.rheinland,
      "C1RL00000004",
      "fw-rheinland-ffm.local",
      "rheinland-frankfurt-warehouse",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.53",
      DE_GEO,
    ),
    fw(
      T.rheinland,
      "C1RL00000005",
      "fw-rheinland-muc.local",
      "rheinland-munich-warehouse",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.54",
      DE_GEO,
    ),
  );

  // Clinique Saint-Martin (2 FWs, FR): 1 HA pair only
  all.push(
    ...haPair(
      T.clinique,
      "C1CQ00000001",
      "C1CQ00000002",
      "fw-clinique-main.local",
      "clinique-main-primary",
      "clinique-main-auxiliary",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.60",
      "203.0.113.61",
      FR_GEO,
    ),
  );

  // Nordic Insurance Group (4 FWs, SE): 1 HA pair + 2 standalone
  all.push(
    ...haPair(
      T.nordic,
      "C1NI00000001",
      "C1NI00000002",
      "fw-nordic-hq.local",
      "nordic-stockholm-hq-primary",
      "nordic-stockholm-hq-auxiliary",
      "XGS 4500",
      "SFOS 20.0.2 MR-3",
      "203.0.113.70",
      "203.0.113.71",
      SE_GEO,
    ),
    fw(
      T.nordic,
      "C1NI00000003",
      "fw-nordic-gbg.local",
      "nordic-gothenburg-office",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.72",
      SE_GEO,
    ),
    fw(
      T.nordic,
      "C1NI00000004",
      "fw-nordic-mmo.local",
      "nordic-malmo-office",
      "XGS 2300",
      "SFOS 21.0.0 GA",
      "203.0.113.73",
      SE_GEO,
    ),
  );

  // Lakewood Medical Center (6 FWs, US): 1 HA pair + 4 standalone
  all.push(
    ...haPair(
      T.lakewood,
      "C1LW00000001",
      "C1LW00000002",
      "fw-lakewood-main.local",
      "lakewood-main-campus-primary",
      "lakewood-main-campus-auxiliary",
      "XGS 4500",
      "SFOS 20.0.2 MR-3",
      "203.0.113.80",
      "203.0.113.81",
      US_GEO,
    ),
    fw(
      T.lakewood,
      "C1LW00000003",
      "fw-lakewood-op1.local",
      "lakewood-outpatient-north",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.82",
      US_GEO,
    ),
    fw(
      T.lakewood,
      "C1LW00000004",
      "fw-lakewood-op2.local",
      "lakewood-outpatient-south",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.83",
      US_GEO,
    ),
    fw(
      T.lakewood,
      "C1LW00000005",
      "fw-lakewood-op3.local",
      "lakewood-outpatient-east",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.84",
      US_GEO,
    ),
    fw(
      T.lakewood,
      "C1LW00000006",
      "fw-lakewood-op4.local",
      "lakewood-outpatient-west",
      "XGS 136",
      "SFOS 21.0.0 GA",
      "203.0.113.85",
      US_GEO,
    ),
  );

  // Summit Ridge Credit Union (3 FWs, US): 1 HA pair + 1 standalone
  all.push(
    ...haPair(
      T.summit,
      "C1SR00000001",
      "C1SR00000002",
      "fw-summit-hq.local",
      "summit-denver-hq-primary",
      "summit-denver-hq-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.90",
      "203.0.113.91",
      US_GEO,
    ),
    fw(
      T.summit,
      "C1SR00000003",
      "fw-summit-cos.local",
      "summit-colorado-springs-branch",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.92",
      US_GEO,
    ),
  );

  // Atlas Global Industries (10 FWs, multi-country)
  // US (Chicago HQ): 1 HA pair + 1 standalone
  all.push(
    ...haPair(
      T.atlas,
      "C1AG00000001",
      "C1AG00000002",
      "fw-atlas-chicago-hq.local",
      "atlas-chicago-hq-primary",
      "atlas-chicago-hq-auxiliary",
      "XGS 4500",
      "SFOS 20.0.2 MR-3",
      "203.0.113.100",
      "203.0.113.101",
      US_GEO,
    ),
    fw(
      T.atlas,
      "C1AG00000003",
      "fw-atlas-chicago-lab.local",
      "atlas-chicago-lab",
      "XGS 2300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.102",
      US_GEO,
    ),
  );
  // UK (London office): 1 HA pair
  all.push(
    ...haPair(
      T.atlas,
      "C1AG00000004",
      "C1AG00000005",
      "fw-atlas-london.local",
      "atlas-london-primary",
      "atlas-london-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.103",
      "203.0.113.104",
      UK_GEO,
    ),
  );
  // DE (Berlin factory): 1 standalone
  all.push(
    fw(
      T.atlas,
      "C1AG00000006",
      "fw-atlas-berlin.local",
      "atlas-berlin-factory",
      "XGS 2300",
      "SFOS 21.0.0 GA",
      "203.0.113.105",
      DE_GEO,
    ),
  );
  // JP (Tokyo office): 1 standalone
  all.push(
    fw(
      T.atlas,
      "C1AG00000007",
      "fw-atlas-tokyo.local",
      "atlas-tokyo-office",
      "XGS 2300",
      "SFOS 21.0.0 GA",
      "203.0.113.106",
      JP_GEO,
    ),
  );
  // AU (Sydney warehouse): 1 HA pair
  all.push(
    ...haPair(
      T.atlas,
      "C1AG00000008",
      "C1AG00000009",
      "fw-atlas-sydney.local",
      "atlas-sydney-warehouse-primary",
      "atlas-sydney-warehouse-auxiliary",
      "XGS 3300",
      "SFOS 20.0.2 MR-3",
      "203.0.113.107",
      "203.0.113.108",
      AU_GEO,
    ),
  );

  return all;
}

let _cachedFirewalls: DemoFirewall[] | null = null;

export function getDemoFirewalls(): DemoFirewall[] {
  if (!_cachedFirewalls) _cachedFirewalls = buildDemoFirewalls();
  return _cachedFirewalls;
}

export function demoCentralFirewalls(tenantId: string) {
  const items = getDemoFirewalls()
    .filter((f) => f._tenantId === tenantId)
    .map(({ _tenantId, ...rest }) => rest);
  return { items };
}

// ── Alerts ──

export function demoCentralAlerts(_tenantId: string) {
  const now = new Date();
  return {
    items: [
      {
        id: "alert-demo-001",
        description: "Malware detected: Troj/Agent-XYZ on endpoint WIN-DC01",
        severity: "high",
        category: "malware",
        raisedAt: new Date(now.getTime() - 2 * 3_600_000).toISOString(),
        managedAgent: { type: "computer", id: "endpoint-001" },
      },
      {
        id: "alert-demo-002",
        description: "IPS: Possible SQL injection attempt blocked",
        severity: "medium",
        category: "ips",
        raisedAt: new Date(now.getTime() - 8 * 3_600_000).toISOString(),
        managedAgent: { type: "firewall", id: "fw-001" },
      },
      {
        id: "alert-demo-003",
        description: "Policy violation: Unauthorized USB device connected",
        severity: "low",
        category: "policy",
        raisedAt: new Date(now.getTime() - 24 * 3_600_000).toISOString(),
        managedAgent: { type: "computer", id: "endpoint-005" },
      },
      {
        id: "alert-demo-004",
        description: "Heartbeat lost for managed endpoint LAPTOP-042",
        severity: "info",
        category: "general",
        raisedAt: new Date(now.getTime() - 36 * 3_600_000).toISOString(),
        managedAgent: { type: "computer", id: "endpoint-042" },
      },
      {
        id: "alert-demo-005",
        description:
          "Advanced threat: C2 callback blocked by Xstream deep packet inspection",
        severity: "high",
        category: "malware",
        raisedAt: new Date(now.getTime() - 48 * 3_600_000).toISOString(),
        managedAgent: { type: "firewall", id: "fw-003" },
      },
    ],
  };
}

// ── Licenses ──

export function demoCentralLicenses(_tenantId: string) {
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 86_400_000).toISOString();
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const in90 = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const in365 = new Date(now.getTime() + 365 * 86_400_000).toISOString();

  return {
    items: [
      {
        id: "lic-001",
        type: "Xstream Protection",
        licensedCount: 25,
        usedCount: 18,
        expiresAt: in365,
        status: "active",
        billingType: "term",
      },
      {
        id: "lic-002",
        type: "Enhanced Support",
        licensedCount: 25,
        usedCount: 18,
        expiresAt: in90,
        status: "active",
        billingType: "term",
      },
      {
        id: "lic-003",
        type: "Standard Protection",
        licensedCount: 10,
        usedCount: 8,
        expiresAt: in60,
        status: "active",
        billingType: "term",
      },
      {
        id: "lic-004",
        type: "Network Protection",
        licensedCount: 5,
        usedCount: 3,
        expiresAt: in30,
        status: "expiring",
        billingType: "trial",
      },
    ],
  };
}

// ── Firewall Licenses ──

export function demoCentralFirewallLicenses(_tenantId?: string) {
  const now = new Date();
  const in180 = new Date(now.getTime() + 180 * 86_400_000).toISOString();
  const in45 = new Date(now.getTime() + 45 * 86_400_000).toISOString();
  const in365 = new Date(now.getTime() + 365 * 86_400_000).toISOString();

  return {
    items: [
      {
        serialNumber: "C1CH00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1CH00000002",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1CH00000003",
        subscriptionType: "Standard Protection",
        expiresAt: in180,
        status: "active",
      },
      {
        serialNumber: "C1WF00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1WF00000005",
        subscriptionType: "Enhanced Support",
        expiresAt: in45,
        status: "expiring",
      },
      {
        serialNumber: "C1SW00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1PN00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1RL00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in180,
        status: "active",
      },
      {
        serialNumber: "C1NI00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1LW00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1SR00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in180,
        status: "active",
      },
      {
        serialNumber: "C1AG00000001",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1AG00000004",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in365,
        status: "active",
      },
      {
        serialNumber: "C1AG00000008",
        subscriptionType: "Xstream Protection Bundle",
        expiresAt: in180,
        status: "active",
      },
    ],
  };
}

// ── MDR Threat Feed ──

export function demoCentralMdrThreatFeed() {
  return {
    items: [
      {
        id: "ioc-001",
        type: "ipv4-addr",
        value: "198.51.100.42",
        description: "Known C2 server",
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
      {
        id: "ioc-002",
        type: "domain-name",
        value: "malware-drop.example.net",
        description: "Malware distribution domain",
        createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      },
    ],
  };
}
