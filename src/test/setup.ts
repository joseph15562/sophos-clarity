import "@testing-library/jest-dom";

// Provide a working in-memory localStorage for Supabase auth in the test
// environment. jsdom's built-in storage can be incomplete depending on version,
// and Supabase's `getItemAsync` blows up if `getItem` is not a function.
if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage?.getItem !== "function"
) {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Suppress expected console noise during tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("[extractSections]")) return;
  originalWarn.apply(console, args);
};

// Stub HTMLCanvasElement.getContext to avoid jsdom "not implemented" errors
// in tests that exercise PDF gauge rendering (pdfmake).
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}
