import cron from "node-cron";
import { login, getDeviceInfo } from "./firewall/auth";
import { detectCapabilities } from "./firewall/version";
import { exportAllEntities } from "./firewall/export-config";
import { parseEntityResults, buildRawConfig } from "./firewall/parse-entities";
import { collectThreatStatus } from "./firewall/threat-status";
import { analyseConfig } from "./analysis/analyse-config";
import { computeRiskScore } from "./analysis/risk-score";
import { ApiClient } from "./api/client";
import { buildPayload, submitAssessment } from "./api/submit";
import { sendHeartbeat } from "./api/heartbeat";
import { enqueue, dequeueAll, removeQueued } from "./api/queue";
import { log } from "./logger";
import type { AppConfig, FirewallConfig } from "./config";
import type { RiskScoreResult } from "./analysis/types";
import type { ThreatStatus } from "./firewall/threat-status";

const AGENT_VERSION = "1.6.5";

export interface FirewallStatus {
  label: string;
  status: "idle" | "running" | "success" | "error";
  lastScore?: number;
  lastGrade?: string;
  lastRun?: string;
  error?: string;
  firmwareVersion?: string;
}

export interface HeartbeatInfo {
  lastSentAt: string | null;
  lastOk: boolean;
  lastError?: string;
  commandReceived?: string;
  commandReceivedAt?: string;
}

export type SchedulerEventHandler = (event: string, data: unknown) => void;

export class Scheduler {
  private config: AppConfig;
  private client: ApiClient;
  private task: cron.ScheduledTask | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private commandPollInterval: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private firewallStatuses: Map<string, FirewallStatus> = new Map();
  private dataDir: string;
  private eventHandler?: SchedulerEventHandler;
  private _heartbeatInfo: HeartbeatInfo = { lastSentAt: null, lastOk: false };
  private lastDeviceInfo: { serialNumber?: string; hardwareModel?: string; firmwareVersion?: string } = {};

  constructor(config: AppConfig, dataDir: string, eventHandler?: SchedulerEventHandler) {
    this.config = config;
    this.dataDir = dataDir;
    this.eventHandler = eventHandler;
    this.client = new ApiClient({
      baseUrl: config.firecomplyApiUrl,
      apiKey: config.agentApiKey,
      proxy: config.proxy,
    });

    for (const fw of config.firewalls) {
      this.firewallStatuses.set(fw.label, { label: fw.label, status: "idle" });
    }
  }

  start(): void {
    log.info(`Starting scheduler with cron: ${this.config.schedule}`);

    this.task = cron.schedule(this.config.schedule, () => {
      if (!this.paused) this.runAll();
    });

    this.heartbeatInterval = setInterval(() => this.heartbeat(), 60 * 1000);
    this.commandPollInterval = setInterval(() => this.pollCommands(), 10 * 1000);
    this.heartbeat();
    this.flushQueue();
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
    if (this.commandPollInterval) clearInterval(this.commandPollInterval);
    this.commandPollInterval = null;
    log.info("Scheduler stopped");
  }

  pause(): void { this.paused = true; log.info("Scheduler paused"); }
  resume(): void { this.paused = false; log.info("Scheduler resumed"); }
  isPaused(): boolean { return this.paused; }

  getStatuses(): FirewallStatus[] {
    return Array.from(this.firewallStatuses.values());
  }

  getHeartbeatInfo(): HeartbeatInfo {
    return { ...this._heartbeatInfo };
  }

  async runAll(): Promise<void> {
    log.info("Starting scheduled assessment run");
    this.emit("run:start", null);

    for (const fw of this.config.firewalls) {
      await this.runFirewall(fw);
    }

    log.info("Scheduled run complete");
    this.emit("run:complete", null);

    // Send heartbeat immediately after scan so serial/model reach the server
    this.heartbeat().catch(() => {});
  }

