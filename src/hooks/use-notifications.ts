/**
 * Vite resolves `.ts` before `.tsx`. After moving JSX into `use-notifications.tsx`, some dev / HMR
 * clients and caches still request `use-notifications.ts` and 404 — which prevents the app from
 * booting (white screen). Re-export keeps both URLs valid; implementation lives in `.tsx`.
 */
export * from "./use-notifications.tsx";
