import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/components/**", "src/hooks/**", "src/pages/**"],
      thresholds: {
        // Ratcheted from actual coverage — raise as tests are added.
        // Target: 60 lines / 70 functions & branches for SaaS-grade.
        lines: 15,
        statements: 15,
        functions: 38,
        branches: 57,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
