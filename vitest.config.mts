import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest for the BulanTanom frontend.
 *
 * Deliberately no @vitejs/plugin-react: it exists for Fast Refresh in a dev
 * server, which tests do not use, and its Babel 8 peer conflicts with the
 * Babel 7 that Next pins. Vitest transforms TSX with esbuild instead, so the
 * plugin buys nothing here and would only constrain the dependency tree.
 *
 * Named .mts so Vite loads it as an ES module; as .ts it is read as CommonJS
 * and warns about the ESM syntax below.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.tsx"],
    include: ["src/**/*.test.{ts,tsx}"],
    // The Django suite covers the backend; this must not wander into
    // node_modules or the build output looking for specs.
    exclude: ["node_modules/**", ".next/**", "backend/**"],
  },
  resolve: {
    alias: {
      // Mirrors the "@/*" path in tsconfig.json.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
