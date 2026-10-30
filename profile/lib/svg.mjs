import fs from 'node:fs';
import path from 'node:path';
import { fontFaces } from './fonts.mjs';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');

/** <text> in a tracked font; `extra` is merged into the attributes. */
export function text(font, size, str, { x = 0, y = 0, fill = '#fff', anchor, ls, cls, style, opacity, ...extra } = {}) {
  font.track(str);
  return `<text ${attrs({
    x,
    y,
    'font-family': `'${font.family}'`,
    'font-weight': font.weight,
    'font-size': size,
    fill,
    'text-anchor': anchor,
    'letter-spacing': ls,
    class: cls,
    style,
    opacity,
    ...extra,
  })}>${esc(str)}</text>`;
}

/** Several differently coloured runs on one line: parts = [[font, text, fill], ...]. */
export function spans(parts, size, { x = 0, y = 0, cls, style, anchor } = {}) {
  const inner = parts
    .map(([font, str, fill]) => {
      font.track(str);
      return `<tspan font-family="'${font.family}'" font-weight="${font.weight}" fill="${fill}">${esc(str)}</tspan>`;
    })
    .join('');
  return `<text ${attrs({ x, y, 'font-size': size, class: cls, style, 'text-anchor': anchor, 'xml:space': 'preserve' })}>${inner}</text>`;
}

export async function svgDoc({ width, height, fonts = [], css = '', defs = '', body, title }) {
  const faces = await fontFaces(fonts);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
${faces}
${css}
</style>
<defs>${defs}</defs>
${body}
</svg>
`;
}

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  const kb = (Buffer.byteLength(content) / 1024).toFixed(1);
  console.log(`  ${path.relative(process.cwd(), file)}  ${kb} KB`);
}
