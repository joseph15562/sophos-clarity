import { useEffect, useCallback } from "react";

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  handler: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: ShortcutAction[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const s of shortcuts) {
      const ctrlOrMeta = s.ctrl || s.meta;
      const modMatch = ctrlOrMeta ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
      const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();

      if (keyMatch && modMatch && shiftMatch) {
        // Allow plain keys only when not in an input
        if (!ctrlOrMeta && !s.shift && isInputFocused()) continue;
        e.preventDefault();
        s.handler();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
