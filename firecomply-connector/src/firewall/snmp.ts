import snmp from "net-snmp";

export interface SnmpDeviceInfo {
  serialNumber: string | null;
  model: string | null;
  hostname: string | null;
}

// Standard OIDs
const OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const OID_SYS_NAME = "1.3.6.1.2.1.1.5.0";
const OID_ENT_SERIAL = "1.3.6.1.2.1.47.1.1.1.1.11.1";

/**
 * Query a Sophos Firewall via SNMPv2c to retrieve the serial number.
 * Falls back to parsing sysDescr if the ENTITY-MIB serial OID isn't available.
 */
export async function getSerialViaSNMP(
  host: string,
  community: string,
  timeout = 5000
): Promise<SnmpDeviceInfo> {
  return new Promise((resolve) => {
    const session = snmp.createSession(host, community, {
      timeout,
      retries: 1,
      version: snmp.Version2c,
    });

    const oids = [OID_SYS_DESCR, OID_SYS_NAME, OID_ENT_SERIAL];

    session.get(oids, (error, varbinds) => {
      session.close();

      if (error || !varbinds) {
        resolve({ serialNumber: null, model: null, hostname: null });
        return;
      }

      let sysDescr = "";
      let hostname: string | null = null;
      let serial: string | null = null;

      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;

        const oid = vb.oid;
        const val = vb.value?.toString() ?? "";

        if (oid === OID_ENT_SERIAL && val.trim()) {
          serial = val.trim();
        } else if (oid === OID_SYS_DESCR) {
          sysDescr = val;
        } else if (oid === OID_SYS_NAME && val.trim()) {
          hostname = val.trim();
        }
      }

      // Some Sophos devices include serial in sysDescr
      if (!serial && sysDescr) {
        const m = sysDescr.match(/serial[:\s]+(\S+)/i)
               ?? sysDescr.match(/S\/N[:\s]+(\S+)/i);
        if (m) serial = m[1];
      }

      // Try to extract model from sysDescr
      let model: string | null = null;
      if (sysDescr) {
        const mm = sysDescr.match(/Sophos\s+(XGS?\s*\d+\w*)/i)
                ?? sysDescr.match(/(XGS?\s*\d+\w*)/i);
        if (mm) model = mm[1].trim();
      }

      resolve({ serialNumber: serial, model, hostname });
    });
  });
}
