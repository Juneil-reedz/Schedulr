// Builds the interface as one self-contained HTML page, for trying the app in a browser. Nothing is saved.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "preview-dist");
mkdirSync(out, { recursive: true });

execSync(`npx @tailwindcss/cli -i src/app/globals.css -o ${out}/tw.css --minify`, { cwd: root, stdio: "inherit" });

const fonts = await build({
  entryPoints: [path.join(root, "preview/fonts.css")], bundle: true, write: false, minify: true,
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
});

const js = await build({
  entryPoints: [path.join(root, "preview/main.tsx")], bundle: true, write: false, minify: true, format: "iife",
  jsx: "automatic", target: "es2020",
  alias: { "next/link": path.join(root, "preview/next-link.tsx"), "next/navigation": path.join(root, "preview/next-navigation.ts"), "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_PREVIEW": '"1"', "process.env.NEXT_PUBLIC_WEB3FORMS_KEY": JSON.stringify(process.env.PREVIEW_WEB3FORMS_KEY ?? "") },
  loader: { ".svg": "text" },
});

const css = fonts.outputFiles[0].text + readFileSync(`${out}/tw.css`, "utf8");
const script = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Schedulr preview</title><style>${css}</style></head>
<body><div id="root"></div><script>${script}</script></body></html>`;
writeFileSync(`${out}/index.html`, html);
console.log(`preview-dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
