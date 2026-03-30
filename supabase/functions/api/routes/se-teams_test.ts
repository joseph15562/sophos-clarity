import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  seTeamCreateBodySchema,
  seTeamInviteBodySchema,
  seTeamRenameBodySchema,
  seTeamTransferAdminBodySchema,
} from "../../_shared/api-schemas.ts";

Deno.test("se-teams: create / rename require name", () => {
  assertEquals(seTeamCreateBodySchema.safeParse({ name: "" }).success, false);
  assertEquals(seTeamCreateBodySchema.safeParse({ name: "Alpha" }).success, true);
  assertEquals(seTeamRenameBodySchema.safeParse({ name: "" }).success, false);
});

Deno.test("se-teams: invite email", () => {
  assertEquals(seTeamInviteBodySchema.safeParse({ email: "bad" }).success, false);
  assertEquals(seTeamInviteBodySchema.safeParse({ email: "u@example.com" }).success, true);
});

Deno.test("se-teams: transfer-admin target id", () => {
  assertEquals(seTeamTransferAdminBodySchema.safeParse({ target_se_profile_id: "x" }).success, false);
  assertEquals(
    seTeamTransferAdminBodySchema.safeParse({
      target_se_profile_id: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true,
  );
});
