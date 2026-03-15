import { Scheduler, type FirewallStatus, type HeartbeatInfo } from "../scheduler";
import type { AppConfig } from "../config";
import { log } from "../logger";

export class BackgroundService {
  private scheduler: Scheduler;

  constructor(config: AppConfig, dataDir: string) {
    this.scheduler = new Scheduler(config, dataDir, (event, data) => {
      log.debug(`[service] event: ${event}`);
    });
  }

  start(): void {
    this.scheduler.start();
  }

  stop(): void {
    this.scheduler.stop();
  }

  runNow(): void {
    log.info("Manual run triggered");
    this.scheduler.runAll().catch((err) => {
      log.error(`Manual run failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  togglePause(): void {
    if (this.scheduler.isPaused()) {
      this.scheduler.resume();
    } else {
      this.scheduler.pause();
    }
  }

  isPaused(): boolean {
    return this.scheduler.isPaused();
  }

  getStatuses(): FirewallStatus[] {
    return this.scheduler.getStatuses();
  }

  getHeartbeatInfo(): HeartbeatInfo {
    return this.scheduler.getHeartbeatInfo();
  }
}
