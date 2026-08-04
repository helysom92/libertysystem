import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference-only design handoff prototype, not part of the app.
    "fn_extracted/**",
    // Unrelated projects that ended up in the same working directory, not part of this app.
    "dashboard/**",
    "_opensquad/**",
    "skills/**",
    "squads/**",
  ]),
]);

export default eslintConfig;
