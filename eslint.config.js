import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      // The full browser global set (performance, IntersectionObserver, ...)
      // plus the extension's chrome object.
      globals: { ...globals.browser, chrome: "readonly" },
    },
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      // The classic hooks rules. v7's full recommended set also flags
      // latest-ref writes and setState-in-effect — established patterns here
      // that the usability pass deliberately does not re-architect.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...jsxA11y.configs.recommended.rules,
      // JSX usage counts as usage; without these, imported components and
      // variables referenced only in JSX read as unused.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/netlify/functions/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        module: "writable",
        exports: "writable",
        require: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
  {
    // Build scripts and tests run in Node, not in the browser. Without this
    // the base config's browser-only globals make every `process` reference
    // a no-undef error.
    files: ["**/scripts/**/*.{js,mjs}", "**/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
