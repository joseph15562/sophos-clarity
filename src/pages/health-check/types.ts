export type ActiveStep = "landing" | "analyzing" | "results";

export type EphemeralCentralCreds = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

export type GuestTenantRow = { id: string; name: string; apiHost?: string };

/** Sophos Licensing API row (guest_health_firewall_licenses / firewall-licenses). */
export type GuestFirewallLicenseApiRow = {
  serialNumber?: string;
  licenses?: Array<{
    licenseIdentifier?: string;
    product?: { code?: string; name?: string };
    endDate?: string;
    type?: string;
  }>;
};
