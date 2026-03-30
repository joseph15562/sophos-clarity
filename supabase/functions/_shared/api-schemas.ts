import { z } from "npm:zod@3.24.2";

/** POST /api/agent/register (JWT) */
export const agentRegisterBodySchema = z.object({
  name: z.string().min(1).max(500),
  firewall_host: z.string().min(1).max(2048),
  firewall_port: z.coerce.number().int().min(1).max(65535).optional()
    .nullable(),
  customer_name: z.string().max(500).optional().nullable(),
  environment: z.string().max(200).optional().nullable(),
  schedule_cron: z.string().max(200).optional().nullable(),
  tenant_id: z.string().max(200).optional().nullable(),
  tenant_name: z.string().max(500).optional().nullable(),
  serial_number: z.string().max(200).optional().nullable(),
  hardware_model: z.string().max(200).optional().nullable(),
  firmware_version_override: z.string().max(200).optional().nullable(),
});

export type AgentRegisterBody = z.infer<typeof agentRegisterBodySchema>;

/** POST /api/agent/heartbeat (X-API-Key) — passthrough allows forward-compatible connector fields */
export const agentHeartbeatBodySchema = z
  .object({
    error_message: z.union([z.string(), z.null()]).optional(),
    firmware_version: z.string().max(200).optional(),
    serial_number: z.string().max(200).optional(),
    hardware_model: z.string().max(200).optional(),
    customer_name: z.string().max(500).optional(),
  })
  .passthrough();

/** POST /api/agent/submit (X-API-Key) */
export const agentSubmitBodySchema = z
  .object({
    finding_titles: z.array(z.string()).optional(),
    customer_name: z.string().max(500).optional(),
    overall_score: z.coerce.number().optional(),
    overall_grade: z.string().max(16).optional(),
    firewalls: z.array(z.unknown()).optional(),
    findings_summary: z.array(z.unknown()).optional(),
    threat_status: z.unknown().optional().nullable(),
    full_analysis: z.unknown().optional().nullable(),
    raw_config: z.unknown().optional().nullable(),
  })
  .passthrough();

/** POST /api/agent/verify-identity (X-API-Key) */
export const agentVerifyIdentityBodySchema = z.object({
  email: z.string().email().max(320),
  totpCode: z.string().min(4).max(32),
});

/** POST /api/admin/reset-mfa */
export const adminResetMfaBodySchema = z.object({
  targetUserId: z.string().uuid(),
});

/** POST /api/auth/mfa-recovery */
export const authMfaRecoveryBodySchema = z.object({
  targetEmail: z.string().email().max(320),
});

const digitString = z.string().regex(
  /^\d+$/,
  "must be a non-negative integer string",
);

/** GET /api/assessments list query (`page` / `pageSize` from URL search params) */
export const assessmentsListQuerySchema = z.object({
  page: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? "1" : v),
    digitString
      .transform((s) => parseInt(s, 10))
      .pipe(z.number().int().min(1).max(1_000_000)),
  ),
  pageSize: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? "50" : v),
    digitString
      .transform((s) => parseInt(s, 10))
      .pipe(z.number().int().min(1).max(100)),
  ),
});

const uuidOrNull = z.union([z.string().uuid(), z.null()]);

/** PATCH /api/health-checks/:id/team */
export const healthCheckTeamBodySchema = z.object({
  team_id: uuidOrNull.optional(),
});

/** PATCH /api/health-checks/bulk-team */
export const healthCheckBulkTeamBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  team_id: uuidOrNull.optional(),
});

/** PATCH /api/health-checks/:id/followup */
export const healthCheckFollowupBodySchema = z.object({
  followup_at: z.union([z.string().max(64), z.null()]).optional(),
});

/** POST /api/se-teams */
export const seTeamCreateBodySchema = z.object({
  name: z.string().min(1).max(200),
});

/** PATCH /api/se-teams/:id */
export const seTeamRenameBodySchema = z.object({
  name: z.string().min(1).max(200),
});

/** POST /api/se-teams/:id/invite */
export const seTeamInviteBodySchema = z.object({
  email: z.string().email().max(320),
});

/** POST /api/se-teams/:id/transfer-admin */
export const seTeamTransferAdminBodySchema = z.object({
  target_se_profile_id: z.string().uuid(),
});

/** POST /api/passkey/register-verify */
export const passkeyRegisterVerifyBodySchema = z.object({
  credential: z.object({ id: z.string().min(1) }).passthrough(),
  name: z.string().max(120).optional(),
});

/** POST /api/connectwise/credentials */
export const connectwiseCredentialsPostSchema = z.object({
  publicMemberId: z.string().min(1).max(200),
  subscriptionKey: z.string().min(1).max(500),
  scope: z.enum(["Partner", "Distributor"]).optional(),
});

/** PUT /api/autotask-psa/company-mappings | PUT /api/connectwise-manage/company-mappings */
export const psaCompanyMappingPutSchema = z.object({
  customerKey: z.string().min(1).max(512),
  companyId: z.number().finite(),
});

/** DELETE …/company-mappings body */
export const psaCompanyMappingDeleteSchema = z.object({
  customerKey: z.string().min(1).max(512),
});

/** POST /api/autotask-psa/credentials */
export const autotaskPsaCredentialsPostSchema = z.object({
  apiZoneBaseUrl: z.string().min(1).max(2048),
  username: z.string().min(1).max(500),
  secret: z.string().optional(),
  integrationCode: z.string().optional(),
  defaultQueueId: z.number().finite(),
  defaultPriority: z.number().finite(),
  defaultStatus: z.number().finite(),
  defaultSource: z.number().finite(),
  defaultTicketType: z.number().finite(),
});

/** POST /api/autotask-psa/tickets */
export const autotaskPsaTicketPostSchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().max(200_000).optional(),
    companyId: z.number().finite().optional(),
    firecomplyCustomerKey: z.string().max(512).optional(),
    queueId: z.number().finite().optional(),
    priority: z.number().finite().optional(),
    status: z.number().finite().optional(),
    source: z.number().finite().optional(),
    ticketType: z.number().finite().optional(),
    idempotencyKey: z.string().min(1).max(512),
  })
  .refine(
    (b) =>
      !(
        b.companyId != null &&
        Number.isFinite(b.companyId) &&
        (b.firecomplyCustomerKey ?? "").trim() !== ""
      ),
    { message: "Send either companyId or firecomplyCustomerKey, not both" },
  );

/** POST /api/connectwise-manage/credentials */
export const connectwiseManageCredentialsPostSchema = z.object({
  apiBaseUrl: z.string().min(1).max(2048),
  integratorCompanyId: z.string().min(1).max(200),
  publicKey: z.string().optional(),
  privateKey: z.string().optional(),
  defaultBoardId: z.number().finite(),
  defaultStatusId: z.number().finite().optional(),
});

/** POST /api/connectwise-manage/tickets */
export const connectwiseManageTicketPostSchema = z
  .object({
    summary: z.string().min(1).max(500),
    initialDescription: z.string().max(200_000).optional(),
    customerCompanyId: z.number().finite().optional(),
    firecomplyCustomerKey: z.string().max(512).optional(),
    boardId: z.number().finite().optional(),
    statusId: z.number().finite().optional(),
    idempotencyKey: z.string().min(1).max(512),
  })
  .refine(
    (b) =>
      !(
        b.customerCompanyId != null &&
        Number.isFinite(b.customerCompanyId) &&
        (b.firecomplyCustomerKey ?? "").trim() !== ""
      ),
    {
      message:
        "Send either customerCompanyId or firecomplyCustomerKey, not both",
    },
  );
