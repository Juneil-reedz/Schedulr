// Writes latest.json, the file installed copies of Schedulr read to learn about a new version.
// Run in CI after the signed builds are gathered in one folder:
//   node scripts/update-feed.mjs <owner/repo> <folder>
// Each installer needs its .sig next to it. Keys follow tauri-plugin-updater: it looks for
// "{os}-{arch}-{installer}" first (so a .deb install gets the .deb), then "{os}-{arch}".
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const [repo, dir = "."] = process.argv.slice(2);
const { version } = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
// Build outputs keep their folders (nsis/, msi/, deb/, rpm/, appimage/), so look through all of them.
const paths = readdirSync(dir, { recursive: true }).map((p) => join(dir, String(p)));
const files = paths.map((p) => basename(p));
const pathOf = (name) => paths.find((p) => basename(p) === name);
const url = (name) => `https://github.com/${repo}/releases/download/v${version}/${name.replaceAll(" ", ".")}`;

const platforms = {};
const add = (test, keys) => {
  const file = files.find((f) => test(f) && files.includes(`${f}.sig`));
  if (!file) return;
  const entry = { signature: readFileSync(pathOf(`${file}.sig`), "utf8").trim(), url: url(file) };
  for (const k of keys) platforms[k] = entry;
};
add((f) => f.endsWith("-setup.exe"), ["windows-x86_64-nsis", "windows-x86_64"]);
add((f) => f.endsWith(".AppImage"), ["linux-x86_64-appimage", "linux-x86_64"]);
add((f) => f.endsWith(".deb"), ["linux-x86_64-deb"]);
add((f) => f.endsWith(".rpm"), ["linux-x86_64-rpm"]);
if (!platforms["windows-x86_64"]) throw new Error("No signed Windows installer found");

const feed = { version, notes: readFileSync("UPDATE_NOTES.md", "utf8").trim(), pub_date: new Date().toISOString(), platforms };
writeFileSync(join(dir, "latest.json"), JSON.stringify(feed, null, 2));
console.log(`latest.json for ${version}:`, Object.keys(platforms).join(", "));
