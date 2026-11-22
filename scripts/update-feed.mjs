// Writes latest.json, the file installed copies of Schedulr read to learn about a new version.
// Run in CI after a signed build: node scripts/update-feed.mjs <repo owner/name>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const repo = process.argv[2];
const { version } = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const dir = "src-tauri/target/release/bundle/nsis";
const exe = readdirSync(dir).find((f) => f.endsWith("-setup.exe"));
if (!exe) throw new Error("No NSIS installer found");
const signature = readFileSync(`${dir}/${exe}.sig`, "utf8").trim();
const notes = readFileSync("UPDATE_NOTES.md", "utf8").trim();
const feed = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repo}/releases/download/v${version}/${exe.replaceAll(" ", ".")}`,
    },
  },
};
writeFileSync("latest.json", JSON.stringify(feed, null, 2));
console.log(`latest.json for ${version} -> ${feed.platforms["windows-x86_64"].url}`);
