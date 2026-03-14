import { ApiClient } from "./client";

export interface HeartbeatPayload {
  firmware_version?: string;
  agent_version: string;
  error_message?: string;
}

export interface HeartbeatResponse {
  schedule_cron: string;
  customer_name: string;
  environment: string;
  firmware_version_override: string | null;
}

export async function sendHeartbeat(
  client: ApiClient,
  payload: HeartbeatPayload
): Promise<HeartbeatResponse> {
  return client.post<HeartbeatResponse>("/api/agent/heartbeat", payload);
}
