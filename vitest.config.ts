import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Escopado só à camada de domínio pura (src/lib/domain) — sem DOM, sem banco, sem mock.
// Separado do pipeline do Next.js (next.config.ts não define nada que precise coexistir).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/lib/domain/**/*.test.ts"],
  },
});
