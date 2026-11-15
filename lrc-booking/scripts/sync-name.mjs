import fs from "node:fs";

const config = fs.readFileSync(new URL("../js/config.js", import.meta.url), "utf8");
const match = config.match(/export const APP_NAME = "([^"]+)"/);
if (!match) throw new Error("APP_NAME was not found in js/config.js");
const name = match[1];

const root = new URL("../", import.meta.url);
const manifestPath = new URL("manifest.json", root);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.name = name;
manifest.short_name = name;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const indexPath = new URL("index.html", root);
const index = fs.readFileSync(indexPath, "utf8").replace(/<title>.*?<\/title>/, `<title>${name}</title>`);
fs.writeFileSync(indexPath, index);

const stringsPath = new URL("android/app/src/main/res/values/strings.xml", root);
const strings = fs.readFileSync(stringsPath, "utf8").replace(
  /<string name="app_name">.*?<\/string>/,
  `<string name="app_name">${name}</string>`,
);
fs.writeFileSync(stringsPath, strings);
console.log(name);
