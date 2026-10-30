import fs from 'node:fs';
import crypto from 'node:crypto';
import opentype from 'opentype.js';

const CACHE = new URL('../.cache/fonts/', import.meta.url);
fs.mkdirSync(CACHE, { recursive: true });

// An old user agent makes Google Fonts serve plain TTF, which opentype.js can parse.
const UA = 'Mozilla/4.0';

async function fetchTtf(family, weight, text) {
  const key = crypto.createHash('sha1').update(`${family}|${weight}|${text ?? ''}`).digest('hex').slice(0, 16);
  const file = new URL(`${key}.ttf`, CACHE);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const params = new URLSearchParams({ family: `${family}:wght@${weight}` });
  if (text) params.set('text', text);
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${params}`, { headers: { 'User-Agent': UA } })).text();
  const url = css.match(/url\((.+?)\)/)?.[1];
  if (!url) throw new Error(`No font URL for ${family} ${weight}: ${css.slice(0, 200)}`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

export async function loadFont(family, weight = 400) {
  const buf = await fetchTtf(family, weight);
  const ot = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const used = new Set(' ');
  return {
    family,
    weight,
    used,
    width(str, size, letterSpacing = 0) {
      return ot.getAdvanceWidth(String(str), size, { kerning: true }) + letterSpacing * [...String(str)].length;
    },
    has(ch) {
      return ot.charToGlyphIndex(ch) > 0;
    },
    track(str) {
      for (const ch of String(str)) used.add(ch);
    },
  };
}

/** @font-face rules with each font subset to the characters actually drawn. */
export async function fontFaces(fonts) {
  const rules = [];
  for (const f of fonts) {
    if (f.used.size <= 1) continue;
    const text = [...f.used].sort().join('');
    const buf = await fetchTtf(f.family, f.weight, text);
    rules.push(
      `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url(data:font/ttf;base64,${buf.toString('base64')}) format('truetype');}`,
    );
  }
  return rules.join('\n');
}
