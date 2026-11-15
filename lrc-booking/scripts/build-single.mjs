import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = {
  "assets/fonts/NotoKufiArabic-Regular.ttf": "font/ttf",
  "assets/fonts/NotoKufiArabic-Bold.ttf": "font/ttf",
  "assets/fonts/NotoNaskhArabic-Regular.ttf": "font/ttf",
  "assets/fonts/NotoNaskhArabic-Bold.ttf": "font/ttf",
  "assets/school-logo.jpg": "image/jpeg",
  "assets/moe-logo.jpg": "image/jpeg",
  "assets/oman-vision-2040.png": "image/png",
  "assets/icons/icon-192.png": "image/png",
};

const data = new Map();
for (const [rel, mime] of Object.entries(files)) {
  const bytes = fs.readFileSync(path.join(root, rel));
  data.set(rel, `data:${mime};base64,${bytes.toString("base64")}`);
}

function embed(text) {
  let out = text;
  for (const [rel, uri] of data) {
    out = out.split(rel).join(uri);
    out = out.split(`../${rel}`).join(uri);
  }
  return out.replace(/navigator\.serviceWorker\.register\([^)]*\)/g, "Promise.resolve()");
}

const built = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["js/app.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  minify: true,
  legalComments: "none",
  target: ["es2020"],
});

const css = embed(fs.readFileSync(path.join(root, "css/app.css"), "utf8"));
const js = embed(built.outputFiles[0].text);
const icon = data.get("assets/icons/icon-192.png");
const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0f5132">
  <title>مَنْهَل</title>
  <link rel="icon" href="${icon}">
  <style>${css}</style>
</head>
<body>
  <div id="app"></div>
  <script>${js}</script>
</body>
</html>
`;

const out = path.join(root, "manhal.html");
fs.writeFileSync(out, html);
const kb = Math.round(fs.statSync(out).size / 1024);
if (html.includes("assets/school-logo") || html.includes("url(assets/")) {
  throw new Error("an asset path was left outside the file");
}
console.log(`manhal.html ${kb} KB`);
