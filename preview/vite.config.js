import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FASHION = process.env.VITE_CREDENZA_FASHION === "true";

// Stamps the built asset list into dist/sw.js after each build so the app
// shell, fonts, and icons are precached on install — the PWA works offline
// immediately after install, not only after every asset happens to be fetched.
function swPrecache() {
  let outDir = "dist";
  return {
    name: "credenza-sw-precache",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const assets = readdirSync(join(outDir, "assets")).map((f) => "/assets/" + f);
      const precache = [
        "/",
        "/index.html",
        ...(FASHION ? ["/index-fashion.html"] : []),
        "/manifest.webmanifest",
        "/icon-180.png",
        "/icon-192.png",
        "/icon-512.png",
        "/fonts/InterVariable.woff2",
        ...assets,
      ];
      const swPath = join(outDir, "sw.js");
      const sw = readFileSync(swPath, "utf8");
      writeFileSync(
        swPath,
        sw.replace("self.__PRECACHE_MANIFEST__", JSON.stringify(precache))
      );
    },
  };
}

function fashionEntryPlugin() {
  let outDir = "dist";
  return {
    name: "credenza-fashion-entry",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      if (!FASHION) return;
      server.middlewares.use((req, res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
          req.url = "/index-fashion.html";
        }
        next();
      });
    },
    closeBundle() {
      if (!FASHION) return;
      copyFileSync(join(outDir, "index-fashion.html"), join(outDir, "index.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), fashionEntryPlugin(), swPrecache()],
  server: { port: 5173, strictPort: true, fs: { allow: [".."] } },
  build: {
    rollupOptions: {
      input: FASHION ? resolve(__dirname, "index-fashion.html") : resolve(__dirname, "index.html"),
    },
  },
});
