import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    "import.meta.env.VITE_ASK_ENDPOINT": JSON.stringify(
      process.env.VITE_ASK_ENDPOINT ||
        "https://credenza-kyle.netlify.app/.netlify/functions/ask"
    ),
    // Absolute: a relative default would resolve against chrome-extension://
    "import.meta.env.VITE_PREVIEW_ENDPOINT": JSON.stringify(
      process.env.VITE_PREVIEW_ENDPOINT ||
        "https://credenza-kyle.netlify.app/.netlify/functions/preview"
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "sidepanel.html"),
    },
  },
});
