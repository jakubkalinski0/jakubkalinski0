// Static coloured ASCII of the avatar. Only the front frame is drawn.
import { esc } from './svg.mjs';

export function spinMarkup(data, { x, y, font }) {
  const { size, lh, baseline, frames } = data;
  return rowsToText(frames[0], { x, y, size, lh, baseline, font });
}

function rowsToText(rows, { x, y, size, lh, baseline, font }) {
  let out = '';
  rows.forEach((runs, ri) => {
    let cx = x;
    const parts = [];
    let px = x;
    for (const [text, fill] of runs) {
      const w = font.width(text, size);
      if (fill) {
        if (cx > px + 0.1) parts.push(gap(font, size, cx - px));
        parts.push([text, fill]);
        px = cx + w;
      }
      cx += w;
    }
    if (!parts.length) return;
    out += `<text xml:space="preserve" x="${x.toFixed(2)}" y="${(y + baseline + ri * lh).toFixed(2)}" font-size="${size}" font-family="'${font.family}'" font-weight="${font.weight}">`;
    for (const part of parts) {
      if (typeof part === 'string') {
        font.track(part);
        out += `<tspan fill="none">${part}</tspan>`;
      } else {
        font.track(part[0]);
        out += `<tspan fill="${part[1]}">${esc(part[0])}</tspan>`;
      }
    }
    out += '</text>';
  });
  return out;
}

function gap(font, size, px) {
  const w = font.width(' ', size);
  return ' '.repeat(Math.max(1, Math.round(px / w)));
}
