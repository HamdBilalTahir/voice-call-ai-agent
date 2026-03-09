import { globalIgnores } from "eslint/config";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  // TypeScript recommended (flat)
  ...tsPlugin.configs["flat/recommended"],

  // React
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],

  // React Hooks (manual flat config — recommended-latest uses old eslintrc format)
  {
    plugins: { "react-hooks": reactHooksPlugin },
    rules: reactHooksPlugin.configs.recommended.rules,
  },

  // JSX a11y
  jsxA11yPlugin.flatConfigs.recommended,

  // Next.js rules
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // Project-level overrides
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
];

export default eslintConfig;
