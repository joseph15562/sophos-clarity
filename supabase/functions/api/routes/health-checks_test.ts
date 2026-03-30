import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  healthCheckBulkTeamBodySchema,
  healthCheckFollowupBodySchema,
  healthCheckTeamBodySchema,
} from "../../_shared/api-schemas.ts";

Deno.test("health-checks: team body allows empty object; rejects bad team_id", () => {
  assertEquals(healthCheckTeamBodySchema.safeParse({}).success, true);
  assertEquals(
    healthCheckTeamBodySchema.safeParse({ team_id: "not-uuid" }).success,
    false,
  );
  assertEquals(
    healthCheckTeamBodySchema.safeParse({
      team_id: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true,
  );
});

Deno.test("health-checks: bulk team body", () => {
  assertEquals(
    healthCheckBulkTeamBodySchema.safeParse({ ids: [], team_id: null }).success,
    false,
  );
});

Deno.test("health-checks: followup body optional followup_at", () => {
  assertEquals(healthCheckFollowupBodySchema.safeParse({}).success, true);
  assertEquals(
    healthCheckFollowupBodySchema.safeParse({ followup_at: null }).success,
    true,
  );
});
