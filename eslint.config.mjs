import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "dist/**",
    "dist-netlify/**",
    ".netlify/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "outputs/**",
    "work/**",
  ]),
  {
    // This Vinext application does not enable React Compiler. Its imperative
    // map gestures, server-synchronized clocks and async effect loaders predate
    // compiler adoption. Keep the runtime hooks rules enabled; opt these legacy
    // files out of compiler migration diagnostics only.
    files: ["app/parkly.tsx", "components/{admin-access,backend-account,extension-dialog,floor-booking,floor-canvas,floor-editor,hold-status,notification-settings,operator-tools,parking-session}.tsx"],
    rules: {"react-hooks/set-state-in-effect":"off","react-hooks/purity":"off","react-hooks/refs":"off","react-hooks/immutability":"off"},
  },
  {
    // Integration/VM tests intentionally inspect heterogeneous and malformed
    // wire responses; assertions, rather than compile-time claims, validate them.
    files: ["backend/tests/**/*.ts"],
    rules: {"@typescript-eslint/no-explicit-any":"off"},
  },
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
