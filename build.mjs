// Compila src/main.tsx → app.js (bundle minificado, sin dependencias en ejecución)
// y sincroniza el ?v= de index.html con CACHE_VERSION de sw.js.
import { build, context } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const sw = readFileSync("sw.js", "utf8");
const cv = /const CACHE_VERSION = '([^']+)'/.exec(sw)?.[1];
const av = /const APP_VERSION = '([^']+)'/.exec(sw)?.[1];
if (!cv || !av) throw new Error("No encuentro CACHE_VERSION / APP_VERSION en sw.js");
let html = readFileSync("index.html", "utf8");
html = html.replace(/(styles\.css|app\.js)\?v=[^"']*/g, `$1?v=${cv}`);
writeFileSync("index.html", html);

const options = {
  entryPoints: ["src/main.tsx"], bundle: true, minify: true, format: "iife",
  target: ["safari15", "chrome100"], outfile: "app.js", jsx: "automatic", jsxImportSource: "preact",
  legalComments: "none", logLevel: "info", define: { __APP_VERSION__: JSON.stringify(av), __CACHE_VERSION__: JSON.stringify(cv) },
};
if (process.argv.includes("--watch")) { const ctx = await context(options); await ctx.watch(); } else { await build(options); }
