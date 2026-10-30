// Builds the profile README windows in the Lava terminal theme into ./assets.
//   npm run build            uses cached stats in .cache/ when present
//   npm run refresh          fetches fresh stats first (what CI runs)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv.includes('--refresh')) process.env.REFRESH_STATS = '1';
process.env.PALETTE ||= 'lava';
process.env.THEME_OUT ||= path.join(here, 'assets');
await import('./terminal/build.mjs');
