import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.dirname(fileURLToPath(import.meta.url)) } },
  test: { environment: "node", globals: true, include: ["tests/**/*.test.ts"] },
});
