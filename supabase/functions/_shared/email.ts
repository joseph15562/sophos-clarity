export const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
export const CONFIG_UPLOAD_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "reports@firecomply.io";

/** Escape user/DB text before interpolating into HTML email templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const MAX_CONFIG_SIZE = 10 * 1024 * 1024; // 10 MB

export const SOPHOS_ENTITY_TAGS = [
  "Response", "FirewallRule", "NATRule", "IPHost", "IPHostGroup",
  "Zone", "ServiceObject", "Interface", "DNSRequestRoute",
  "LocalServiceACL", "DoSRule", "AntiVirus", "IPS", "WebFilter",
  "ApplicationFilter", "SSLVPNPolicy", "IPSecConnection",
];

export function isValidSophosXml(xml: string): boolean {
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<Response")) return false;
  return SOPHOS_ENTITY_TAGS.some((tag) => xml.includes(`<${tag}`));
}

/**
 * Build the branded email HTML wrapper.
 *
 * `heading` — plain text, escaped here.
 * `bodyContent` — pre-built HTML from callers (escape individual values BEFORE passing).
 * `ctaUrl` — URL, must start with https:// (not escaped, would break href).
 * `ctaLabel` — plain text, escaped here.
 * `footNote` — may contain intentional HTML (e.g. <strong>), passed through as-is.
 */
export function buildSophosEmailHtml(heading: string, bodyContent: string, ctaUrl?: string, ctaLabel?: string, footNote?: string): string {
  const safeHeading = escapeHtml(heading);
  const safeCtaLabel = escapeHtml(ctaLabel ?? "Open");
  const ctaBlock = ctaUrl ? `
<tr><td align="center" style="padding:8px 40px 16px 40px;">
  <table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#2006F7;border-radius:25px;">
    <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:'Zalando Sans','Segoe UI',Roboto,sans-serif;">${safeCtaLabel}</a>
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:8px 40px 8px 40px;">
  <p style="margin:0;font-size:12px;color:#6A889B;line-height:1.5;">Do not share this link or forward this email.</p>
</td></tr>` : "";
  const footNoteBlock = footNote ? `<p style="margin:16px 0 0;font-size:13px;color:#6A889B;line-height:1.5;">${footNote}</p>` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Zalando Sans','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#EDF2F9;" bgcolor="#EDF2F9">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDF2F9;padding:32px 0;" bgcolor="#EDF2F9">
<tr><td align="center" bgcolor="#EDF2F9" style="background-color:#EDF2F9;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
<tr><td style="background:#2006F7;padding:36px 40px;">
  <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:800;font-family:'Zalando Sans Expanded','Zalando Sans','Segoe UI',Roboto,sans-serif;">${safeHeading}</h1>
</td></tr>
<tr><td style="padding:36px 40px 24px 40px;font-size:15px;color:#001A47;line-height:1.6;">
  ${bodyContent}${footNoteBlock}
</td></tr>${ctaBlock}
<tr><td style="padding:20px 40px 36px 40px;">
  <p style="margin:0;font-size:15px;color:#001A47;line-height:1.6;">
    Best Regards,<br><strong>Your Sophos FireComply Team</strong>
  </p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #BBCFDE;text-align:center;">
  <p style="margin:0 0 8px;font-size:11px;color:#6A889B;line-height:1.5;">&copy; ${new Date().getFullYear()} Sophos Ltd. All rights reserved.</p>
  <p style="margin:0;font-size:11px;color:#6A889B;line-height:1.5;">Sophos FireComply &bull; Sales Engineering Tools</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendConfigUploadEmail(
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: CONFIG_UPLOAD_FROM_EMAIL, to: [to], subject, html: bodyHtml }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `Resend ${resp.status}: ${body}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function buildCustomerUploadEmailHtml(uploadUrl: string, seName: string, expiresDate: string, contactName?: string): string {
  const safeName = escapeHtml(contactName ?? "");
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";
  const safeSe = escapeHtml(seName);
  const safeDate = escapeHtml(expiresDate);
  return buildSophosEmailHtml(
    "Firewall Health Check",
    `<p style="margin:0 0 20px;">${greeting}</p>
<p style="margin:0 0 20px;"><strong>${safeSe}</strong> from Sophos has requested your firewall configuration for a health check.</p>
<p style="margin:0 0 20px;">Please click the button below to securely upload your <code style="background:#EDF2F9;padding:2px 6px;border-radius:3px;font-size:13px;color:#2006F7;">entities.xml</code> file.</p>
<p style="margin:0 0 10px;font-size:14px;color:#223E4C;"><strong style="color:#001A47;">Optional:</strong> You can also connect your <strong style="color:#001A47;">Sophos Central</strong> account on the upload page. This allows your SE to enrich the health check with licence expiry dates, firmware versions, and HA status — giving you a more comprehensive report.</p>
<p style="margin:0 0 20px;font-size:13px;color:#6A889B;">You'll find the option to connect Central on the upload page. You'll need your Sophos Central API <strong style="color:#001A47;">Client ID</strong> and <strong style="color:#001A47;">Client Secret</strong> (instructions are provided on the page). Your credentials are encrypted and automatically deleted after the health check.</p>`,
    uploadUrl,
    "Upload Configuration",
    `This link expires on <strong>${safeDate}</strong>.`,
  );
}

export function buildSeNotificationEmailHtml(customerName: string, clarityUrl: string, centralNote = "", seName = ""): string {
  const label = escapeHtml(customerName || "A customer");
  const greeting = seName ? `Hi ${escapeHtml(seName)},` : "Hi,";
  return buildSophosEmailHtml(
    "Configuration Uploaded",
    `<p style="margin:0 0 20px;">${greeting}</p>
<p style="margin:0 0 20px;"><strong>${label}</strong> has uploaded their firewall configuration.</p>
${centralNote}<p style="margin:0 0 20px;">Open Sophos FireComply to run the health check.</p>`,
    clarityUrl,
    "Open FireComply",
  );
}

export function buildReminderEmailHtml(uploadUrl: string, expiresDate: string): string {
  return buildSophosEmailHtml(
    "Reminder: Upload Pending",
    `<p style="margin:0 0 20px;">Hi,</p>
<p style="margin:0 0 20px;"><strong>Reminder:</strong> Your Sophos SE is still waiting for your firewall configuration.</p>
<p style="margin:0 0 20px;">Please upload your <code style="background:#EDF2F9;padding:2px 6px;border-radius:3px;font-size:13px;color:#2006F7;">entities.xml</code> before this link expires.</p>`,
    uploadUrl,
    "Upload Configuration",
    `This link expires on <strong>${escapeHtml(expiresDate)}</strong>.`,
  );
}
