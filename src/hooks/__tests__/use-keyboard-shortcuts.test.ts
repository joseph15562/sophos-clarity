import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@/test/test-utils";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls handler on matching key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "k",
          ctrl: true,
          description: "Test",
          handler,
        },
      ]),
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler for non-matching key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "k",
          ctrl: true,
          description: "Test",
          handler,
        },
      ]),
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", ctrlKey: true, bubbles: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores shortcuts when input is focused", () => {
    const handler = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "x",
          description: "Plain key",
          handler,
        },
      ]),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with shift modifier", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        {
          key: "s",
          shift: true,
          description: "Shift+S",
          handler,
        },
      ]),
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", shiftKey: true, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
