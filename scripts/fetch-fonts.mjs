// Downloads the Pilcrow Rounded font files from Fontshare before `dev` and `build`.
//
// The font is licensed under the ITF Free Font License, which allows self-hosting on
// our own site but not redistributing the files through a public repository. So the
// files are gitignored and fetched from the official source instead. Anyone building
// this project gets their own copy from Fontshare and is bound by that license:
// https://www.fontshare.com/fonts/pilcrow-rounded

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/app/fonts");
const CSS_URL = "https://api.fontshare.com/v2/css?f[]=pilcrow-rounded@400,500,700&display=swap";

const wanted = [
  { weight: "400", format: "woff2" },
  { weight: "500", format: "woff2" },
  { weight: "700", format: "woff2" },
  { weight: "700", format: "ttf" }, // for the Open Graph image renderer, which can't read woff2
];
const fileFor = ({ weight, format }) => join(dir, `PilcrowRounded-${weight}.${format}`);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const missing = [];
for (const w of wanted) if (!(await exists(fileFor(w)))) missing.push(w);
if (missing.length === 0) process.exit(0);

const res = await fetch(CSS_URL);
if (!res.ok) throw new Error(`Fontshare CSS request failed: ${res.status}`);
const css = await res.text();

const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  weight: body.match(/font-weight:\s*(\d+)/)?.[1],
  urls: Object.fromEntries(
    [...body.matchAll(/url\('([^']+)'\)\s*format\('([^']+)'\)/g)].map(([, url, format]) => [
      format === "truetype" ? "ttf" : format,
      url.startsWith("//") ? `https:${url}` : url,
    ]),
  ),
}));

await mkdir(dir, { recursive: true });
for (const w of missing) {
  const url = faces.find((f) => f.weight === w.weight)?.urls[w.format];
  if (!url) throw new Error(`Fontshare didn't list Pilcrow Rounded ${w.weight} as ${w.format}`);
  const file = await fetch(url);
  if (!file.ok) throw new Error(`Font download failed (${file.status}): ${url}`);
  await writeFile(fileFor(w), Buffer.from(await file.arrayBuffer()));
  console.log(`fonts: fetched Pilcrow Rounded ${w.weight} (${w.format})`);
}
