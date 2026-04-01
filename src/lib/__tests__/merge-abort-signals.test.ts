import { describe, it, expect, vi } from "vitest";
import { mergeAbortSignals } from "../merge-abort-signals";

describe("mergeAbortSignals", () => {
  it("returns same signal when only one input", () => {
    const a = new AbortController();
    expect(mergeAbortSignals(a.signal)).toBe(a.signal);
  });

  it("aborts merged when first source aborts", async () => {
    const a = new AbortController();
    const b = new AbortController();
    const m = mergeAbortSignals(a.signal, b.signal);
    const fn = vi.fn();
    m.addEventListener("abort", fn);
    a.abort();
    await Promise.resolve();
    expect(m.aborted).toBe(true);
    expect(fn).toHaveBeenCalled();
  });

  it("aborts merged when second source aborts", async () => {
    const a = new AbortController();
    const b = new AbortController();
    const m = mergeAbortSignals(a.signal, b.signal);
    b.abort();
    await Promise.resolve();
    expect(m.aborted).toBe(true);
  });

  it("is already aborted if an input is aborted", () => {
    const a = new AbortController();
    a.abort();
    const b = new AbortController();
    const m = mergeAbortSignals(a.signal, b.signal);
    expect(m.aborted).toBe(true);
  });
});
