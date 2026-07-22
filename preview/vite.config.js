import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

// Fashion is the only app we build and deploy (Kyle, 2026-07-22). The legacy
// credenza-v2/v3 entries (index.html + src/main.jsx) stay in the repo but are
// no longer build targets — there is no non-fashion mode anymore.
const FASHION = true;
const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Load a CommonJS Netlify function file even though this package is ESM.
// Reading + vm-evaluating on every request means edits are reflected immediately.
function loadFunction(filePath) {
  const code = readFileSync(filePath, "utf8");
  const module = { exports: {} };
  const wrapper = runInThisContext(
    `(function(exports, require, module, __filename, __dirname) {\n${code}\n})`,
    { filename: filePath, lineOffset: -1 }
  );
  wrapper(
    module.exports,
    createRequire(filePath),
    module,
    filePath,
    dirname(filePath)
  );
  return module.exports;
}

// Dev-only plugin that serves `/.netlify/functions/:name` by invoking the
// existing Netlify function handlers directly. This lets `npm run dev` run the
// full app (album/Yupoo enrichment, image relay, Weidian resolver, Ask) without
// needing `netlify-cli`.
function netlifyFunctionsDev() {
  const functionsDir = resolve(__dirname, "netlify/functions");
  return {
    name: "netlify-functions-dev",
    apply: "serve",
    config(_, { mode }) {
      const env = loadEnv(mode, __dirname, "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      if (!process.env.CREDENZA_SEARCH_SECRET && env.VITE_CREDENZA_SEARCH_SECRET) {
        process.env.CREDENZA_SEARCH_SECRET = env.VITE_CREDENZA_SEARCH_SECRET;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/.netlify/functions/")) return next();

        const name = req.url.slice("/.netlify/functions/".length).split(/[/?]/)[0];
        if (!name || !/^[a-z0-9_-]+$/i.test(name)) return next();

        const filePath = resolve(functionsDir, `${name}.js`);
        if (!existsSync(filePath)) return next();

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf8");

          const mod = loadFunction(filePath);
          const handler = mod && mod.handler;
          if (typeof handler !== "function") {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "Function has no handler" }));
            return;
          }

          const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const event = {
            httpMethod: req.method,
            headers: { ...req.headers },
            body,
            path: url.pathname,
            queryStringParameters: Object.fromEntries(url.searchParams),
            multiValueHeaders: {},
            multiValueQueryStringParameters: {},
            isBase64Encoded: false,
          };

          const result = await handler(event);
          if (!result || typeof result !== "object") {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "Invalid function response" }));
            return;
          }

          res.statusCode = result.statusCode || 200;
          if (result.headers) {
            for (const [key, value] of Object.entries(result.headers)) {
              if (value != null) res.setHeader(key, String(value));
            }
          }
          if (result.isBase64Encoded) {
            res.end(Buffer.from(result.body || "", "base64"));
          } else {
            res.end(result.body ?? "");
          }
        } catch (err) {
          console.error(`[netlify-functions-dev] ${name} failed:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "Function invocation failed" }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fashionEntryPlugin(), swPrecache(), netlifyFunctionsDev()],
  server: { port: 5173, strictPort: true, fs: { allow: [".."] } },
  build: {
    rollupOptions: {
      input: FASHION ? resolve(__dirname, "index-fashion.html") : resolve(__dirname, "index.html"),
    },
  },
});
