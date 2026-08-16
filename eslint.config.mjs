import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // The site copy is prose-heavy and relies on plain apostrophes/quotes;
      // forcing &apos;/&quot; entities throughout would hurt readability for
      // no correctness benefit.
      "react/no-unescaped-entities": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical prototype, not part of the shipped app.
    "reference/**",
  ]),
]);

export default eslintConfig;
