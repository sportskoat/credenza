import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

export default defineConfig({
  plugins: [react(), swPrecache()],
  server: { port: 5173, strictPort: true, fs: { allow: [".."] } },
});
