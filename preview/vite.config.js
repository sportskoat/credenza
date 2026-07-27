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
        "/fonts/ClashGrotesk-Variable.woff2",
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
          next();
          return;
        }
        // A static host answers /contact/ with public/contact/index.html.
        // Vite's dev server does not: it falls through to the SPA fallback,
        // so every public page rendered the app instead (Kyle, 2026-07-27:
        // "every single page takes you here, these are not routed right").
        // Resolve the directory ourselves, BEFORE the fallback runs.
        const path = (req.url || "").split("?")[0];
        if (path.endsWith("/") && path.length > 1) {
          const candidate = join(__dirname, "public", path.slice(1), "index.html");
          if (existsSync(candidate)) {
            req.url = path + "index.html";
          }
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
  // host: "127.0.0.1" because the default bound IPv6 loopback ([::1]) ONLY, so
  // http://127.0.0.1:5173 was refused while http://localhost:5173 worked
  // (Kyle, 2026-07-27). Both addresses now answer. Not "true" — that would
  // publish the dev server to every machine on the network.
  server: { host: "127.0.0.1", port: 5173, strictPort: true, fs: { allow: [".."] } },
  resolve: {
    // LB-37. The app root is `../credenza-fashion.jsx` — one level ABOVE this
    // project. Node resolves a bare import by walking up from the importing
    // file, so `import "framer-motion"` inside it looks in `<repo>/node_modules`
    // FIRST and never reaches `preview/node_modules`, where package.json
    // actually declares it.
    //
    // On this machine that accidentally worked: a stray `<repo>/node_modules`
    // has sat there since 2026-07-21. On a clean checkout there is no such
    // directory, and rollup does not treat the miss as an error — it prints
    // UNRESOLVED_IMPORT and externalises the package. The build then "succeeds"
    // with 21 modules instead of 2247 and emits a bundle importing bare
    // specifiers no browser can resolve. Every component that draws an icon or
    // animates is gone.
    //
    // So the failure mode was silent, machine-specific, and total. Aliasing
    // pins both packages to the copy this project installs, for every importer
    // at any depth, on any machine.
    alias: {
      "framer-motion": resolve(__dirname, "node_modules/framer-motion"),
      "lucide-react": resolve(__dirname, "node_modules/lucide-react"),
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
    },
  },
  build: {
    rollupOptions: {
      input: FASHION ? resolve(__dirname, "index-fashion.html") : resolve(__dirname, "index.html"),
      output: {
        // Vendor split: the framework half of the bundle caches separately and
        // downloads in parallel with the app chunk.
        //
        // LB-11: "framer-motion" is deliberately NOT in this list. Naming it
        // here forces the whole library, feature bundle included, into one
        // eager chunk. That defeats the LazyMotion split in
        // `components/motion-features.js`. Leave it out.
        manualChunks: {
          vendor: ["react", "react-dom", "lucide-react"],
        },
      },
    },
  },
});
