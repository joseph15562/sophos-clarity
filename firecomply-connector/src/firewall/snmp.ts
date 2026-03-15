import snmp from "net-snmp";

export interface SnmpDeviceInfo {
  serialNumber: string | null;
  model: string | null;
  hostname: string | null;
  firmwareVersion: string | null;
}

export interface SnmpTestResult {
  ok: boolean;
  serialNumber?: string;
  model?: string;
  hostname?: string;
  firmwareVersion?: string;
  error?: string;
  rawOids?: Record<string, string>;
}

// Sophos SFOS MIB OIDs (enterprises.2604.5.1.1.x.0)
const OID_SFOS_DEVICE_NAME    = "1.3.6.1.4.1.2604.5.1.1.1.0";
const OID_SFOS_DEVICE_TYPE    = "1.3.6.1.4.1.2604.5.1.1.2.0";
const OID_SFOS_FW_VERSION     = "1.3.6.1.4.1.2604.5.1.1.3.0";
const OID_SFOS_APP_KEY        = "1.3.6.1.4.1.2604.5.1.1.4.0";

const OID_LABELS: Record<string, string> = {
  [OID_SFOS_DEVICE_NAME]: "hostname",
  [OID_SFOS_DEVICE_TYPE]: "model",
  [OID_SFOS_FW_VERSION]: "firmwareVersion",
  [OID_SFOS_APP_KEY]: "serialNumber",
};

function normalizeOid(oid: string): string {
  return oid.startsWith(".") ? oid.slice(1) : oid;
}

function varbindToString(vb: snmp.Varbind): string {
  if (vb.value == null) return "";
  if (Buffer.isBuffer(vb.value)) return vb.value.toString("utf-8").replace(/\0/g, "").trim();
  return String(vb.value).trim();
}

/**
 * Query a Sophos Firewall via SNMPv2c using the SFOS-FIREWALL-MIB OIDs.
 */
export async function getSerialViaSNMP(
  host: string,
  community: string,
  timeout = 5000
): Promise<SnmpDeviceInfo> {
  const result = await testSnmpConnection(host, community, timeout);
  return {
    serialNumber: result.serialNumber ?? null,
    model: result.model ?? null,
    hostname: result.hostname ?? null,
    firmwareVersion: result.firmwareVersion ?? null,
  };
}

/**
 * Test SNMP connectivity with detailed results for diagnostics.
 */
export async function testSnmpConnection(
  host: string,
  community: string,
  timeout = 5000
): Promise<SnmpTestResult> {
  return new Promise((resolve) => {
    let session: snmp.Session;
    try {
      session = snmp.createSession(host, community, {
        timeout,
        retries: 1,
        version: snmp.Version2c,
      });
    } catch (err) {
      resolve({ ok: false, error: `Failed to create SNMP session: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    session.on("error", (err: Error) => {
      session.close();
      resolve({ ok: false, error: `SNMP session error: ${err.message}` });
    });

    const oids = [OID_SFOS_APP_KEY, OID_SFOS_DEVICE_TYPE, OID_SFOS_DEVICE_NAME, OID_SFOS_FW_VERSION];

    const timer = setTimeout(() => {
      session.close();
      resolve({ ok: false, error: "SNMP request timed out — check firewall allows SNMP from this IP on UDP 161" });
    }, timeout + 2000);

    session.get(oids, (error, varbinds) => {
      clearTimeout(timer);
      session.close();

      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Timeout") || msg.includes("timed out")) {
          resolve({ ok: false, error: "SNMP request timed out — check: (1) SNMP is enabled on the firewall, (2) this machine's IP is in the SNMP allowed hosts, (3) UDP port 161 is not blocked" });
        } else {
          resolve({ ok: false, error: `SNMP error: ${msg}` });
        }
        return;
      }

      if (!varbinds || varbinds.length === 0) {
        resolve({ ok: false, error: "SNMP returned no data — community string may be wrong" });
        return;
      }

      const result: SnmpTestResult = { ok: false, rawOids: {} };
      let gotAnyValue = false;

      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) {
          const errMsg = snmp.varbindError(vb);
          result.rawOids![normalizeOid(vb.oid)] = `ERROR: ${errMsg}`;
          continue;
        }

        const oid = normalizeOid(vb.oid);
        const val = varbindToString(vb);
        result.rawOids![oid] = val || "(empty)";
        if (!val) continue;

        gotAnyValue = true;
        const label = OID_LABELS[oid];
        if (label === "serialNumber") result.serialNumber = val;
        else if (label === "model") result.model = val;
        else if (label === "hostname") result.hostname = val;
        else if (label === "firmwareVersion") result.firmwareVersion = val;
      }

      if (!gotAnyValue) {
        result.error = "SNMP responded but all OIDs returned empty — the Sophos SFOS MIB may not be available. Check SNMP v1/v2c is enabled (not just traps).";
      } else {
        result.ok = true;
        if (!result.serialNumber) {
          result.error = "Connected but sfosDeviceAppKey was empty";
        }
      }

      resolve(result);
    });
  });
}
