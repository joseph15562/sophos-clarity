import snmp from "net-snmp";

export interface SnmpDeviceInfo {
  serialNumber: string | null;
  model: string | null;
  hostname: string | null;
  firmwareVersion: string | null;
}

// Sophos SFOS MIB OIDs (enterprises.2604.5.1.1.x.0)
const OID_SFOS_DEVICE_NAME    = "1.3.6.1.4.1.2604.5.1.1.1.0";  // sfosDeviceName (hostname)
const OID_SFOS_DEVICE_TYPE    = "1.3.6.1.4.1.2604.5.1.1.2.0";  // sfosDeviceType (model, e.g. "XG-85")
const OID_SFOS_FW_VERSION     = "1.3.6.1.4.1.2604.5.1.1.3.0";  // sfosDeviceFWVersion
const OID_SFOS_APP_KEY        = "1.3.6.1.4.1.2604.5.1.1.4.0";  // sfosDeviceAppKey (serial / appliance key)

/**
 * Query a Sophos Firewall via SNMPv2c using the SFOS-FIREWALL-MIB OIDs.
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

    const oids = [OID_SFOS_APP_KEY, OID_SFOS_DEVICE_TYPE, OID_SFOS_DEVICE_NAME, OID_SFOS_FW_VERSION];

    session.get(oids, (error, varbinds) => {
      session.close();

      if (error || !varbinds) {
        resolve({ serialNumber: null, model: null, hostname: null, firmwareVersion: null });
        return;
      }

      let serial: string | null = null;
      let model: string | null = null;
      let hostname: string | null = null;
      let firmwareVersion: string | null = null;

      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;

        const oid = vb.oid;
        const val = vb.value?.toString()?.trim() ?? "";
        if (!val) continue;

        if (oid === OID_SFOS_APP_KEY) serial = val;
        else if (oid === OID_SFOS_DEVICE_TYPE) model = val;
        else if (oid === OID_SFOS_DEVICE_NAME) hostname = val;
        else if (oid === OID_SFOS_FW_VERSION) firmwareVersion = val;
      }

      resolve({ serialNumber: serial, model, hostname, firmwareVersion });
    });
  });
}
