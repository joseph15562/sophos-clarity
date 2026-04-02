#!/usr/bin/env -S deno run --allow-env --allow-net
/**
 * Seed (or re-seed) the demo workspace for public demo mode.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DEMO_AUTH_EMAIL=… DEMO_AUTH_PASSWORD=… \
 *     deno run --allow-env --allow-net scripts/seed-demo-workspace.ts
 *
 * The script is idempotent — re-running updates/upserts all rows.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Env ──

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DEMO_EMAIL = requireEnv("DEMO_AUTH_EMAIL");
const DEMO_PASSWORD = requireEnv("DEMO_AUTH_PASSWORD");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Stable IDs ──

const DEMO_ORG_ID = "a0de0000-de00-4000-a000-000000000001";
const DEMO_ORG_NAME = "Clarity MSP (Demo)";

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

interface CustomerDef {
  tenantId: string;
  name: string;
  country: string;
  environment: string;
  score: number;
  grade: string;
  dataRegion: string;
  apiHost: string;
}

const CUSTOMERS: CustomerDef[] = [
  {
    tenantId: T.cheltenham,
    name: "Cheltenham Academy Trust",
    country: "United Kingdom",
    environment: "Education",
    score: 87,
    grade: "A",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.westfield,
    name: "Westfield NHS Foundation",
    country: "United Kingdom",
    environment: "Healthcare",
    score: 62,
    grade: "C",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.swindon,
    name: "Borough of Swindon Council",
    country: "United Kingdom",
    environment: "Government",
    score: 44,
    grade: "D",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.pennine,
    name: "Pennine Building Society",
    country: "United Kingdom",
    environment: "Financial Services",
    score: 91,
    grade: "A",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.rheinland,
    name: "Rheinland Logistik GmbH",
    country: "Germany",
    environment: "Logistics & Transport",
    score: 58,
    grade: "C",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.clinique,
    name: "Clinique Saint-Martin",
    country: "France",
    environment: "Healthcare",
    score: 41,
    grade: "D",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.nordic,
    name: "Nordic Insurance Group",
    country: "Sweden",
    environment: "Financial Services",
    score: 78,
    grade: "B",
    dataRegion: "eu01",
    apiHost: "https://api-eu01.central.sophos.com",
  },
  {
    tenantId: T.lakewood,
    name: "Lakewood Medical Center",
    country: "United States",
    environment: "Healthcare",
    score: 73,
    grade: "B",
    dataRegion: "us03",
    apiHost: "https://api-us03.central.sophos.com",
  },
  {
    tenantId: T.summit,
    name: "Summit Ridge Credit Union",
    country: "United States",
    environment: "Financial Services",
    score: 89,
    grade: "A",
    dataRegion: "us03",
    apiHost: "https://api-us03.central.sophos.com",
  },
  {
    tenantId: T.atlas,
    name: "Atlas Global Industries",
    country: "United States",
    environment: "Manufacturing",
    score: 75,
    grade: "B",
    dataRegion: "us03",
    apiHost: "https://api-us03.central.sophos.com",
  },
];

// ── Firewall + Agent definitions ──

interface FwDef {
  tenantId: string;
  serial: string;
  hostname: string;
  agentName: string;
  model: string;
  firmware: string;
  ip: string;
  clusterPeerId?: string;
  clusterStatus?: "primary" | "auxiliary";
  country: string;
  environment: string;
  score: number;
  grade: string;
}

function ha(
  tenantId: string,
  s1: string,
  s2: string,
  hostname: string,
  n1: string,
  n2: string,
  model: string,
  firmware: string,
  ip1: string,
  ip2: string,
  country: string,
  env: string,
  score: number,
  grade: string,
): [FwDef, FwDef] {
  return [
    {
      tenantId,
      serial: s1,
      hostname,
      agentName: n1,
      model,
      firmware,
      ip: ip1,
      clusterPeerId: s2,
      clusterStatus: "primary",
      country,
      environment: env,
      score,
      grade,
    },
    {
      tenantId,
      serial: s2,
      hostname,
      agentName: n2,
      model,
      firmware,
      ip: ip2,
      clusterPeerId: s1,
      clusterStatus: "auxiliary",
      country,
      environment: env,
      score,
      grade,
    },
  ];
}

function solo(
  tenantId: string,
  serial: string,
  hostname: string,
  agentName: string,
  model: string,
  firmware: string,
  ip: string,
  country: string,
  env: string,
  score: number,
  grade: string,
): FwDef {
  return {
    tenantId,
    serial,
    hostname,
    agentName,
    model,
    firmware,
    ip,
    country,
    environment: env,
    score,
    grade,
  };
}

const ALL_FW: FwDef[] = [
  // Cheltenham (4, UK)
  ...ha(
    T.cheltenham,
    "C1CH00000001",
    "C1CH00000002",
    "fw-cheltenham-hq.local",
    "cheltenham-hq-primary",
    "cheltenham-hq-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.1.1.1",
    "10.1.1.2",
    "United Kingdom",
    "Education",
    87,
    "A",
  ),
  solo(
    T.cheltenham,
    "C1CH00000003",
    "fw-cheltenham-west.local",
    "cheltenham-west-campus",
    "XGS 87",
    "SFOS 20.0.2 MR-3",
    "10.1.2.1",
    "United Kingdom",
    "Education",
    85,
    "A",
  ),
  solo(
    T.cheltenham,
    "C1CH00000004",
    "fw-cheltenham-east.local",
    "cheltenham-east-campus",
    "XGS 87",
    "SFOS 21.0.0 GA",
    "10.1.3.1",
    "United Kingdom",
    "Education",
    88,
    "A",
  ),

  // Westfield (8, UK)
  ...ha(
    T.westfield,
    "C1WF00000001",
    "C1WF00000002",
    "fw-westfield-main.local",
    "westfield-main-primary",
    "westfield-main-auxiliary",
    "XGS 4500",
    "SFOS 20.0.2 MR-3",
    "10.2.1.1",
    "10.2.1.2",
    "United Kingdom",
    "Healthcare",
    62,
    "C",
  ),
  ...ha(
    T.westfield,
    "C1WF00000003",
    "C1WF00000004",
    "fw-westfield-satellite.local",
    "westfield-satellite-primary",
    "westfield-satellite-auxiliary",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.2.2.1",
    "10.2.2.2",
    "United Kingdom",
    "Healthcare",
    64,
    "C",
  ),
  solo(
    T.westfield,
    "C1WF00000005",
    "fw-westfield-gp1.local",
    "westfield-gp-surgery-north",
    "XGS 87",
    "SFOS 20.0.2 MR-3",
    "10.2.3.1",
    "United Kingdom",
    "Healthcare",
    60,
    "C",
  ),
  solo(
    T.westfield,
    "C1WF00000006",
    "fw-westfield-gp2.local",
    "westfield-gp-surgery-south",
    "XGS 87",
    "SFOS 20.0.2 MR-3",
    "10.2.3.2",
    "United Kingdom",
    "Healthcare",
    59,
    "C",
  ),
  solo(
    T.westfield,
    "C1WF00000007",
    "fw-westfield-gp3.local",
    "westfield-gp-surgery-east",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.2.3.3",
    "United Kingdom",
    "Healthcare",
    63,
    "C",
  ),
  solo(
    T.westfield,
    "C1WF00000008",
    "fw-westfield-gp4.local",
    "westfield-gp-surgery-west",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.2.3.4",
    "United Kingdom",
    "Healthcare",
    65,
    "C",
  ),

  // Swindon (6, UK)
  ...ha(
    T.swindon,
    "C1SW00000001",
    "C1SW00000002",
    "fw-swindon-civic.local",
    "swindon-civic-primary",
    "swindon-civic-auxiliary",
    "XGS 4500",
    "SFOS 20.0.2 MR-3",
    "10.3.1.1",
    "10.3.1.2",
    "United Kingdom",
    "Government",
    44,
    "D",
  ),
  solo(
    T.swindon,
    "C1SW00000003",
    "fw-swindon-library.local",
    "swindon-library",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.3.2.1",
    "United Kingdom",
    "Government",
    42,
    "D",
  ),
  solo(
    T.swindon,
    "C1SW00000004",
    "fw-swindon-depot.local",
    "swindon-depot",
    "XGS 136",
    "SFOS 20.0.2 MR-3",
    "10.3.3.1",
    "United Kingdom",
    "Government",
    46,
    "D",
  ),
  solo(
    T.swindon,
    "C1SW00000005",
    "fw-swindon-leisure.local",
    "swindon-leisure-centre",
    "XGS 2300",
    "SFOS 21.0.0 GA",
    "10.3.4.1",
    "United Kingdom",
    "Government",
    43,
    "D",
  ),
  solo(
    T.swindon,
    "C1SW00000006",
    "fw-swindon-archive.local",
    "swindon-archive-hall",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.3.5.1",
    "United Kingdom",
    "Government",
    45,
    "D",
  ),

  // Pennine (3, UK)
  ...ha(
    T.pennine,
    "C1PN00000001",
    "C1PN00000002",
    "fw-pennine-hq.local",
    "pennine-hq-primary",
    "pennine-hq-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.4.1.1",
    "10.4.1.2",
    "United Kingdom",
    "Financial Services",
    91,
    "A",
  ),
  solo(
    T.pennine,
    "C1PN00000003",
    "fw-pennine-branch.local",
    "pennine-branch-sheffield",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.4.2.1",
    "United Kingdom",
    "Financial Services",
    90,
    "A",
  ),

  // Rheinland (5, DE)
  ...ha(
    T.rheinland,
    "C1RL00000001",
    "C1RL00000002",
    "fw-rheinland-dc.local",
    "rheinland-cologne-dc-primary",
    "rheinland-cologne-dc-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.5.1.1",
    "10.5.1.2",
    "Germany",
    "Logistics & Transport",
    58,
    "C",
  ),
  solo(
    T.rheinland,
    "C1RL00000003",
    "fw-rheinland-dort.local",
    "rheinland-dortmund-warehouse",
    "XGS 136",
    "SFOS 20.0.2 MR-3",
    "10.5.2.1",
    "Germany",
    "Logistics & Transport",
    56,
    "C",
  ),
  solo(
    T.rheinland,
    "C1RL00000004",
    "fw-rheinland-ffm.local",
    "rheinland-frankfurt-warehouse",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.5.3.1",
    "Germany",
    "Logistics & Transport",
    57,
    "C",
  ),
  solo(
    T.rheinland,
    "C1RL00000005",
    "fw-rheinland-muc.local",
    "rheinland-munich-warehouse",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.5.4.1",
    "Germany",
    "Logistics & Transport",
    60,
    "C",
  ),

  // Clinique (2, FR)
  ...ha(
    T.clinique,
    "C1CQ00000001",
    "C1CQ00000002",
    "fw-clinique-main.local",
    "clinique-main-primary",
    "clinique-main-auxiliary",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.6.1.1",
    "10.6.1.2",
    "France",
    "Healthcare",
    41,
    "D",
  ),

  // Nordic (4, SE)
  ...ha(
    T.nordic,
    "C1NI00000001",
    "C1NI00000002",
    "fw-nordic-hq.local",
    "nordic-stockholm-hq-primary",
    "nordic-stockholm-hq-auxiliary",
    "XGS 4500",
    "SFOS 20.0.2 MR-3",
    "10.7.1.1",
    "10.7.1.2",
    "Sweden",
    "Financial Services",
    78,
    "B",
  ),
  solo(
    T.nordic,
    "C1NI00000003",
    "fw-nordic-gbg.local",
    "nordic-gothenburg-office",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.7.2.1",
    "Sweden",
    "Financial Services",
    77,
    "B",
  ),
  solo(
    T.nordic,
    "C1NI00000004",
    "fw-nordic-mmo.local",
    "nordic-malmo-office",
    "XGS 2300",
    "SFOS 21.0.0 GA",
    "10.7.3.1",
    "Sweden",
    "Financial Services",
    79,
    "B",
  ),

  // Lakewood (6, US)
  ...ha(
    T.lakewood,
    "C1LW00000001",
    "C1LW00000002",
    "fw-lakewood-main.local",
    "lakewood-main-campus-primary",
    "lakewood-main-campus-auxiliary",
    "XGS 4500",
    "SFOS 20.0.2 MR-3",
    "10.8.1.1",
    "10.8.1.2",
    "United States",
    "Healthcare",
    73,
    "B",
  ),
  solo(
    T.lakewood,
    "C1LW00000003",
    "fw-lakewood-op1.local",
    "lakewood-outpatient-north",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.8.2.1",
    "United States",
    "Healthcare",
    72,
    "B",
  ),
  solo(
    T.lakewood,
    "C1LW00000004",
    "fw-lakewood-op2.local",
    "lakewood-outpatient-south",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.8.3.1",
    "United States",
    "Healthcare",
    74,
    "B",
  ),
  solo(
    T.lakewood,
    "C1LW00000005",
    "fw-lakewood-op3.local",
    "lakewood-outpatient-east",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.8.4.1",
    "United States",
    "Healthcare",
    71,
    "B",
  ),
  solo(
    T.lakewood,
    "C1LW00000006",
    "fw-lakewood-op4.local",
    "lakewood-outpatient-west",
    "XGS 136",
    "SFOS 21.0.0 GA",
    "10.8.5.1",
    "United States",
    "Healthcare",
    75,
    "B",
  ),

  // Summit (3, US)
  ...ha(
    T.summit,
    "C1SR00000001",
    "C1SR00000002",
    "fw-summit-hq.local",
    "summit-denver-hq-primary",
    "summit-denver-hq-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.9.1.1",
    "10.9.1.2",
    "United States",
    "Financial Services",
    89,
    "A",
  ),
  solo(
    T.summit,
    "C1SR00000003",
    "fw-summit-cos.local",
    "summit-colorado-springs-branch",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.9.2.1",
    "United States",
    "Financial Services",
    88,
    "A",
  ),

  // Atlas Global (10, multi-country)
  ...ha(
    T.atlas,
    "C1AG00000001",
    "C1AG00000002",
    "fw-atlas-chicago-hq.local",
    "atlas-chicago-hq-primary",
    "atlas-chicago-hq-auxiliary",
    "XGS 4500",
    "SFOS 20.0.2 MR-3",
    "10.10.1.1",
    "10.10.1.2",
    "United States",
    "Manufacturing",
    75,
    "B",
  ),
  solo(
    T.atlas,
    "C1AG00000003",
    "fw-atlas-chicago-lab.local",
    "atlas-chicago-lab",
    "XGS 2300",
    "SFOS 20.0.2 MR-3",
    "10.10.2.1",
    "United States",
    "Manufacturing",
    74,
    "B",
  ),
  ...ha(
    T.atlas,
    "C1AG00000004",
    "C1AG00000005",
    "fw-atlas-london.local",
    "atlas-london-primary",
    "atlas-london-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.10.3.1",
    "10.10.3.2",
    "United Kingdom",
    "Manufacturing",
    76,
    "B",
  ),
  solo(
    T.atlas,
    "C1AG00000006",
    "fw-atlas-berlin.local",
    "atlas-berlin-factory",
    "XGS 2300",
    "SFOS 21.0.0 GA",
    "10.10.4.1",
    "Germany",
    "Manufacturing",
    72,
    "B",
  ),
  solo(
    T.atlas,
    "C1AG00000007",
    "fw-atlas-tokyo.local",
    "atlas-tokyo-office",
    "XGS 2300",
    "SFOS 21.0.0 GA",
    "10.10.5.1",
    "Japan",
    "Manufacturing",
    77,
    "B",
  ),
  ...ha(
    T.atlas,
    "C1AG00000008",
    "C1AG00000009",
    "fw-atlas-sydney.local",
    "atlas-sydney-warehouse-primary",
    "atlas-sydney-warehouse-auxiliary",
    "XGS 3300",
    "SFOS 20.0.2 MR-3",
    "10.10.6.1",
    "10.10.6.2",
    "Australia",
    "Manufacturing",
    73,
    "B",
  ),
];

// ── Main ──

async function main() {
  console.log("▸ Ensuring demo auth user…");

  // Try to find existing user
  const { data: existingUsers } = await sb.auth.admin.listUsers();
  let demoUserId: string;
  const existing = existingUsers?.users?.find((u: { email?: string }) => u.email === DEMO_EMAIL);

  if (existing) {
    demoUserId = existing.id;
    await sb.auth.admin.updateUserById(demoUserId, { password: DEMO_PASSWORD });
    console.log(`  ✓ Updated password for ${DEMO_EMAIL} (${demoUserId})`);
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`Create user failed: ${error?.message}`);
    demoUserId = created.user.id;
    console.log(`  ✓ Created ${DEMO_EMAIL} (${demoUserId})`);
  }

  // ── Organisation ──
  console.log("▸ Upserting organisation…");
  const { error: orgErr } = await sb
    .from("organisations")
    .upsert({ id: DEMO_ORG_ID, name: DEMO_ORG_NAME }, { onConflict: "id" });
  if (orgErr) throw new Error(`Org upsert failed: ${orgErr.message}`);

  // ── Org member ──
  console.log("▸ Upserting org member…");
  const { error: memErr } = await sb
    .from("org_members")
    .upsert(
      { user_id: demoUserId, org_id: DEMO_ORG_ID, role: "admin" },
      { onConflict: "user_id,org_id" },
    );
  if (memErr) throw new Error(`Member upsert failed: ${memErr.message}`);

  // ── Central credentials (dummy) ──
  console.log("▸ Upserting central_credentials…");
  const { error: credErr } = await sb.from("central_credentials").upsert(
    {
      org_id: DEMO_ORG_ID,
      encrypted_client_id: "DEMO_PLACEHOLDER_NOT_REAL",
      encrypted_client_secret: "DEMO_PLACEHOLDER_NOT_REAL",
      partner_id: "f1000000-0000-0000-0000-000000000001",
      partner_type: "partner",
      api_hosts: {
        global: "https://api-eu01.central.sophos.com",
        dataRegion: "https://api-eu01.central.sophos.com",
      },
      connected_at: "2025-09-15T09:00:00Z",
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (credErr) throw new Error(`Credentials upsert failed: ${credErr.message}`);

  // ── Central tenants ──
  console.log("▸ Upserting central_tenants…");
  await sb.from("central_tenants").delete().eq("org_id", DEMO_ORG_ID);
  for (const c of CUSTOMERS) {
    const { error } = await sb.from("central_tenants").upsert(
      {
        org_id: DEMO_ORG_ID,
        central_tenant_id: c.tenantId,
        name: c.name,
        data_region: c.dataRegion,
        api_host: c.apiHost,
        billing_type: "usage",
        compliance_country: c.country,
        compliance_environment: c.environment,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "org_id,central_tenant_id" },
    );
    if (error) console.warn(`  ⚠ Tenant ${c.name}: ${error.message}`);
  }

  // ── Central firewalls ──
  console.log("▸ Upserting central_firewalls…");
  await sb.from("central_firewalls").delete().eq("org_id", DEMO_ORG_ID);
  let fwIdCounter = 0;
  const fwIdMap = new Map<string, string>();

  for (const f of ALL_FW) {
    fwIdCounter++;
    const firewallId = `f0000000-0000-0000-0000-${String(fwIdCounter).padStart(12, "0")}`;
    fwIdMap.set(f.serial, firewallId);

    const clusterJson = f.clusterPeerId
      ? {
          id: [f.serial, f.clusterPeerId].sort().join("-"),
          status: f.clusterStatus,
          mode: "active-passive",
        }
      : null;

    const { error } = await sb.from("central_firewalls").upsert(
      {
        org_id: DEMO_ORG_ID,
        central_tenant_id: f.tenantId,
        firewall_id: firewallId,
        serial_number: f.serial,
        hostname: f.hostname,
        name: f.agentName,
        firmware_version: f.firmware,
        model: f.model,
        status_json: { connected: true, managing: "partner", suspended: false },
        cluster_json: clusterJson,
        group_json: null,
        external_ips: [`203.0.113.${fwIdCounter}`],
        geo_location: null,
        compliance_country: f.country,
        compliance_environment: f.environment,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "org_id,firewall_id" },
    );
    if (error) console.warn(`  ⚠ FW ${f.serial}: ${error.message}`);
  }

  // ── Agents ──
  console.log("▸ Upserting agents…");
  await sb.from("agents").delete().eq("org_id", DEMO_ORG_ID);
  const customerForTenant = new Map(CUSTOMERS.map((c) => [c.tenantId, c]));
  const now = new Date().toISOString();

  for (const f of ALL_FW) {
    const cust = customerForTenant.get(f.tenantId)!;
    const centralFwId = fwIdMap.get(f.serial) ?? null;

    const { error } = await sb.from("agents").insert({
      org_id: DEMO_ORG_ID,
      name: f.agentName,
      firewall_host: f.hostname,
      firewall_port: 4444,
      customer_name: cust.name,
      tenant_name: cust.name,
      serial_number: f.serial,
      firmware_version: f.firmware,
      hardware_model: f.model,
      status: "online",
      last_seen_at: now,
      last_score: f.score,
      last_grade: f.grade,
      connector_version: "1.4.2",
      central_firewall_id: centralFwId,
      compliance_country: f.country,
      compliance_environment: f.environment,
      environment: f.environment,
      api_key_hash: `demo_hash_${f.serial}`,
      api_key_prefix: "demo_",
    });
    if (error) console.warn(`  ⚠ Agent ${f.agentName}: ${error.message}`);
  }

  // ── Agent submissions + finding snapshots ──
  console.log("▸ Seeding agent_submissions & finding_snapshots…");
  await sb.from("agent_submissions").delete().eq("org_id", DEMO_ORG_ID);
  await sb.from("finding_snapshots").delete().eq("org_id", DEMO_ORG_ID);

  interface FindingDef {
    id: string;
    severity: string;
    title: string;
    detail: string;
    section: string;
    remediation: string;
    confidence: string;
  }

  const FINDING_POOL: FindingDef[] = [
    {
      id: "default-admin-password",
      severity: "critical",
      title: "Default admin password not changed",
      detail:
        "The admin account is still using the factory default password, granting full management access to anyone aware of the default credentials.",
      section: "AdminSettings",
      remediation:
        "Immediately change the admin password to a strong unique value and enable MFA for admin access.",
      confidence: "high",
    },
    {
      id: "ips-not-all-zones",
      severity: "high",
      title: "IPS policy not applied to all zones",
      detail:
        "Intrusion prevention is only applied to a subset of firewall zones, leaving some network segments without real-time threat detection.",
      section: "IPSPolicy",
      remediation:
        "Apply the IPS policy to all WAN-facing zone pairs to ensure comprehensive threat coverage.",
      confidence: "high",
    },
    {
      id: "no-app-filter-lan-wan",
      severity: "medium",
      title: "No application filter policy on LAN-to-WAN",
      detail: "Outbound traffic from LAN to WAN has no application control policy.",
      section: "ApplicationFilter",
      remediation: "Create an application filter policy for LAN-to-WAN rules.",
      confidence: "medium",
    },
    {
      id: "snmp-default-community",
      severity: "medium",
      title: "SNMP v1/v2c community string not changed from default",
      detail: "The SNMP community string is still set to the factory default.",
      section: "SNMP",
      remediation: "Change the SNMP community string or migrate to SNMPv3.",
      confidence: "high",
    },
    {
      id: "admin-https-default-port",
      severity: "medium",
      title: "Admin HTTPS uses default port 4444",
      detail:
        "The administrative HTTPS interface is accessible on the well-known default port 4444.",
      section: "AdminSettings",
      remediation: "Change the admin HTTPS port to a non-standard port.",
      confidence: "high",
    },
    {
      id: "web-filter-broad-allow",
      severity: "medium",
      title: "Web filtering policy uses broad allow",
      detail: "Web filter policies permit access to broad categories without restriction.",
      section: "WebFilterPolicy",
      remediation: "Tighten the web filter policy to block high-risk categories.",
      confidence: "high",
    },
    {
      id: "unused-rules",
      severity: "low",
      title: "Unused firewall rules detected",
      detail:
        "Multiple firewall rules have zero hit counts, suggesting they are no longer needed and increase attack surface.",
      section: "FirewallRules",
      remediation: "Review and remove or disable unused firewall rules.",
      confidence: "medium",
    },
    {
      id: "dns-open-recursion",
      severity: "low",
      title: "DNS resolution allows open recursion",
      detail: "The DNS resolver accepts recursive queries from all interfaces.",
      section: "DNS",
      remediation: "Restrict DNS recursion to internal interfaces only.",
      confidence: "high",
    },
  ];

  const inspectionForBand = (band: "a" | "b" | "c" | "d") => {
    if (band === "a")
      return {
        totalWanRules: 12,
        enabledWanRules: 12,
        disabledWanRules: 0,
        webFilterableRules: 10,
        withWebFilter: 10,
        withoutWebFilter: 0,
        withAppControl: 10,
        withIps: 12,
        withSslInspection: 8,
        sslDecryptRules: 6,
        sslExclusionRules: 2,
        sslRules: [],
        sslUncoveredZones: [],
        sslUncoveredNetworks: [],
        allWanSourceZones: ["LAN", "DMZ"],
        allWanSourceNetworks: ["Any"],
        wanRuleNames: [],
        wanWebServiceRuleNames: [],
        wanMissingWebFilterRuleNames: [],
        totalDisabledRules: 0,
        dpiEngineEnabled: true,
      };
    if (band === "b")
      return {
        totalWanRules: 14,
        enabledWanRules: 13,
        disabledWanRules: 1,
        webFilterableRules: 11,
        withWebFilter: 9,
        withoutWebFilter: 2,
        withAppControl: 8,
        withIps: 12,
        withSslInspection: 6,
        sslDecryptRules: 4,
        sslExclusionRules: 2,
        sslRules: [],
        sslUncoveredZones: [],
        sslUncoveredNetworks: [],
        allWanSourceZones: ["LAN", "DMZ", "GUEST"],
        allWanSourceNetworks: ["Any"],
        wanRuleNames: [],
        wanWebServiceRuleNames: [],
        wanMissingWebFilterRuleNames: [],
        totalDisabledRules: 1,
        dpiEngineEnabled: true,
      };
    if (band === "c")
      return {
        totalWanRules: 18,
        enabledWanRules: 15,
        disabledWanRules: 3,
        webFilterableRules: 12,
        withWebFilter: 7,
        withoutWebFilter: 5,
        withAppControl: 5,
        withIps: 8,
        withSslInspection: 4,
        sslDecryptRules: 2,
        sslExclusionRules: 2,
        sslRules: [],
        sslUncoveredZones: ["GUEST"],
        sslUncoveredNetworks: [],
        allWanSourceZones: ["LAN", "DMZ", "GUEST", "VOIP"],
        allWanSourceNetworks: ["Any"],
        wanRuleNames: [],
        wanWebServiceRuleNames: [],
        wanMissingWebFilterRuleNames: [],
        totalDisabledRules: 3,
        dpiEngineEnabled: true,
      };
    return {
      totalWanRules: 22,
      enabledWanRules: 14,
      disabledWanRules: 8,
      webFilterableRules: 14,
      withWebFilter: 4,
      withoutWebFilter: 10,
      withAppControl: 3,
      withIps: 5,
      withSslInspection: 2,
      sslDecryptRules: 1,
      sslExclusionRules: 1,
      sslRules: [],
      sslUncoveredZones: ["LAN", "GUEST", "VOIP"],
      sslUncoveredNetworks: [],
      allWanSourceZones: ["LAN", "DMZ", "GUEST", "VOIP", "IOT"],
      allWanSourceNetworks: ["Any"],
      wanRuleNames: [],
      wanWebServiceRuleNames: [],
      wanMissingWebFilterRuleNames: [],
      totalDisabledRules: 8,
      dpiEngineEnabled: false,
    };
  };

  const findingsForScore = (
    score: number,
  ): {
    titles: string[];
    summary: Record<string, unknown>[];
    findings: FindingDef[];
    band: "a" | "b" | "c" | "d";
  } => {
    if (score >= 85) return { titles: [], summary: [], findings: [], band: "a" };
    if (score >= 70) {
      const f = [FINDING_POOL[5], FINDING_POOL[3]];
      return {
        titles: f.map((x) => x.title),
        summary: f.map(({ title, severity }) => ({ title, severity })),
        findings: f,
        band: "b",
      };
    }
    if (score >= 55) {
      const f = [FINDING_POOL[4], FINDING_POOL[1], FINDING_POOL[2], FINDING_POOL[7]];
      return {
        titles: f.map((x) => x.title),
        summary: f.map(({ title, severity }) => ({ title, severity })),
        findings: f,
        band: "c",
      };
    }
    return {
      titles: FINDING_POOL.map((x) => x.title),
      summary: FINDING_POOL.map(({ title, severity }) => ({ title, severity })),
      findings: [...FINDING_POOL],
      band: "d",
    };
  };

  const { data: agentRows } = await sb
    .from("agents")
    .select(
      "id, org_id, customer_name, name, serial_number, hardware_model, firmware_version, last_score, last_grade",
    )
    .eq("org_id", DEMO_ORG_ID);

  for (const a of agentRows ?? []) {
    const { titles, summary, findings, band } = findingsForScore(a.last_score ?? 0);
    const subCreatedAt = new Date(Date.now() - Math.random() * 7 * 86_400_000).toISOString();

    const fullAnalysis = {
      stats: {
        totalRules: 0,
        totalSections: 0,
        totalHosts: 0,
        totalNatRules: 0,
        interfaces: 0,
        populatedSections: 0,
        emptySections: 0,
        sectionNames: [],
      },
      findings,
      inspectionPosture: inspectionForBand(band),
      hostname: a.name,
    };

    const { error: subErr } = await sb.from("agent_submissions").insert({
      agent_id: a.id,
      org_id: a.org_id,
      customer_name: a.customer_name,
      overall_score: a.last_score ?? 0,
      overall_grade: a.last_grade ?? "F",
      firewalls: [
        {
          hostname: a.name,
          serialNumber: a.serial_number,
          model: a.hardware_model,
          firmwareVersion: a.firmware_version,
          riskScore: { overall: a.last_score ?? 0 },
        },
      ],
      findings_summary: summary,
      finding_titles: titles,
      drift: null,
      full_analysis: fullAnalysis,
      created_at: subCreatedAt,
    });
    if (subErr) console.warn(`  ⚠ Submission ${a.customer_name}: ${subErr.message}`);

    const { error: snapErr } = await sb.from("finding_snapshots").insert({
      org_id: a.org_id,
      hostname: a.name,
      score: a.last_score ?? 0,
      titles,
      created_at: subCreatedAt,
    });
    if (snapErr) console.warn(`  ⚠ Snapshot ${a.name}: ${snapErr.message}`);
  }

  // ── Portal configs ──
  console.log("▸ Upserting portal_config…");
  await sb.from("portal_config").delete().eq("org_id", DEMO_ORG_ID);
  const portalCustomers = [
    {
      slug: "cheltenham-trust",
      name: "Cheltenham Academy Trust",
      tenant: "Cheltenham Academy Trust",
      accent: "#2006F7",
    },
    {
      slug: "westfield-nhs",
      name: "Westfield NHS Foundation",
      tenant: "Westfield NHS Foundation",
      accent: "#0071BC",
    },
    {
      slug: "pennine-bs",
      name: "Pennine Building Society",
      tenant: "Pennine Building Society",
      accent: "#1A5C3A",
    },
  ];
  for (const p of portalCustomers) {
    const { error } = await sb.from("portal_config").insert({
      org_id: DEMO_ORG_ID,
      slug: p.slug,
      company_name: p.name,
      tenant_name: p.tenant,
      accent_color: p.accent,
      show_branding: true,
      welcome_message: `Welcome to your security compliance portal. Here you can view your latest assessment results and track remediation progress.`,
    });
    if (error) console.warn(`  ⚠ Portal ${p.slug}: ${error.message}`);
  }

  // ── Assessments ──
  console.log("▸ Upserting assessments…");
  await sb.from("assessments").delete().eq("org_id", DEMO_ORG_ID);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  for (const c of CUSTOMERS) {
    const custFws = ALL_FW.filter((f) => f.tenantId === c.tenantId);
    const firewallsJson = custFws.map((f) => ({
      riskScore: { overall: f.score },
      hostname: f.hostname,
      serialNumber: f.serial,
    }));

    const { error } = await sb.from("assessments").insert({
      org_id: DEMO_ORG_ID,
      customer_name: c.name,
      environment: c.environment,
      overall_score: c.score,
      overall_grade: c.grade,
      firewalls: firewallsJson,
      created_by: demoUserId,
      created_at: daysAgo(Math.floor(Math.random() * 30) + 1),
    });
    if (error) console.warn(`  ⚠ Assessment ${c.name}: ${error.message}`);
  }

  // ── Saved reports ──
  console.log("▸ Upserting saved_reports…");
  await sb.from("saved_reports").delete().eq("org_id", DEMO_ORG_ID);
  const reports = [
    {
      customer_name: "Cheltenham Academy Trust",
      environment: "Education",
      report_type: "executive",
      reports: { executive: { title: "Executive One-Pager", generatedAt: daysAgo(3) } },
      analysis_summary: { overallScore: 87, grade: "A", findingsCount: 12 },
    },
    {
      customer_name: "Westfield NHS Foundation",
      environment: "Healthcare",
      report_type: "qbr",
      reports: { qbr: { title: "Quarterly Business Review", generatedAt: daysAgo(7) } },
      analysis_summary: { overallScore: 62, grade: "C", findingsCount: 34 },
    },
    {
      customer_name: "Pennine Building Society",
      environment: "Financial Services",
      report_type: "compliance",
      reports: { compliance: { title: "PCI DSS Compliance Report", generatedAt: daysAgo(5) } },
      analysis_summary: { overallScore: 91, grade: "A", findingsCount: 8 },
    },
  ];

  for (const r of reports) {
    const { error } = await sb.from("saved_reports").insert({
      org_id: DEMO_ORG_ID,
      customer_name: r.customer_name,
      environment: r.environment,
      report_type: r.report_type,
      reports: r.reports,
      analysis_summary: r.analysis_summary,
      created_by: demoUserId,
      created_at: daysAgo(Math.floor(Math.random() * 14) + 1),
    });
    if (error) console.warn(`  ⚠ Report ${r.customer_name}: ${error.message}`);
  }

  console.log("\n✅ Demo workspace seeded successfully.");
  console.log(`   Org ID:       ${DEMO_ORG_ID}`);
  console.log(`   Email:        ${DEMO_EMAIL}`);
  console.log(`   Tenants:      ${CUSTOMERS.length}`);
  console.log(`   FWs:          ${ALL_FW.length}`);
  console.log(`   Agents:       ${ALL_FW.length}`);
  console.log(`   Submissions:  ${(agentRows ?? []).length}`);
  console.log(`   Snapshots:    ${(agentRows ?? []).length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  Deno.exit(1);
});
