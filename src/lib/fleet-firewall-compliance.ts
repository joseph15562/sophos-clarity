import { supabase } from "@/integrations/supabase/client";
import type { FleetFirewall } from "@/lib/fleet-command-data";
import { fleetPersistenceTarget } from "@/lib/fleet-command-data";

export type FleetCompliancePayload = {
  country: string;
  state: string;
  /** Both null clears map pin; both must be set (valid range) when either is provided. */
  mapLatitude: number | null;
  mapLongitude: number | null;
};

/** Empty both → clear pin. Both required when one side has text. */
export function parseFleetMapCoordinateInputs(
  latStr: string,
  lngStr: string,
):
  | { ok: true; mapLatitude: number | null; mapLongitude: number | null }
  | { ok: false; message: string } {
  const lt = latStr.trim();
  const lg = lngStr.trim();
  if (!lt && !lg) return { ok: true, mapLatitude: null, mapLongitude: null };
  if (!lt || !lg) {
    return { ok: false, message: "Enter both latitude and longitude, or leave both blank." };
  }
  const lat = Number(lt);
  const lng = Number(lg);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: "Latitude and longitude must be numbers." };
  }
  if (lat < -90 || lat > 90) return { ok: false, message: "Latitude must be between -90 and 90." };
  if (lng < -180 || lng > 180)
    return { ok: false, message: "Longitude must be between -180 and 180." };
  return { ok: true, mapLatitude: lat, mapLongitude: lng };
}

/** Normalizes country/state for `central_firewalls` / `agents` (per device). */
export function normalizeJurisdictionPayload(p: FleetCompliancePayload): {
  compliance_country: string;
  compliance_state: string;
  map_latitude: number | null;
  map_longitude: number | null;
} {
  const country = (p.country ?? "").trim();
  const state = country === "United States" ? (p.state ?? "").trim() : "";
  return {
    compliance_country: country,
    compliance_state: state,
    map_latitude: p.mapLatitude,
    map_longitude: p.mapLongitude,
  };
}

export type FleetCustomerComplianceScope =
  | { kind: "tenant"; centralTenantId: string }
  | { kind: "agent_bucket"; bucketKey: string };

export function fleetCustomerComplianceScope(
  fw: FleetFirewall,
): FleetCustomerComplianceScope | null {
  if (fw.tenantId) return { kind: "tenant", centralTenantId: fw.tenantId };
  if (fw.source === "agent" && fw.agentCustomerBucketKey)
    return { kind: "agent_bucket", bucketKey: fw.agentCustomerBucketKey };
  return null;
}

/**
 * Customer-wide default country + sector (Sophos tenant or agent bucket).
 */
export async function persistFleetCustomerCompliance(
  orgId: string,
  scope: FleetCustomerComplianceScope,
  payload: { country: string; environment: string },
): Promise<void> {
  const country = (payload.country ?? "").trim();
  const environment = (payload.environment ?? "").trim();
  if (scope.kind === "tenant") {
    const { error } = await supabase
      .from("central_tenants")
      .update({ compliance_country: country, compliance_environment: environment })
      .eq("org_id", orgId)
      .eq("central_tenant_id", scope.centralTenantId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("agent_customer_compliance_environment").upsert(
    {
      org_id: orgId,
      customer_bucket_key: scope.bucketKey,
      compliance_country: country,
      compliance_environment: environment,
    },
    { onConflict: "org_id,customer_bucket_key" },
  );
  if (error) throw error;
}

/**
 * Persist per-firewall jurisdiction only (country/state). Customer sector and default country use
 * {@link persistFleetCustomerCompliance}.
 */
export async function persistFleetFirewallCompliance(
  orgId: string,
  fw: FleetFirewall,
  raw: FleetCompliancePayload,
): Promise<void> {
  const jurisdiction = normalizeJurisdictionPayload(raw);
  const target = fleetPersistenceTarget(fw);

  if (target === "agent") {
    const { error: rpcErr } = await supabase.rpc("update_agent_compliance_context", {
      p_agent_id: fw.id,
      p_country: jurisdiction.compliance_country,
      p_state: jurisdiction.compliance_state,
      p_map_latitude: jurisdiction.map_latitude,
      p_map_longitude: jurisdiction.map_longitude,
    });
    if (rpcErr) throw rpcErr;
    return;
  }

  const { compliance_country, compliance_state, map_latitude, map_longitude } = jurisdiction;

  if (fw.haClusterId) {
    const { data: rows, error: selErr } = await supabase
      .from("central_firewalls")
      .select("id, cluster_json")
      .eq("org_id", orgId);
    if (selErr) throw selErr;
    const cid = fw.haClusterId;
    const ids = (rows ?? [])
      .filter((r) => (r.cluster_json as { id?: string } | null)?.id === cid)
      .map((r) => r.id)
      .filter(Boolean);
    const idList = ids.length > 0 ? ids : [fw.id];
    const { error } = await supabase
      .from("central_firewalls")
      .update({
        compliance_country,
        compliance_state,
        map_latitude,
        map_longitude,
      })
      .in("id", idList);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("central_firewalls")
    .update({
      compliance_country,
      compliance_state,
      map_latitude,
      map_longitude,
    })
    .eq("id", fw.id)
    .eq("org_id", orgId);
  if (error) throw error;
}
