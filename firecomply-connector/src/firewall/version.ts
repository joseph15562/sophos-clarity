export interface FirewallCapabilities {
  firmwareVersion: string;
  apiVersion: string;
  serialNumber?: string;
  hardwareModel?: string;
  isXgs: boolean;
  hasNdr: boolean;
  hasMdr: boolean;
  hasAtp: boolean;
  hasThirdPartyFeeds: boolean;
  hasSslTlsInspection: boolean;
}

const VERSION_MAP: [string, string][] = [
  ["2200", "v22.0"],
  ["2150", "v21.5"],
  ["2100", "v21.0"],
  ["2000", "v20.0"],
  ["1905", "v19.5"],
  ["1900", "v19.0"],
  ["1800", "v18.0"],
];

function parseApiMajor(apiVersion: string): number {
  const match = apiVersion.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function apiVersionToFirmware(apiVersion: string): string {
  for (const [prefix, fw] of VERSION_MAP) {
    if (apiVersion.startsWith(prefix)) return fw;
  }
  const major = parseApiMajor(apiVersion);
  if (major >= 2200) return `v${Math.floor(major / 100)}.${major % 100}`;
  return `v${apiVersion}`;
}

export function detectCapabilities(
  apiVersion: string,
  hardwareModel?: string
): FirewallCapabilities {
  const major = parseApiMajor(apiVersion);
  const isXgs = !!hardwareModel && /^xgs/i.test(hardwareModel.trim());

  return {
    firmwareVersion: apiVersionToFirmware(apiVersion),
    apiVersion,
    hardwareModel,
    isXgs,
    hasNdr: major >= 2150 && isXgs,
    hasMdr: major >= 2100,
    hasAtp: major >= 1900,
    hasThirdPartyFeeds: major >= 2100,
    hasSslTlsInspection: major >= 1800,
  };
}
