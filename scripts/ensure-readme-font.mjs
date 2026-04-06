/**
 * Downloads Noto Sans (full Latin + Polish diacritics) for readme-aura / Satori.
 * Inter bundled in readme-aura is Latin-only → ń, ą, ę, etc. break in SVG.
 */
import { mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const FONT_URL =
  'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const OUT_DIR = resolve(process.cwd(), '.github', 'fonts');
const OUT_FILE = resolve(OUT_DIR, 'NotoSans-Regular.ttf');

async function download() {
  mkdirSync(OUT_DIR, { recursive: true });
  const res = await fetch(FONT_URL, {
    headers: { 'User-Agent': 'jakubkalinski0-ensure-readme-font' },
  });
  if (!res.ok) throw new Error(`Font fetch ${res.status}: ${FONT_URL}`);
  const body = Readable.fromWeb(res.body);
  await pipeline(body, createWriteStream(OUT_FILE));
  console.log(`Wrote ${OUT_FILE}`);
}

async function main() {
  if (existsSync(OUT_FILE)) {
    console.log(`Font already present: ${OUT_FILE}`);
    return;
  }
  console.log('Downloading Noto Sans Regular (Latin Extended)…');
  await download();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
