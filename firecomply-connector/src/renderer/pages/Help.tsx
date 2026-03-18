import { useNavigate } from "react-router-dom";

import imgProfilesList from "../assets/help/01-profiles-list.png";
import imgProfilePerms from "../assets/help/02-profile-permissions.png";
import imgCreateUser from "../assets/help/03-create-user.png";
import imgMfa from "../assets/help/04-mfa-settings.png";
import imgApiAccess from "../assets/help/05-api-access.png";
import imgDeviceAccess from "../assets/help/06-device-access.png";
import imgSnmpSettings from "../assets/help/07-snmp-settings.png";
import imgSnmpCommunity from "../assets/help/08-snmp-community.png";

function Section({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-border rounded-xl p-5 space-y-4">{children}</div>;
}

function StepImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-black/5">
      <img src={src} alt={alt} className="w-full" loading="lazy" />
    </div>
  );
}

export function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
        <h1 className="text-lg font-bold text-foreground">Help — Firewall Setup Guide</h1>
      </div>

      {/* Overview */}
      <Section>
        <h2 className="text-sm font-semibold text-foreground">What is the FireComply Connector?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The FireComply Connector runs on your network and automatically pulls configuration exports from your Sophos XGS firewalls on a schedule.
          It connects to each firewall's XML API, retrieves the full configuration, runs a security analysis, and submits the results to your FireComply dashboard.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          To do this, the connector needs <strong className="text-foreground">read-only API access</strong> to each firewall. This guide walks you through setting that up securely.
        </p>
      </Section>

      {/* Step 1: API Key */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6B5BFF] text-white text-[10px] font-bold shrink-0">1</span>
          <h2 className="text-sm font-semibold text-foreground">Get Your API Key from FireComply</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          In the FireComply web app, go to the <strong className="text-foreground">Management Panel → Settings → Connector Agents</strong> section and click <strong className="text-foreground">Register Agent</strong>.
          Enter a name for the agent and an API key will be generated. Copy this key — you'll paste it into the connector during setup.
        </p>
      </Section>

      {/* Step 2: Admin Profile */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6B5BFF] text-white text-[10px] font-bold shrink-0">2</span>
          <h2 className="text-sm font-semibold text-foreground">Create a Read-Only Admin Profile</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          On your Sophos XGS firewall, navigate to <strong className="text-foreground">System → Profiles → Device access</strong>.
          Click <strong className="text-foreground">Add</strong> to create a new profile. Name it <code className="bg-muted px-1 rounded text-foreground">API read only</code>.
        </p>
        <StepImage src={imgProfilesList} alt="Profiles list showing API read only profile" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set <strong className="text-foreground">every permission category</strong> to <strong className="text-foreground">Read-only</strong>.
          This ensures the API service account can read the configuration but cannot make any changes.
        </p>
        <StepImage src={imgProfilePerms} alt="Profile permissions grid — all categories set to Read-only" />
      </Section>

      {/* Step 3: Service Account */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6B5BFF] text-white text-[10px] font-bold shrink-0">3</span>
          <h2 className="text-sm font-semibold text-foreground">Create the Service Account</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Go to <strong className="text-foreground">Authentication → Users</strong> and click <strong className="text-foreground">Add</strong>. Configure the user as follows:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
          <li><strong className="text-foreground">Username:</strong> <code className="bg-muted px-1 rounded text-foreground">firecomply-api</code></li>
          <li><strong className="text-foreground">User type:</strong> Administrator</li>
          <li><strong className="text-foreground">Profile:</strong> API read only (the profile you just created)</li>
          <li><strong className="text-foreground">Password:</strong> Use a strong, unique password (20+ characters recommended)</li>
        </ul>
        <StepImage src={imgCreateUser} alt="Create user form — firecomply-api with API read only profile" />
      </Section>

      {/* Step 4: MFA */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">4</span>
          <h2 className="text-sm font-semibold text-foreground">Exclude the Service Account from MFA</h2>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-200 space-y-2">
          <p className="font-semibold text-amber-500">Important: Why no MFA on the API account?</p>
          <p className="text-muted-foreground">
            The Sophos XGS <strong className="text-foreground">XML API does not support interactive MFA/OTP tokens</strong>.
            If MFA is enabled for the service account, API authentication will fail because there is no way to enter a one-time password during an automated API call.
          </p>
          <p className="text-muted-foreground">
            This is secure because the account is protected by:
          </p>
          <ul className="text-muted-foreground space-y-0.5 ml-4 list-disc">
            <li><strong className="text-foreground">Read-only access</strong> — cannot modify the firewall configuration</li>
            <li><strong className="text-foreground">IP restriction</strong> — API only accepts connections from the connector's IP</li>
            <li><strong className="text-foreground">Strong password</strong> — complex, unique credentials</li>
            <li><strong className="text-foreground">No console access</strong> — the API user cannot log in to WebAdmin</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Go to <strong className="text-foreground">Authentication → Multi-factor authentication</strong>. If OTP is set to <strong className="text-foreground">All users</strong>,
          change it to <strong className="text-foreground">Specific users and groups</strong> and make sure <code className="bg-muted px-1 rounded text-foreground">firecomply-api</code> is
          <strong className="text-foreground"> not </strong> in the list.
        </p>
        <StepImage src={imgMfa} alt="MFA settings — ensure firecomply-api is not in the OTP-required list" />
      </Section>

      {/* Step 5: Enable API */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6B5BFF] text-white text-[10px] font-bold shrink-0">5</span>
          <h2 className="text-sm font-semibold text-foreground">Enable the API & Restrict by IP</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Navigate to <strong className="text-foreground">Administration → API access</strong>. Toggle <strong className="text-foreground">API access</strong> to <strong className="text-foreground">On</strong>.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Under <strong className="text-foreground">Allowed IP hosts</strong>, add the IP address (or host object) of the machine running the FireComply Connector.
          Only these IPs will be able to call the API — this is a critical security control.
        </p>
        <StepImage src={imgApiAccess} alt="API access settings — toggle on and allowed IP hosts" />
      </Section>

      {/* Step 6: SNMP (optional) */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0">6</span>
          <h2 className="text-sm font-semibold text-foreground">Enable SNMP (Optional — for Serial Number)</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          SNMP is optional but recommended. It allows the connector to read the firewall's serial number, hardware model, and hostname for richer reporting.
        </p>

        <p className="text-xs text-muted-foreground leading-relaxed font-semibold text-foreground">6a. Enable SNMP Agent</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Go to <strong className="text-foreground">Administration → SNMP</strong>. Check <strong className="text-foreground">Enable SNMP agent</strong> and fill in the agent name.
        </p>
        <StepImage src={imgSnmpSettings} alt="SNMP settings — enable agent and SNMPv1/v2c community" />

        <p className="text-xs text-muted-foreground leading-relaxed font-semibold text-foreground">6b. Create a Community String</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Under <strong className="text-foreground">SNMPv1/v2c</strong>, click <strong className="text-foreground">Add</strong>. Set a name, enter a read-only community string,
          and restrict the <strong className="text-foreground">IP address</strong> to the connector machine. Enable <strong className="text-foreground">Accept queries</strong> and leave <strong className="text-foreground">Send traps</strong> disabled.
        </p>
        <StepImage src={imgSnmpCommunity} alt="Edit SNMP community — name, community string, IP restriction" />

        <p className="text-xs text-muted-foreground leading-relaxed font-semibold text-foreground">6c. Allow SNMP on the Zone</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Go to <strong className="text-foreground">Administration → Device access</strong>. In the zone/service matrix, enable the <strong className="text-foreground">SNMP</strong> checkbox
          for the zone where the connector machine is located (e.g. LAN, Servers, DMZ).
        </p>
        <StepImage src={imgDeviceAccess} alt="Device access matrix — enable SNMP for the connector's zone" />
      </Section>

      {/* Step 7: Configure the Connector */}
      <Section>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6B5BFF] text-white text-[10px] font-bold shrink-0">7</span>
          <h2 className="text-sm font-semibold text-foreground">Configure the Connector</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Back in the FireComply Connector, run through the setup wizard:
        </p>
        <ol className="text-xs text-muted-foreground space-y-1.5 ml-4 list-decimal">
          <li>Paste the <strong className="text-foreground">API key</strong> from Step 1 and click <strong className="text-foreground">Verify</strong></li>
          <li>Add each firewall with its <strong className="text-foreground">IP address</strong>, <strong className="text-foreground">port</strong> (default 4444), <strong className="text-foreground">username</strong> (<code className="bg-muted px-1 rounded text-foreground">firecomply-api</code>), and <strong className="text-foreground">password</strong></li>
          <li>Optionally enter the <strong className="text-foreground">SNMP community string</strong> for serial number detection</li>
          <li>Click <strong className="text-foreground">Test API</strong> and <strong className="text-foreground">Test SNMP</strong> to verify connectivity</li>
          <li>Choose a <strong className="text-foreground">schedule</strong> (e.g. Daily at 02:00)</li>
          <li>Click <strong className="text-foreground">Start Monitoring</strong></li>
        </ol>
      </Section>

      {/* Troubleshooting */}
      <Section>
        <h2 className="text-sm font-semibold text-foreground">Troubleshooting</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Authentication failed</p>
            <p className="text-[10px] text-muted-foreground">Check the username and password. Make sure the user type is <strong className="text-foreground">Administrator</strong> (not User) and the profile is set correctly. If MFA is enabled for this user, the API call will fail — see Step 4.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Connection timed out</p>
            <p className="text-[10px] text-muted-foreground">Verify the firewall IP and port (default 4444). Check that the connector machine's IP is in the API <strong className="text-foreground">Allowed IP hosts</strong> list. Ensure no firewall rules are blocking the connection.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">SSL certificate error</p>
            <p className="text-[10px] text-muted-foreground">The connector uses <strong className="text-foreground">Skip SSL verification</strong> by default because most firewalls use self-signed certificates. If you've disabled this, ensure the firewall's certificate is trusted on this machine.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">SNMP — no response</p>
            <p className="text-[10px] text-muted-foreground">Check that SNMP is enabled (Step 6a), the community string matches, the connector IP is authorised (Step 6b), and SNMP is allowed on the correct zone in Device access (Step 6c).</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">API key invalid / connection lost</p>
            <p className="text-[10px] text-muted-foreground">If the agent was deleted on the server, go to <strong className="text-foreground">Settings → Disconnect & Re-setup</strong> to clear the old credentials and run the setup wizard again with a new API key.</p>
          </div>
        </div>
      </Section>

      {/* Need help */}
      <div className="text-center text-xs text-muted-foreground pb-6">
        <p>Need more help? Contact <a href="mailto:support@firecomply.co.uk" className="text-[#6B5BFF] hover:underline">support@firecomply.co.uk</a></p>
      </div>
    </div>
  );
}