  async runFirewall(fw: FirewallConfig): Promise<void> {
    const label = fw.label;
    this.updateStatus(label, { status: "running", error: undefined });
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
    log.info(`[${elapsed()}] Starting scan: ${label}`, label);

    try {
      // Step 1: Auth
      log.info(`[${elapsed()}] Step 1/7: Authenticating...`, label);
      const loginResult = await login({
        host: fw.host, port: fw.port, username: fw.username,
        password: fw.password, skipSslVerify: fw.skipSslVerify,
      });

      if (!loginResult.success) {
        throw new Error(loginResult.error ?? "Authentication failed");
      }
      log.info(`[${elapsed()}] Auth OK`, label);

      // Step 2: Device info + version detection
      log.info(`[${elapsed()}] Step 2/7: Getting device info...`, label);
      const apiVersion = fw.versionOverride ?? loginResult.apiVersion;

      const deviceInfo = await getDeviceInfo({
        host: fw.host, port: fw.port, username: fw.username,
        password: fw.password, skipSslVerify: fw.skipSslVerify,
      }, fw.snmpCommunity);

      const capabilities = detectCapabilities(apiVersion, deviceInfo.hardwareModel ?? undefined);
      log.info(`[${elapsed()}] Firmware: ${capabilities.firmwareVersion} (API ${apiVersion}) | Model: ${deviceInfo.hardwareModel ?? "unknown"} | XGS: ${capabilities.isXgs}`, label);
      log.info(`[${elapsed()}] Capabilities: ATP=${capabilities.hasAtp} MDR=${capabilities.hasMdr} NDR=${capabilities.hasNdr} SSL=${capabilities.hasSslTlsInspection}`, label);
      if (deviceInfo.serialNumber) log.info(`[${elapsed()}] Serial: ${deviceInfo.serialNumber}`, label);
      else log.warn(`[${elapsed()}] Could not retrieve serial number — check API profile permissions or add SNMP community`, label);

      this.lastDeviceInfo = {
        serialNumber: deviceInfo.serialNumber ?? undefined,
        hardwareModel: deviceInfo.hardwareModel ?? undefined,
        firmwareVersion: capabilities.firmwareVersion,
      };

      // Push serial and version to FireComply immediately so the UI shows connection before the report is done
      try {
        await sendHeartbeat(this.client, {
          agent_version: AGENT_VERSION,
          firmware_version: capabilities.firmwareVersion,
          serial_number: deviceInfo.serialNumber ?? undefined,
          hardware_model: deviceInfo.hardwareModel ?? undefined,
          customer_name: this.config.customerName || undefined,
        });
        log.info(`[${elapsed()}] Heartbeat sent (serial/version pushed to FireComply)`, label);
      } catch (hbErr) {
        log.warn(`[${elapsed()}] Early heartbeat failed (non-fatal): ${hbErr instanceof Error ? hbErr.message : hbErr}`, label);
      }

      // Step 3: Export config entities
      log.info(`[${elapsed()}] Step 3/7: Exporting config entities...`, label);
      let lastProgressLog = Date.now();
      const entities = await exportAllEntities(
        { host: fw.host, port: fw.port, username: fw.username, password: fw.password, skipSslVerify: fw.skipSslVerify },
        capabilities,
        (entity, idx, total) => {
          const now = Date.now();
          if (now - lastProgressLog > 5000 || idx === 0 || idx === total - 1) {
            log.info(`[${elapsed()}]   Fetching ${entity} (${idx + 1}/${total})`, label);
            lastProgressLog = now;
          } else {
            log.debug(`Fetching ${entity} (${idx + 1}/${total})`, label);
          }
        }
      );

      const successCount = entities.filter((e) => e.success).length;
      const failedEntities = entities.filter((e) => !e.success);
      log.info(`[${elapsed()}] Retrieved ${successCount}/${entities.length} entity types`, label);
      if (failedEntities.length > 0) {
        log.warn(`[${elapsed()}] Failed entities: ${failedEntities.map((e) => `${e.entityType}(${e.error ?? "unknown"})`).join(", ")}`, label);
      }

      // Step 4: Parse
      log.info(`[${elapsed()}] Step 4/7: Parsing config...`, label);
      const sections = parseEntityResults(entities);
      const rawConfig = buildRawConfig(entities);
      log.info(`[${elapsed()}] Parsed ${Object.keys(sections).length} sections, ${Object.keys(rawConfig).length} raw entity types`, label);

      // Step 5: Analyse
      log.info(`[${elapsed()}] Step 5/7: Analysing...`, label);
      const analysis = analyseConfig(sections);
      const riskScore = computeRiskScore(analysis);
      log.info(`[${elapsed()}] Score: ${riskScore.overall}/${riskScore.grade} — ${analysis.findings.length} findings`, label);

      // Step 6: Threat telemetry
      let threatStatus: ThreatStatus | null = null;
      if (capabilities.hasAtp || capabilities.hasMdr || capabilities.hasNdr) {
        log.info(`[${elapsed()}] Step 6/7: Collecting threat telemetry...`, label);
        threatStatus = await collectThreatStatus(
          { host: fw.host, port: fw.port, username: fw.username, password: fw.password, skipSslVerify: fw.skipSslVerify },
          capabilities
        );
        log.info(`[${elapsed()}] Threat telemetry collected (ATP: ${threatStatus.atp ? "yes" : "no"}, MDR: ${threatStatus.mdr ? "yes" : "no"}, NDR: ${threatStatus.ndr ? "yes" : "no"})`, label);
      } else {
        log.info(`[${elapsed()}] Step 6/7: Skipping threat telemetry (no capabilities)`, label);
      }

      // Step 7: Submit
      log.info(`[${elapsed()}] Step 7/7: Submitting assessment...`, label);
      const payload = buildPayload(
        this.config.customerName || "",
        label, capabilities.firmwareVersion, AGENT_VERSION,
        analysis, riskScore, threatStatus, rawConfig
      );
      log.info(`[${elapsed()}] Payload size: ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB`, label);

      try {
        const result = await submitAssessment(this.client, payload);
        log.info(`[${elapsed()}] Submitted successfully${result.drift ? ` — ${result.drift.new.length} new, ${result.drift.fixed.length} fixed` : ""}`, label);
        this.updateStatus(label, {
          status: "success",
          lastScore: riskScore.overall,
          lastGrade: riskScore.grade,
          lastRun: new Date().toISOString(),
          firmwareVersion: capabilities.firmwareVersion,
        });
      } catch (err) {
        log.warn(`[${elapsed()}] API unreachable, queuing submission: ${err instanceof Error ? err.message : err}`, label);
        enqueue(this.dataDir, payload);
        this.updateStatus(label, {
          status: "success",
          lastScore: riskScore.overall,
          lastGrade: riskScore.grade,
          lastRun: new Date().toISOString(),
          firmwareVersion: capabilities.firmwareVersion,
        });
      }

      log.info(`[${elapsed()}] Scan complete for ${label}`, label);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[${elapsed()}] FAILED: ${msg}`, label);
      if (err instanceof Error && err.stack) log.debug(err.stack, label);
      this.updateStatus(label, { status: "error", error: msg });
    }

    this.emit("firewall:updated", this.firewallStatuses.get(label));
  }

  private async heartbeat(): Promise<void> {
    try {
      const res = await sendHeartbeat(this.client, {
        agent_version: AGENT_VERSION,
        firmware_version: this.lastDeviceInfo.firmwareVersion,
        serial_number: this.lastDeviceInfo.serialNumber,
        hardware_model: this.lastDeviceInfo.hardwareModel,
        customer_name: this.config.customerName || undefined,
      });
      this._heartbeatInfo = {
        lastSentAt: new Date().toISOString(),
        lastOk: true,
        lastError: undefined,
        commandReceived: this._heartbeatInfo.commandReceived,
        commandReceivedAt: this._heartbeatInfo.commandReceivedAt,
      };
      log.debug("Heartbeat sent");

      if (res.pending_command === "run-now") {
        log.info("Received run-now command from dashboard — triggering scan");
        this._heartbeatInfo.commandReceived = "run-now";
        this._heartbeatInfo.commandReceivedAt = new Date().toISOString();
        this.emit("command:run-now", null);
        this.runAll().catch((err) => {
          log.error(`Remote run-now failed: ${err instanceof Error ? err.message : err}`);
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._heartbeatInfo = {
        lastSentAt: new Date().toISOString(),
        lastOk: false,
        lastError: msg,
        commandReceived: this._heartbeatInfo.commandReceived,
        commandReceivedAt: this._heartbeatInfo.commandReceivedAt,
      };
      log.warn(`Heartbeat failed: ${msg}`);
    }
  }

  private async pollCommands(): Promise<void> {
    try {
      const res = await this.client.get<{ command: string | null }>("/api/agent/commands");
      if (res.command === "run-now") {
        log.info("Received run-now command from dashboard — triggering scan");
        this._heartbeatInfo.commandReceived = "run-now";
        this._heartbeatInfo.commandReceivedAt = new Date().toISOString();
        this.emit("command:run-now", null);
        this.runAll().catch((err) => {
          log.error(`Remote run-now failed: ${err instanceof Error ? err.message : err}`);
        });
      }
    } catch {
      // Command poll failures are non-critical; heartbeat will catch issues
    }
  }

  private async flushQueue(): Promise<void> {
    const queued = dequeueAll(this.dataDir);
    if (!queued.length) return;
    log.info(`Flushing ${queued.length} queued submissions`);
    for (const item of queued) {
      try {
        await submitAssessment(this.client, item.payload);
        removeQueued(this.dataDir, item.file);
        log.info(`Flushed queued submission: ${item.file}`);
      } catch {
        log.warn(`Failed to flush ${item.file}, will retry later`);
        break;
      }
    }
  }

  private updateStatus(label: string, update: Partial<FirewallStatus>): void {
    const current = this.firewallStatuses.get(label) ?? { label, status: "idle" as const };
    this.firewallStatuses.set(label, { ...current, ...update });
  }

  private emit(event: string, data: unknown): void {
    this.eventHandler?.(event, data);
  }
}
