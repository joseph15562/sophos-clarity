import https from "node:https";

export interface LoginResult {
  success: boolean;
  apiVersion: string;
  error?: string;
}

export interface FirewallCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  skipSslVerify?: boolean;
}

/**
 * Authenticate to a Sophos Firewall XML API.
 * POST to https://<host>:<port>/webconsole/APIController
 * Omitting APIVersion in the request causes the response to reveal the true firmware version.
 */
export async function login(creds: FirewallCredentials): Promise<LoginResult> {
  const requestXml = `<Request><Login><Username>${escapeXml(creds.username)}</Username><Password>${escapeXml(creds.password)}</Password></Login></Request>`;

  const postData = `reqxml=${encodeURIComponent(requestXml)}`;

  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: !creds.skipSslVerify });

    const req = https.request(
      {
        hostname: creds.host,
        port: creds.port,
        path: "/webconsole/APIController",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
        agent,
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          const apiVersionMatch = body.match(/APIVersion="([^"]+)"/);
          const apiVersion = apiVersionMatch?.[1] ?? "unknown";

          if (body.includes("Authentication Successful")) {
            resolve({ success: true, apiVersion });
          } else if (body.includes("Authentication Failure")) {
            resolve({ success: false, apiVersion, error: "Authentication failed — check username and password" });
          } else {
            resolve({ success: false, apiVersion, error: "Unexpected response from firewall" });
          }
        });
      }
    );

    req.on("error", (err) => reject(new Error(`Connection failed: ${err.message}`)));
    req.on("timeout", () => { req.destroy(); reject(new Error("Connection timed out")); });
    req.write(postData);
    req.end();
  });
}

/**
 * Execute an authenticated XML API request.
 * Wraps the inner XML with login credentials and sends to the firewall.
 */
export async function apiRequest(
  creds: FirewallCredentials,
  innerXml: string
): Promise<string> {
  const requestXml = `<Request><Login><Username>${escapeXml(creds.username)}</Username><Password>${escapeXml(creds.password)}</Password></Login>${innerXml}</Request>`;

  const postData = `reqxml=${encodeURIComponent(requestXml)}`;

  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: !creds.skipSslVerify });

    const req = https.request(
      {
        hostname: creds.host,
        port: creds.port,
        path: "/webconsole/APIController",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
        agent,
        timeout: 30000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => resolve(body));
      }
    );

    req.on("error", (err) => reject(new Error(`API request failed: ${err.message}`)));
    req.on("timeout", () => { req.destroy(); reject(new Error("API request timed out")); });
    req.write(postData);
    req.end();
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
