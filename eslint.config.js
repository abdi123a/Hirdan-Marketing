import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // mobile/ (tsc) and landing-page/ (next lint) have their own lint setups.
  { ignores: ["dist", "server/dist", "mobile", "landing-page"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // ~900 legacy `any`s: reported as warnings so `npm run lint` gates real
      // errors while the typing debt is paid down incrementally.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
