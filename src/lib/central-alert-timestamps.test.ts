import { describe, expect, it } from "vitest";
import { centralAlertRaisedAt } from "./central-alert-timestamps";

describe("centralAlertRaisedAt", () => {
  it("uses lastModifiedAt when newer than raisedAt", () => {
    expect(
      centralAlertRaisedAt({
        raisedAt: "2026-02-01T12:00:00.000Z",
        lastModifiedAt: "2026-04-06T19:18:00.000Z",
      }),
    ).toBe("2026-04-06T19:18:00.000Z");
  });

  it("accepts epoch milliseconds as a number", () => {
    const ms = Date.parse("2026-04-05T12:00:00.000Z");
    expect(
      centralAlertRaisedAt({
        raisedAt: "2026-01-01T00:00:00.000Z",
        lastModifiedAt: ms,
      }),
    ).toBe("2026-04-05T12:00:00.000Z");
  });
});
