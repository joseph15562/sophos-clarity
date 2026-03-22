import { describe, expect, it } from "vitest";
import { readJwtPayloadClaim } from "../jwt-payload";

describe("readJwtPayloadClaim", () => {
  it("reads role from a minimal JWT-shaped token", () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ role: "anon", exp: 9999999999 }));
    const jwt = `${header}.${payload}.sig`;
    expect(readJwtPayloadClaim(jwt, "role")).toBe("anon");
  });

  it("returns undefined for garbage", () => {
    expect(readJwtPayloadClaim("not-a-jwt", "role")).toBeUndefined();
  });
});
