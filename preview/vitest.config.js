import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Same LB-37 pin as vite.config.js: app files live one level above preview/,
  // so bare imports must not walk to a missing <repo>/node_modules.
  resolve: {
    alias: {
      "framer-motion": resolve(__dirname, "node_modules/framer-motion"),
      "lucide-react": resolve(__dirname, "node_modules/lucide-react"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.{js,jsx}"],
  },
});
