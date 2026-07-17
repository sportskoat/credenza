import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        AbortController: "readonly",
        CustomEvent: "readonly",
        chrome: "readonly",
        history: "readonly",
        crypto: "readonly",
        matchMedia: "readonly",
        getComputedStyle: "readonly",
        structuredClone: "readonly",
        createImageBitmap: "readonly",
        Event: "readonly",
        HTMLDialogElement: "readonly",
        Element: "readonly",
      },
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
];
