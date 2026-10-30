// Variant C: "Terminal", neofetch + git log in Tokyo Night colours, typed out on load.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFont } from '../lib/fonts.mjs';
import { text, spans, svgDoc, writeFile } from '../lib/svg.mjs';
import { spinMarkup } from '../lib/spin.mjs';
import { getStats, fmt } from '../lib/data.mjs';
import { getActivity } from '../lib/activity.mjs';
import { getExtras, PROJECT_REPOS } from '../lib/extras.mjs';

const OUT = process.env.THEME_OUT
  ? process.env.THEME_OUT.replace(/[\\/]?$/, process.platform === 'win32' ? '\\' : '/')
  : fileURLToPath(new URL('./assets/', import.meta.url));
const act = await getActivity();
// stars and followers (public repos only)
const stats = await getStats();
const paletteId = process.env.PALETTE || 'tokyo';
// Avatar recoloured into this palette (.cache/portrait-img.mjs), embedded so GitHub renders it.
// A palette with `ascii` draws that coloured ascii (.cache/ascii-hd.mjs) instead.
const cached = (file) => new URL(`../.cache/${file}`, import.meta.url);
const themedPortrait = cached(`portrait-${paletteId}.webp`);
const portrait = () =>
  `data:image/webp;base64,${fs.readFileSync(fs.existsSync(themedPortrait) ? themedPortrait : cached('portrait-tokyo.webp')).toString('base64')}`;

const M = await loadFont('JetBrains Mono', 400);
const MB = await loadFont('JetBrains Mono', 700);
const fonts = [M, MB];
const resetFonts = () => fonts.forEach((f) => (f.used.clear(), f.used.add(' ')));

const PALETTES = {
  tokyo: {
    name: 'Tokyo Night',
    bg: '#1a1b26', bar: '#16161e', border: '#2f334d', track: '#2a2e42',
    fg: '#c0caf5', dim: '#565f89', sub: '#a9b1d6',
    blue: '#7aa2f7', cyan: '#7dcfff', green: '#9ece6a', magenta: '#bb9af7',
    orange: '#ff9e64', red: '#f7768e', yellow: '#e0af68', teal: '#73daca',
    shades: ['#232433', '#2e4b37', '#4b7a3f', '#78a94f', '#9ece6a'],
  },
  mocha: {
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e', bar: '#181825', border: '#313244', track: '#313244',
    fg: '#cdd6f4', dim: '#6c7086', sub: '#a6adc8',
    blue: '#89b4fa', cyan: '#89dceb', green: '#a6e3a1', magenta: '#cba6f7',
    orange: '#fab387', red: '#f38ba8', yellow: '#f9e2af', teal: '#94e2d5',
    shades: ['#313244', '#3d5244', '#5a8a62', '#7dba8a', '#a6e3a1'],
  },
  nord: {
    name: 'Nord',
    bg: '#2e3440', bar: '#272c36', border: '#434c5e', track: '#3b4252',
    fg: '#eceff4', dim: '#616e88', sub: '#d8dee9',
    blue: '#81a1c1', cyan: '#88c0d0', green: '#a3be8c', magenta: '#b48ead',
    orange: '#d08770', red: '#bf616a', yellow: '#ebcb8b', teal: '#8fbcbb',
    shades: ['#3b4252', '#3e5348', '#5e7d62', '#81a17a', '#a3be8c'],
  },
  gruvbox: {
    name: 'Gruvbox',
    bg: '#282828', bar: '#1d2021', border: '#504945', track: '#3c3836',
    fg: '#ebdbb2', dim: '#928374', sub: '#d5c4a1',
    blue: '#83a598', cyan: '#8ec07c', green: '#b8bb26', magenta: '#d3869b',
    orange: '#fe8019', red: '#fb4934', yellow: '#fabd2f', teal: '#8ec07c',
    shades: ['#3c3836', '#4a5530', '#6a7a2c', '#8d9a28', '#b8bb26'],
  },
  kanagawa: {
    name: 'Kanagawa',
    bg: '#1f1f28', bar: '#16161d', border: '#2a2a37', track: '#2a2a37',
    fg: '#dcd7ba', dim: '#727169', sub: '#c8c093',
    blue: '#7e9cd8', cyan: '#7fb4ca', green: '#98bb6c', magenta: '#957fb8',
    orange: '#ffa066', red: '#e46876', yellow: '#e6c384', teal: '#7aa89f',
    shades: ['#2a2a37', '#3a4a38', '#56724a', '#76945c', '#98bb6c'],
  },
  synth: {
    name: 'Synthwave',
    bg: '#140018', bar: '#1e0028', border: '#6a146e', track: '#2c0838',
    fg: '#ffe6ff', dim: '#c070d0', sub: '#f0c4f8',
    blue: '#00e5ff', cyan: '#7af7ff', green: '#39ff14', magenta: '#ff2bd6',
    orange: '#ff6a00', red: '#ff2a6d', yellow: '#ffe600', teal: '#00f0ff',
    shades: ['#2c0838', '#6a1460', '#c4148a', '#ff2bd6', '#ffe600'],
  },
  paper: {
    name: 'Paper',
    bg: '#f7f1e6', bar: '#efe4d2', border: '#c9b89a', track: '#e4d5bc',
    fg: '#1c1610', dim: '#6e6254', sub: '#3a3128',
    blue: '#1d4ed8', cyan: '#0e7490', green: '#15803d', magenta: '#a21caf',
    orange: '#c2410c', red: '#be123c', yellow: '#a16207', teal: '#0f766e',
    shades: ['#e6d8c4', '#b7d7b4', '#4f9a5c', '#1f7a3a', '#14532d'],
  },
  cga: {
    name: 'CGA',
    bg: '#000000', bar: '#000000', border: '#55ffff', track: '#1a1a1a',
    fg: '#ffffff', dim: '#aaaaaa', sub: '#ffffff',
    blue: '#5555ff', cyan: '#55ffff', green: '#55ff55', magenta: '#ff55ff',
    orange: '#ffaa00', red: '#ff5555', yellow: '#ffff55', teal: '#55ffff',
    shades: ['#1a1a1a', '#005500', '#00aa00', '#55ff55', '#ffff55'],
  },
  lava: {
    name: 'Lava',
    ascii: 'ascii-hd.json',
    bg: '#140404', bar: '#1f0806', border: '#6a2014', track: '#2c100c',
    fg: '#ffe6d4', dim: '#c08068', sub: '#f6c8b0',
    blue: '#7fd0ff', cyan: '#ffd0b0', green: '#ffd24a', magenta: '#ff5c8a',
    orange: '#ff6a00', red: '#ff2a00', yellow: '#ffe14a', teal: '#ffb347',
    shades: ['#2c100c', '#7a280e', '#d24500', '#ff6a00', '#ffd24a'],
  },
  lagoon: {
    name: 'Lagoon',
    bg: '#04241f', bar: '#031916', border: '#0e5c50', track: '#0a3330',
    fg: '#e8fff6', dim: '#6aafa0', sub: '#c8f6ea',
    blue: '#3dfff2', cyan: '#7af0d2', green: '#d6ff4a', magenta: '#ff6b9a',
    orange: '#ffb45a', red: '#ff5a6a', yellow: '#ffe56a', teal: '#2ee6c7',
    shades: ['#0a3330', '#0e5c50', '#14967e', '#3dfff2', '#d6ff4a'],
  },
  c64: {
    name: 'Commodore 64',
    bg: '#352879', bar: '#2a1f66', border: '#6c5eb5', track: '#463888',
    fg: '#f4f0ff', dim: '#c4b6ee', sub: '#e4dcff',
    blue: '#9ad1ff', cyan: '#8ef6ff', green: '#c6ff8a', magenta: '#ff9adf',
    orange: '#ffc46b', red: '#ff8d8d', yellow: '#fff27a', teal: '#7dffe0',
    shades: ['#463888', '#5c6a28', '#8aaa20', '#d0e040', '#f4ff70'],
  },
  gameboy: {
    name: 'Game Boy',
    bg: '#9bbc0f', bar: '#8bac0f', border: '#0f380f', track: '#8bac0f',
    fg: '#0f380f', dim: '#306230', sub: '#0f380f',
    blue: '#0f380f', cyan: '#306230', green: '#0f380f', magenta: '#14380f',
    orange: '#306230', red: '#0f380f', yellow: '#0f380f', teal: '#306230',
    shades: ['#8bac0f', '#6b8f1a', '#4a6e14', '#306230', '#0f380f'],
  },
  taxi: {
    name: 'Taxi',
    bg: '#ffd000', bar: '#f0c200', border: '#141414', track: '#e0b000',
    fg: '#141414', dim: '#3a3a3a', sub: '#1a1a1a',
    blue: '#143c8a', cyan: '#0b5cab', green: '#0d5c1e', magenta: '#8a1048',
    orange: '#c2410c', red: '#c1121f', yellow: '#141414', teal: '#0a6b62',
    shades: ['#e6b400', '#b48a00', '#7a5c00', '#3a2c00', '#141414'],
  },
  bubble: {
    name: 'Bubblegum',
    bg: '#ffd6ea', bar: '#ffc2e0', border: '#e35aa0', track: '#f7b4d6',
    fg: '#3d0a24', dim: '#8a3a62', sub: '#5c1838',
    blue: '#3b5bdb', cyan: '#0c8599', green: '#087f5b', magenta: '#c2255c',
    orange: '#d9480f', red: '#c92a2a', yellow: '#8a5a00', teal: '#0b7285',
    shades: ['#f3b6d4', '#e070a8', '#c43b78', '#8e1848', '#4a0a28'],
  },
  toxic: {
    name: 'Toxic',
    bg: '#070800', bar: '#101400', border: '#d0f000', track: '#1c2600',
    fg: '#f4ffb0', dim: '#c6de4a', sub: '#e8ff70',
    blue: '#5ce1ff', cyan: '#e8ff4a', green: '#c6ff00', magenta: '#ff2bd6',
    orange: '#ff6a00', red: '#ff2244', yellow: '#f6ff00', teal: '#d8ff3e',
    shades: ['#1c2600', '#4a6600', '#8aaa00', '#d0f000', '#f6ff4a'],
  },
  wine: {
    name: 'Wine',
    bg: '#4a1024', bar: '#3a0c1c', border: '#8a3050', track: '#5c1830',
    fg: '#ffe8f0', dim: '#e0a0b8', sub: '#f8d0e0',
    blue: '#9fd4ff', cyan: '#ffd0e0', green: '#e7c56a', magenta: '#ff7aa2',
    orange: '#ff8a4a', red: '#ff4d6a', yellow: '#ffe08a', teal: '#f0a8c0',
    shades: ['#5c1830', '#8a2848', '#c44868', '#ff7aa2', '#ffe08a'],
  },
  cobalt: {
    name: 'Cobalt',
    bg: '#0037d6', bar: '#002db3', border: '#9ec0ff', track: '#1a4ae6',
    fg: '#ffffff', dim: '#d0e0ff', sub: '#eaf1ff',
    blue: '#b8f0ff', cyan: '#7af7ff', green: '#c6ff6a', magenta: '#ff9ad8',
    orange: '#ffc14a', red: '#ff8a8a', yellow: '#ffe14a', teal: '#7dffe0',
    shades: ['#002080', '#1a5a28', '#3d9a20', '#c6ff4a', '#fff06a'],
  },
  pool: {
    name: 'Pool',
    bg: '#8ee7ff', bar: '#74d8f5', border: '#0a4a6a', track: '#c8f4ff',
    fg: '#042433', dim: '#1a5a72', sub: '#083044',
    blue: '#043e8a', cyan: '#055a72', green: '#0b7a3a', magenta: '#c2255c',
    orange: '#e8590c', red: '#c92a2a', yellow: '#8a5a00', teal: '#0b6b62',
    shades: ['#c8f4ff', '#7ec8a0', '#2f9a62', '#0d6b3a', '#06331c'],
  },
  steel: {
    name: 'Steel',
    bg: '#e4e8ee', bar: '#d5dbe3', border: '#8b95a3', track: '#c5ced8',
    fg: '#15181d', dim: '#5c6673', sub: '#2a3038',
    blue: '#0b3d91', cyan: '#0e7490', green: '#1b7a32', magenta: '#a21caf',
    orange: '#e23d00', red: '#c81e1e', yellow: '#8a5a00', teal: '#0f766e',
    shades: ['#c5ced8', '#9bb89a', '#4f9a55', '#1f7a32', '#0e3d18'],
  },
  violet: {
    name: 'Violet',
    bg: '#6d28d9', bar: '#5b21b6', border: '#e9d5ff', track: '#7c3aed',
    fg: '#faf5ff', dim: '#eadcff', sub: '#f3e8ff',
    blue: '#bae6fd', cyan: '#67e8f9', green: '#d9f99d', magenta: '#fbcfe8',
    orange: '#fdba74', red: '#fda4af', yellow: '#fde047', teal: '#5eead4',
    shades: ['#4c1d95', '#7a3410', '#d45a10', '#fbbf24', '#fde047'],
  },
  noir: {
    name: 'Noir',
    bg: '#000000', bar: '#0a0a0a', border: '#ffffff', track: '#1c1c1c',
    fg: '#ffffff', dim: '#9a9a9a', sub: '#e8e8e8',
    blue: '#bdbdbd', cyan: '#ffffff', green: '#ffffff', magenta: '#d6d6d6',
    orange: '#8f8f8f', red: '#6e6e6e', yellow: '#f2f2f2', teal: '#c8c8c8',
    shades: ['#1a1a1a', '#4a4a4a', '#7a7a7a', '#bdbdbd', '#ffffff'],
  },
  duotone: {
    name: 'Duotone',
    bg: '#04060e', bar: '#0a1024', border: '#e07a2a', track: '#0f1d48',
    fg: '#f4efe6', dim: '#8aa0c8', sub: '#d6deee',
    blue: '#5b8cff', cyan: '#9eb6ff', green: '#ffd9a8', magenta: '#ffb07a',
    orange: '#e07a2a', red: '#ff6a3c', yellow: '#ffd9a8', teal: '#7aa2ff',
    shades: ['#0f1d48', '#1a3a8a', '#2c56c8', '#e07a2a', '#ffd9a8'],
  },
  sunset: {
    name: 'Sunset',
    bg: '#12061f', bar: '#1c0a2e', border: '#ff6a4a', track: '#2a1038',
    fg: '#fff1e4', dim: '#c49ab0', sub: '#f0d0c4',
    blue: '#ffb347', cyan: '#ffd0a8', green: '#ffeaa8', magenta: '#ff6a9a',
    orange: '#ff6a4a', red: '#c42a7a', yellow: '#ffeaa8', teal: '#ffb347',
    shades: ['#2a1038', '#6a2060', '#c42a7a', '#ff6a4a', '#ffeaa8'],
  },
  press: {
    name: 'Press',
    bg: '#ffffff', bar: '#f4f4f4', border: '#000000', track: '#e8e8e8',
    fg: '#000000', dim: '#4a4a4a', sub: '#1a1a1a',
    blue: '#5c5c5c', cyan: '#222222', green: '#000000', magenta: '#2a2a2a',
    orange: '#6a6a6a', red: '#111111', yellow: '#333333', teal: '#3a3a3a',
    shades: ['#f0f0f0', '#c4c4c4', '#8a8a8a', '#3a3a3a', '#000000'],
  },
  ivory: {
    name: 'Ivory',
    bg: '#0c0b09', bar: '#141210', border: '#f3ead8', track: '#2a261f',
    fg: '#f6efe2', dim: '#b5a48c', sub: '#e6dcc8',
    blue: '#e6dcc8', cyan: '#f6efe2', green: '#fff8ee', magenta: '#d9cdb8',
    orange: '#c4b49a', red: '#a89880', yellow: '#fff3e0', teal: '#efe4d2',
    shades: ['#2a261f', '#5c5346', '#8a7d68', '#c4b49a', '#f6efe2'],
  },
  cream: {
    name: 'Cream',
    bg: '#f6e7c1', bar: '#f0dcae', border: '#1a140c', track: '#e8d4a4',
    fg: '#1a140c', dim: '#5c4e3a', sub: '#2c2418',
    blue: '#3a3024', cyan: '#2c2418', green: '#1a140c', magenta: '#4a3c2c',
    orange: '#6a563c', red: '#140f0a', yellow: '#3a3024', teal: '#4a3e30',
    shades: ['#f0dcae', '#d4bc88', '#8a7048', '#4a3820', '#1a140c'],
  },
  hearth: {
    name: 'Hearth',
    bg: '#0c0604', bar: '#140806', border: '#ff6a1a', track: '#2a120c',
    fg: '#fff6ea', dim: '#e4c2a4', sub: '#f8e2cc',
    blue: '#ffb088', cyan: '#ffe7d0', green: '#ffd56a', magenta: '#ff8f66',
    orange: '#ff5a00', red: '#ff3b1a', yellow: '#ffe7c2', teal: '#ffc48a',
    shades: ['#2a120c', '#8a3010', '#e04a00', '#ff8a2a', '#ffd56a'],
  },
  phosphor: {
    name: 'Phosphor',
    bg: '#000000', bar: '#001408', border: '#00ff41', track: '#002808',
    fg: '#f4fff0', dim: '#8ec89a', sub: '#d4f5d0',
    blue: '#7fd0ff', cyan: '#5dfff0', green: '#39ff14', magenta: '#ff5cff',
    orange: '#ff9a3c', red: '#ff5a6a', yellow: '#ffe14a', teal: '#2ee6c7',
    shades: ['#001a08', '#00a030', '#00e040', '#39ff14', '#c8ffb0'],
  },
  amber: {
    name: 'Amber',
    bg: '#000000', bar: '#140e00', border: '#ffcc00', track: '#1c1400',
    fg: '#fff6e0', dim: '#c4a06a', sub: '#ffe0b0',
    blue: '#7fd0ff', cyan: '#ffd0a0', green: '#ffe14a', magenta: '#ff5c8a',
    orange: '#ffaa00', red: '#ff4d2a', yellow: '#ffcc00', teal: '#ffb347',
    shades: ['#1c1400', '#a06800', '#e6a000', '#ffcc00', '#fff1a8'],
  },
  argon: {
    name: 'Argon',
    bg: '#000000', bar: '#001418', border: '#00fff0', track: '#002428',
    fg: '#f2fffc', dim: '#7ec4bc', sub: '#c8f6f0',
    blue: '#7fd0ff', cyan: '#00fff0', green: '#d6ff4a', magenta: '#ff6ad5',
    orange: '#ffb45a', red: '#ff5a6a', yellow: '#ffe56a', teal: '#2ee6c7',
    shades: ['#00181c', '#00a098', '#00e6d8', '#00fff0', '#d8fffb'],
  },
  radium: {
    name: 'Radium',
    bg: '#000000', bar: '#101400', border: '#e8ff2a', track: '#141c00',
    fg: '#f8ffe8', dim: '#b4c878', sub: '#e4f0b0',
    blue: '#7fd0ff', cyan: '#a8ffd0', green: '#d6ff00', magenta: '#ff5cff',
    orange: '#ff9a3c', red: '#ff6a4a', yellow: '#e8ff2a', teal: '#7dff6a',
    shades: ['#141c00', '#6a8800', '#c6ee00', '#e8ff2a', '#f6ffb0'],
  },
  neon: {
    name: 'Neon',
    bg: '#000000', bar: '#180010', border: '#ff00cc', track: '#240018',
    fg: '#fff0f8', dim: '#d090b8', sub: '#ffc4ee',
    blue: '#7fd0ff', cyan: '#5dfff0', green: '#d6ff4a', magenta: '#ff2bd6',
    orange: '#ff9a3c', red: '#ff5a8a', yellow: '#ffe14a', teal: '#ff6ae0',
    shades: ['#240018', '#a00070', '#ff00aa', '#ff2bd6', '#ffd0f4'],
  },
  uv: {
    name: 'Ultraviolet',
    bg: '#000000', bar: '#12001c', border: '#c44dff', track: '#1c0030',
    fg: '#f6f0ff', dim: '#b090d0', sub: '#e4ccff',
    blue: '#7aa2ff', cyan: '#a8f0ff', green: '#d6ff4a', magenta: '#ff6ad5',
    orange: '#ff9a6a', red: '#ff5c8a', yellow: '#ffe14a', teal: '#c44dff',
    shades: ['#1c0030', '#6a18b0', '#b44dff', '#d070ff', '#f0d0ff'],
  },
  frost: {
    name: 'Frost',
    bg: '#000000', bar: '#000814', border: '#6ec8ff', track: '#001428',
    fg: '#f4f9ff', dim: '#8eb4d4', sub: '#d4e8ff',
    blue: '#4db8ff', cyan: '#9fd8ff', green: '#d6ff4a', magenta: '#ff6ad5',
    orange: '#ffb45a', red: '#ff6a80', yellow: '#ffe14a', teal: '#6ec8ff',
    shades: ['#001428', '#1a6098', '#4db8ff', '#8ed4ff', '#ffffff'],
  },
  crimson: {
    name: 'Crimson',
    bg: '#000000', bar: '#180008', border: '#ff1744', track: '#24000c',
    fg: '#ffe8ec', dim: '#e09098', sub: '#ffc4cc',
    blue: '#7fd0ff', cyan: '#ffd0b0', green: '#ffd24a', magenta: '#ff5c8a',
    orange: '#ff6a00', red: '#ff2a3a', yellow: '#ffe14a', teal: '#ffb347',
    shades: ['#24000c', '#a01030', '#ff1744', '#ff3355', '#ffd0d8'],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    bg: '#05010d', bar: '#0c0218', border: '#00f0ff', track: '#140824',
    fg: '#f6f2ff', dim: '#b09ad0', sub: '#e4d8ff',
    blue: '#4d7cff', cyan: '#00f0ff', green: '#d6ff00', magenta: '#ff2bd6',
    orange: '#ff6a00', red: '#ff2a6d', yellow: '#fcee0a', teal: '#00ffc8',
    shades: ['#140824', '#6a1460', '#ff2bd6', '#00f0ff', '#fcee0a'],
  },
  mrrobot: {
    name: 'Mr. Robot',
    bg: '#070808', bar: '#120406', border: '#ff1f1f', track: '#141816',
    fg: '#f4f4f2', dim: '#9aa39c', sub: '#d8ded8',
    blue: '#8eb4d4', cyan: '#9fd8d0', green: '#3dff6a', magenta: '#ff4d4d',
    orange: '#e0a15a', red: '#ff1f1f', yellow: '#e6e07a', teal: '#6ec8b8',
    shades: ['#101410', '#0d4a22', '#14963a', '#3dff6a', '#d8ffd0'],
  },
  matrix: {
    name: 'Matrix',
    bg: '#000000', bar: '#001408', border: '#00ff41', track: '#00280e',
    fg: '#e7ffe4', dim: '#7dca88', sub: '#c8f5c4',
    blue: '#3d7eff', cyan: '#7dffb0', green: '#00ff41', magenta: '#ff2a2a',
    orange: '#5dff78', red: '#ff1744', yellow: '#ffe14a', teal: '#00e676',
    shades: ['#001a08', '#007a28', '#00c83c', '#00ff41', '#b6ffb0'],
  },
  fallout: {
    name: 'Fallout',
    bg: '#10160c', bar: '#182210', border: '#c6ff4a', track: '#1c2814',
    fg: '#f3ffe6', dim: '#a3b88a', sub: '#dce8c4',
    blue: '#5aa7ff', cyan: '#d6ff6a', green: '#9cff2e', magenta: '#ff9a3c',
    orange: '#e07030', red: '#ff4d3a', yellow: '#ffe56a', teal: '#7dff6a',
    shades: ['#1c2814', '#3d6a18', '#7cb828', '#c6ff4a', '#f0ffc8'],
  },
  blade: {
    name: 'Blade Runner',
    bg: '#071416', bar: '#0c1c20', border: '#2ec4b6', track: '#102428',
    fg: '#e8f6f4', dim: '#7aa8a4', sub: '#c8e8e4',
    blue: '#4aa8c8', cyan: '#3dffe0', green: '#ffb020', magenta: '#ff6a1a',
    orange: '#ff8a2a', red: '#ff4d2a', yellow: '#ffc14a', teal: '#ffd0a0',
    shades: ['#0c2428', '#146870', '#2ec4b6', '#ff8a2a', '#ffc14a'],
  },
  dune: {
    name: 'Dune',
    bg: '#120e0a', bar: '#1c140c', border: '#e8843a', track: '#24180e',
    fg: '#f8efe0', dim: '#b8a48c', sub: '#eadcc4',
    blue: '#3d6bff', cyan: '#f0d9a0', green: '#8a9a62', magenta: '#ff6a2a',
    orange: '#e8843a', red: '#c4502a', yellow: '#ffe7a8', teal: '#6a8f78',
    shades: ['#24180e', '#6a4420', '#c4783a', '#e8a05a', '#f6e2b8'],
  },
  wars: {
    name: 'Star Wars',
    bg: '#000000', bar: '#0c0c0c', border: '#ffe81f', track: '#1a1604',
    fg: '#f7f3e4', dim: '#b8b09a', sub: '#e6dcc0',
    blue: '#4da6ff', cyan: '#9fd4ff', green: '#5dff6a', magenta: '#ff3b3b',
    orange: '#ff8a2a', red: '#ff2a2a', yellow: '#ffe81f', teal: '#d0d8e8',
    shades: ['#1a1604', '#7a6810', '#d4b40a', '#ffe81f', '#fff6c4'],
  },
};
const paletteName = process.env.PALETTE || 'tokyo';
const T = PALETTES[paletteName];
if (!T) throw new Error(`Unknown palette ${paletteName}`);

const css = `
text{font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0}
@keyframes show{from{opacity:0}to{opacity:1}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes gone{from{opacity:1}to{opacity:0}}
.show{animation:show .01s linear both}
.gone{animation:gone .01s linear both}
.cursor{animation:blink 1s steps(1,end) infinite}
`;

const W = 880;
const PAD = 24;
const SIZE = 14;
const CH = M.width('M', SIZE);

function chrome(h, title) {
  return `<rect x=".5" y=".5" width="${W - 1}" height="${h - 1}" rx="12" fill="${T.bg}" stroke="${T.border}"/>
<path d="M12.5 .5H${W - 12.5}A12 12 0 0 1 ${W - 0.5} 12.5V36H.5V12.5A12 12 0 0 1 12.5 .5Z" fill="${T.bar}"/>
<line x1=".5" y1="36" x2="${W - 0.5}" y2="36" stroke="${T.border}"/>
<circle cx="22" cy="18" r="6" fill="${T.red}"/><circle cx="42" cy="18" r="6" fill="${T.yellow}"/><circle cx="62" cy="18" r="6" fill="${T.green}"/>
${text(M, 12, title, { x: W / 2, y: 22, fill: T.dim, anchor: 'middle' })}`;
}

const prompt = () => [
  [MB, '~', T.blue],
  [MB, ' ❯ ', T.magenta],
];

/** A prompt line whose command is typed out from `start` seconds, one character per `cps`. */
function typed(y, cmd, start, cps = 0.07) {
  const px = PAD + CH * 4;
  const w = M.width(cmd, SIZE);
  const dur = cmd.length * cps;
  const id = `t${Math.round(y)}`;
  return {
    end: start + dur,
    svg: `<style>
@keyframes ${id}{from{transform:translateX(0)}to{transform:translateX(${w + CH}px)}}
.${id}{animation:${id} ${dur.toFixed(2)}s steps(${cmd.length},end) ${start.toFixed(2)}s both}
</style>
<g class="show" style="animation-delay:${Math.max(0, start - 0.5).toFixed(2)}s">
${spans([...prompt(), [M, cmd, T.fg]], SIZE, { x: PAD, y })}
<g class="gone" style="animation-delay:${(start + dur + 0.2).toFixed(2)}s"><g class="${id}"><rect x="${px}" y="${y - 16}" width="${w + CH + 2}" height="22" fill="${T.bg}"/><rect class="cursor" x="${px}" y="${y - 14}" width="${CH}" height="18" fill="${T.fg}" opacity=".8"/></g></g>
</g>`,
  };
}

const show = (delay, inner) => `<g class="show" style="animation-delay:${delay.toFixed(2)}s">${inner}</g>`;

async function emit(name, title, h, body) {
  for (const f of fonts) {
    const missing = [...f.used].filter((ch) => !f.has(ch));
    if (missing.length) console.warn(`  ${name}: ${f.family} ${f.weight} lacks ${missing.join(' ')}`);
  }
  writeFile(`${OUT}${name}.svg`, await svgDoc({ width: W, height: h, fonts, css, body, title }));
  resetFonts();
}

// ---------------------------------------------------------------- neofetch
{
  let y = 36 + 34;
  let body = '';
  const c1 = typed(y, 'neofetch', 0.5);
  body += c1.svg;
  let t = c1.end + 0.25;

  // the avatar, in this palette's colours
  const top = y + 22;
  const ay = top - 2;
  const artW = 290;
  const artH = 290;
  if (T.ascii) {
    // coloured ascii of the original picture, straight on the window like a neofetch logo
    const art = JSON.parse(fs.readFileSync(cached(T.ascii), 'utf8'));
    body += show(
      t,
      spinMarkup(art, {
        x: PAD + (artW - art.cols * art.cw) / 2,
        y: ay + (artH - art.rows * art.lh) / 2,
        font: art.weight === 700 ? MB : M,
      }),
    );
  } else {
    body += show(t, `<image x="${PAD}" y="${ay}" width="${artW}" height="${artH}" href="${portrait()}"/>`);
  }

  // info column
  const ix = PAD + artW + 28;
  const info = [
    ['Role', 'Full-stack & Research/HPC Software Engineer'],
    ['Work 2', 'PSI Radiation Metrology · Jul 2026 -> Sep 2026'],
    ['Work 1', 'Software Mansion · Jul 2025 -> Jun 2026'],
    ['Edu', 'B.Eng. Computer Science · AGH Kraków'],
    ['Thesis', 'IonTracks: ion recombination on HPC'],
    ['Langs', 'Python · TypeScript · C · Java · Rust · SQL'],
    ['Stack', 'React Native · React · FastAPI · Docker'],
    ['HPC', 'MPI · SLURM · Numba · FEniCSx · CuPy GPU'],
    ['Hair', '404 Not Found'],
  ];
  const lh = 25;
  let iy = top + 4;
  body += show(t, spans([[MB, 'jakub', T.blue], [M, '@', T.fg], [MB, 'kalinski', T.blue]], SIZE, { x: ix, y: iy }));
  iy += lh * 0.8;
  body += show(t + 0.05, text(M, SIZE, '─'.repeat(14), { x: ix, y: iy, fill: T.dim }));
  iy += lh;
  info.forEach(([k, v], i) => {
    const kc = [T.cyan, T.magenta, T.green, T.yellow, T.orange, T.blue, T.teal, T.red, T.cyan, T.magenta, T.green][i];
    if (ix + M.width(k.padEnd(9) + v, SIZE) > W - PAD) console.warn(`  neofetch: "${v}" runs past the window`);
    body += show(t + 0.1 + i * 0.06, spans([[MB, k.padEnd(9), kc], [M, v, k === 'Hair' ? T.red : T.fg]], SIZE, { x: ix, y: iy }));
    iy += lh;
  });
  // in place of neofetch's colour blocks, a status bar: how long I have been coding, and where I am
  {
    // coding since the third year of secondary school, not since the GitHub account (Aug 2024)
    const since = new Date('2021-09-01T00:00:00Z');
    const now = new Date();
    const months = (now.getUTCFullYear() - since.getUTCFullYear()) * 12 + now.getUTCMonth() - since.getUTCMonth() - (now.getUTCDate() < since.getUTCDate() ? 1 : 0);
    const up = [Math.floor(months / 12) && `${Math.floor(months / 12)}y`, months % 12 && `${months % 12}m`].filter(Boolean).join(' ');
    const started = since.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const segs = [
      ['uptime', `${up} coding · since ${started}`, T.orange],
      ['loc', 'Kraków · UTC+1', T.cyan],
    ];
    let sx = ix;
    let bar = '';
    for (const [label, value, color] of segs) {
      const lw = MB.width(label, 11) + 12;
      bar += `<rect x="${sx}" y="${iy - 8}" width="${lw}" height="18" rx="4" fill="${color}"/>`;
      bar += text(MB, 11, label, { x: sx + lw / 2, y: iy + 5, fill: T.bg, anchor: 'middle' });
      bar += text(M, 12, value, { x: sx + lw + 8, y: iy + 5, fill: T.sub });
      sx += lw + 8 + M.width(value, 12) + 18;
    }
    if (sx - 18 > W - PAD) console.warn('  neofetch: status bar runs past the window');
    body += show(t + 0.8, bar);
  }
  y = Math.max(ay + artH, iy + 12) + 30;
  t += 1.4;

  const c2 = typed(y, 'cat now.md', t);
  body += c2.svg;
  t = c2.end + 0.25;
  y += 28;
  const now = [
    ['building ', 'IonTracks3', ': full-fledged recombination simulator with new RDD model'],
    ['writing my ', 'B.Eng. thesis', ' at AGH, defence in early 2027'],
    ['cooking up a startup: ', 'Autark', ', a marketplace where AI agents trade with each other'],
  ];
  now.forEach(([a, b, c], i) => {
    if (PAD + M.width(`› ${a}${b}${c}`, SIZE) > W - PAD) console.warn(`  neofetch: now.md "${b}" runs past the window`);
    body += show(t + i * 0.12, spans([[MB, '› ', T.green], [M, a, T.sub], [MB, b, T.yellow], [M, c, T.sub]], SIZE, { x: PAD, y: y + i * 24 }));
  });
  y += now.length * 24 + 16;
  t += 0.6;
  body += show(t, spans(prompt(), SIZE, { x: PAD, y }) + `<rect class="cursor" x="${PAD + CH * 4}" y="${y - 14}" width="${CH}" height="18" fill="${T.fg}" opacity=".8"/>`);
  const H = y + 26;
  await emit('neofetch', 'jakub@kalinski: neofetch', H, chrome(H, 'jakub@krakow: ~') + body);
}

// ---------------------------------------------------------------- career timeline (journey, terminal style)
function careerTimeline(y, start) {
  const S = 12;
  const CW = M.width('M', S);
  const t0 = [2023, 9];
  const mi = (y, m) => (y - t0[0]) * 12 + (m - t0[1]);
  const PER = 2;
  // "now" comes from the build date; the axis keeps 43 months and rolls forward once now gets close to its end
  const today = new Date();
  const nowAbs = mi(today.getUTCFullYear(), today.getUTCMonth() + 1) + today.getUTCDate() / 31;
  const MONTHS = 43;
  const first = Math.max(0, Math.max(mi(2027, 3), Math.floor(nowAbs) + 5) - MONTHS + 1);
  const at = (y, m) => mi(y, m) - first;
  const nowIdx = nowAbs - first;
  // an end of null means ongoing: the bar runs to the end of the axis
  const rows = [
    ['AGH', 'B.Eng. CS', [2023, 10], [2027, 2], T.magenta],
    ['WRSS', 'student council', [2024, 10], [2026, 6], T.yellow],
    ['BIT', 'game-theory AI', [2024, 11], [2025, 10], T.red],
    ['SWM', 'New Expensify', [2025, 7], [2026, 6], T.blue],
    ['ion-tracks', 'thesis -> v3', [2025, 11], null, T.green],
    ['PSI', 'rad. metrology', [2026, 7], [2026, 9], T.orange],
    ['freelance', 'client projects', [2026, 10], null, T.cyan],
  ];
  // the label column fits the longest description, so no label pushes its bar off the axis
  const LABEL = 11 + Math.max(...rows.map(([, desc]) => desc.length)) + 1;
  const miles = [
    [[2025, 3], 'hackathon win', T.yellow],
    [[2026, 3], 'odometer shipped', T.blue],
    [[2026, 4], 'KU KDM talk', T.green],
  ].filter(([[yy, mm]]) => at(yy, mm) >= 0);
  let body = '';
  const c = typed(y, 'career --timeline', start, 0.05);
  body += c.svg;
  let t = c.end + 0.25;
  y += 32;
  const x0 = PAD + LABEL * CW;
  const X = (idx) => x0 + idx * PER * CW;

  let header = '';
  for (let yr = 2024; at(yr, 1) < MONTHS; yr++) if (at(yr, 1) >= 0) header += text(M, S, String(yr), { x: X(at(yr, 1)), y, fill: T.dim });
  body += show(t, header);
  const top = y + 8;
  y += 24;
  rows.forEach(([name, desc, [ys, ms], end, color], i) => {
    const a = Math.max(0, at(ys, ms));
    const b = Math.min(MONTHS, end ? at(...end) + 1 : MONTHS);
    if (b <= a) return;
    const past = Math.max(0, Math.min(b, Math.ceil(nowIdx)) - a);
    const future = b - a - past;
    // the bar is placed by its own x, so it lines up with the axis whatever the label width
    const line =
      spans([[MB, name.padEnd(11), color], [M, desc, T.dim]], S, { x: PAD, y }) +
      spans([[M, '█'.repeat(past * PER), color], [M, '░'.repeat(future * PER), color]], S, { x: X(a), y });
    body += show(t + i * 0.08, line);
    y += 22;
  });
  // milestones on an axis
  const axis = '─'.repeat(MONTHS * PER);
  body += show(t + 0.5, text(M, S, axis, { x: x0, y, fill: T.border }));
  for (const [[yy, mm], , color] of miles) body += show(t + 0.6, text(MB, S, '◆', { x: X(at(yy, mm)), y: y + 1, fill: color }));
  const bottom = y;
  y += 26;
  const legend = miles.flatMap(([, label, color], i) => [
    [MB, `${i ? '    ' : ''}◆ `, color],
    [M, label, T.sub],
  ]);
  body += show(t + 0.7, spans(legend, S, { x: x0, y }));
  // now marker, drawn after the bars have been revealed
  const nx = X(nowIdx);
  const reveal = `<style>@keyframes draw{from{transform:translateX(0)}to{transform:translateX(${MONTHS * PER * CW}px)}}
.draw{animation:draw 1.6s steps(${MONTHS},end) ${t.toFixed(2)}s both}</style>
<rect class="draw" x="${x0}" y="${top}" width="${MONTHS * PER * CW + 4}" height="${bottom - top - 12}" fill="${T.bg}"/>`;
  body += reveal;
  // each milestone runs up through every row, so it reads against all of them
  const guides = miles
    .map(([[yy, mm], , color]) => {
      const mx = X(at(yy, mm)) + CW / 2;
      return `<line x1="${mx}" y1="${top - 2}" x2="${mx}" y2="${bottom - 10}" stroke="${color}" stroke-opacity=".55" stroke-dasharray="1 3"/>`;
    })
    .join('');
  body += show(
    t + 1.7,
    guides +
      `<line x1="${nx}" y1="${top - 2}" x2="${nx}" y2="${bottom - 4}" stroke="${T.green}" stroke-dasharray="3 3"/>` +
      text(MB, 10, 'now', { x: nx, y: top - 26, fill: T.green, anchor: 'middle' }),
  );
  return { body, y, t: t + 1.7 };
}

// ---------------------------------------------------------------- career as a real branched git log
// .cache/career-graph.txt is genuine `git log --graph` output (.cache/career-graph.mjs), with git's lane colours.
function careerGraph(y, start) {
  const KIND = { feat: T.green, fix: T.red, perf: T.orange, docs: T.blue, init: T.magenta };
  const ANSI = { 31: T.red, 32: T.green, 33: T.yellow, 34: T.blue, 35: T.magenta, 36: T.cyan };
  const log = fs.readFileSync(new URL('../.cache/career-graph.txt', import.meta.url), 'utf8').trimEnd().split('\n');
  const SGR = /\x1b\[[0-9;]*m/g;
  const clean = (str) => str.replace(SGR, '');
  const S = 13;
  const ROW = 21;
  let body = '';
  const c1 = typed(y, 'git log --graph --all --decorate --oneline', start, 0.035);
  body += c1.svg;
  const t0 = c1.end + 0.2;
  y += 32;
  log.forEach((raw, i) => {
    const [lead, refs = '', subject = '', date = ''] = raw.split('\x1f');
    const hash = raw.includes('\x1f') ? clean(lead).match(/[0-9a-f]{7}$/)[0] : '';
    // graph characters in git's colours, up to where the hash starts
    const graphLen = clean(lead).length - hash.length;
    const parts = [];
    let fill = T.fg;
    let seen = 0;
    for (const tok of lead.split(/(\x1b\[[0-9;]*m)/)) {
      if (!tok || seen >= graphLen) continue;
      const code = tok.match(/^\x1b\[(?:1;)?(\d*)m$/);
      if (code) fill = ANSI[code[1]] ?? T.fg;
      else {
        const piece = tok.slice(0, graphLen - seen);
        parts.push([MB, piece, fill]);
        seen += piece.length;
      }
    }
    let line = '';
    if (hash) {
      parts.push([M, `${hash} `, T.yellow]);
      const r = clean(refs);
      if (r) {
        parts.push([M, '(', T.yellow]);
        r.split(', ').forEach((ref, k) => {
          if (k) parts.push([M, ', ', T.yellow]);
          const [head, branch] = ref.split(' -> ');
          if (branch) parts.push([MB, head, T.cyan], [M, ' -> ', T.yellow], [MB, branch, T.green]);
          else parts.push([MB, ref, T.green]);
        });
        parts.push([M, ') ', T.yellow]);
      }
      const m = subject.match(/^(\w+)(\([^)]*\)): (.*)$/);
      if (m) parts.push([MB, m[1], KIND[m[1]] ?? T.fg], [M, `${m[2]}: `, T.dim], [M, m[3], T.fg]);
      else parts.push([M, subject, T.dim]);
      line = text(M, 12, clean(date), { x: W - PAD, y, fill: T.dim, anchor: 'end' });
    }
    body += show(t0 + i * 0.05, spans(parts, S, { x: PAD, y }) + line);
    y += ROW;
  });
  return { body, y, t: t0 + log.length * 0.05 };
}

// ---------------------------------------------------------------- contributions
const counts = act.calendar.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
const q = (p) => counts[Math.floor(p * (counts.length - 1))] ?? 1;
const cuts = [q(0.25), q(0.5), q(0.75)];
const level = (n) => (n === 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);
const shades = T.shades;

/** `gh stats --all-time` under the graph: totals by type, then all-time contributions, stars, lines and streaks. */
function allTimeStats(y, t) {
  let body = '';
  const c2 = typed(y, 'gh stats --all-time', t, 0.05);
  body += c2.svg;
  t = c2.end + 0.25;
  y += 32;
  const rows = [
    ['commits', act.totals.commits, T.green],
    ['in private repos', act.totals.restricted, T.magenta],
    ['pull requests', act.totals.prs, T.blue],
    ['reviews', act.totals.reviews, T.cyan],
    ['issues', act.totals.issues, T.yellow],
    ['new repos', act.totals.repos, T.orange],
  ].filter(([, n]) => n > 0);
  const max = Math.max(...rows.map(([, n]) => n));
  const BAR = 40;
  rows.forEach(([label, n, color], i) => {
    const full = Math.max(1, Math.round((n / max) * BAR));
    body += show(
      t + i * 0.1,
      spans([[M, label.padEnd(17), T.sub], [MB, fmt(n).padStart(6), color], [M, '  ', T.fg], [M, '█'.repeat(full), color], [M, '░'.repeat(BAR - full), T.track]], 13, { x: PAD, y }),
    );
    y += 22;
  });
  y += 8;
  body += show(t + rows.length * 0.1, text(M, 13, '─'.repeat(63), { x: PAD, y: y - 6, fill: T.border }));
  y += 14;
  const s = act.streak;
  const best = new Date(act.best.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const sinceLabel = new Date(act.since + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const summary = [
    [[M, 'contributions'.padEnd(17), T.sub], [MB, fmt(act.totals.contributions), T.fg], [M, ' all time · since ', T.dim], [M, sinceLabel, T.yellow]],
    [[M, 'stars'.padEnd(17), T.sub], [MB, `* ${fmt(stats.stars)}`, T.yellow], [M, ' on my public repos · ', T.dim], [MB, fmt(stats.followers), T.fg], [M, ' followers', T.dim]],
    [[M, 'lines'.padEnd(17), T.sub], [MB, `+${fmt(act.lines.added)}`, T.green], [M, '  ', T.fg], [MB, `−${fmt(act.lines.deleted)}`, T.red], [M, ` in ${act.lines.repos} repos`, T.dim]],
    [[M, 'streak'.padEnd(17), T.sub], [MB, `${s.current} days`, T.orange], [M, ` now · longest ${s.longest} · best day `, T.dim], [MB, String(act.best.count), T.orange], [M, ` (${best})`, T.dim]],
  ];
  summary.forEach((p, i) => {
    body += show(t + rows.length * 0.1 + 0.15 + i * 0.1, spans(p, 13, { x: PAD, y }));
    y += 22;
  });
  y += 14;
  return { body, y, t: t + 0.6 };
}

// isometric contribution graph, then the all-time stats. `amp` is how far each shade jumps.
function contribGraph(y, start) {
  const cmd = 'gh contrib --graph --3d --pistons';
  const note = ' contributions in the last year';
  const amp = [0, 4, 10, 22, 38];
  let body = '';
  let style = '';
  const c1 = typed(y, cmd, start, 0.04);
  body += c1.svg;
  const t = c1.end + 0.25;
  const firstDow = new Date(act.calendar[0].date + 'T00:00:00Z').getUTCDay();
  const cells = act.calendar.map((d, k) => ({ ...d, i: Math.floor((k + firstDow) / 7), j: (k + firstDow) % 7 }));
  const NI = cells[cells.length - 1].i + 1;
  // ground grid spanned by u (one week, to the right) and v (one weekday, towards the viewer)
  const u = [15, 0];
  const v = [-1.5, 15];
  const BASE = [0.5, 1, 1.5, 2, 2.5];
  const AMP = amp;
  const HM = BASE[4] + AMP[4];
  const ox = (W - (NI * u[0] - 7 * v[0])) / 2 - 7 * v[0];
  // headroom so the tallest jump ends where the current version's jump ends
  const oy = y + 34 + Math.max(0, AMP[4] - 11);
  const at = (i, j) => [ox + i * u[0] + j * v[0], oy + i * u[1] + j * v[1]];
  const deg = (dx, dy) => (Math.atan2(dy, dx) * 180) / Math.PI;
  const shade = (hex, k) => '#' + [1, 3, 5].map((p) => Math.round(parseInt(hex.slice(p, p + 2), 16) * k).toString(16).padStart(2, '0')).join('');
  // seeded so the rattle is irregular but the SVG stays stable between builds
  let seed = 0x5eed;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  // rattle patterns: one to three sudden kicks with a small bounce, otherwise resting
  const PATTERNS = Array.from({ length: 14 }, () => {
    const kicks = [];
    let at0 = rnd() * 0.3;
    for (let n = 1 + Math.floor(rnd() * 3); n-- && at0 < 0.8; at0 += 0.1 + rnd() * 0.3) kicks.push([at0, 0.35 + rnd() * 0.65]);
    return kicks;
  });
  const stops = (kicks) => {
    const s = [[0, 0]];
    for (const [a, k] of kicks) s.push([a, 0], [a + 0.025, k], [a + 0.06, 0], [a + 0.08, k * 0.3], [a + 0.1, 0]);
    s.push([1, 0]);
    return s;
  };
  const pc = (n) => `${(n * 100).toFixed(1)}%`;
  style += '.sd{transform-box:fill-box;transform-origin:50% 100%}';
  for (let L = 1; L <= 4; L++) {
    PATTERNS.forEach((kicks, p) => {
      const s = stops(kicks);
      const hAt = (k) => BASE[L] + AMP[L] * k;
      style += `@keyframes sd${L}_${p}{${s.map(([a, k]) => `${pc(a)}{transform:scaleY(${(hAt(k) / HM).toFixed(3)})}`).join('')}}`;
      style += `@keyframes tp${L}_${p}{${s.map(([a, k]) => `${pc(a)}{transform:translateY(-${hAt(k).toFixed(1)}px)}`).join('')}}`;
    });
  }
  const f1 = (n) => n.toFixed(1);
  const gap = 0.12;
  cells
    .slice()
    .sort((p, q) => p.j - q.j || p.i - q.i)
    .forEach((cl) => {
      const L = level(cl.count);
      const top = shades[L];
      const p = Math.floor(rnd() * PATTERNS.length);
      const dur = (1.8 + rnd() * 3.4).toFixed(2);
      const delay = (t + 1.5 + rnd() * 4).toFixed(2);
      const run = (k) => (L ? `animation:${k}${L}_${p} ${dur}s linear ${delay}s infinite both` : '');
      const h = L ? HM : BASE[0];
      const [i0, i1, j0, j1] = [cl.i + gap, cl.i + 1 - gap, cl.j + gap, cl.j + 1 - gap];
      const O = at(i0, j0);
      const OU = at(i1, j0);
      const OUV = at(i1, j1);
      const OV = at(i0, j1);
      const side = (from, to, fill) => {
        const [x0, y0] = from[0] <= to[0] ? from : to;
        const [x1, y1] = from[0] <= to[0] ? to : from;
        return `<g transform="translate(${f1(x0)} ${f1(y0)}) skewY(${deg(x1 - x0, y1 - y0).toFixed(2)})"><rect class="sd" style="${run('sd')}" x="0" y="${-h}" width="${f1(x1 - x0)}" height="${h}" fill="${fill}"/></g>`;
      };
      const face = `<path style="${L ? run('tp') : `transform:translateY(-${BASE[0]}px)`}" d="M${O.map(f1).join(' ')}L${OU.map(f1).join(' ')}L${OUV.map(f1).join(' ')}L${OV.map(f1).join(' ')}Z" fill="${top}"/>`;
      body += show(t + cl.i * 0.02, side(OV, OUV, shade(top, 0.72)) + side(OUV, OU, shade(top, 0.5)) + face);
    });
  // month labels along the front edge
  const seen = new Set();
  for (const cl of cells) {
    const m = new Date(cl.date + 'T00:00:00Z').getUTCMonth();
    if (cl.j !== 6 || seen.has(m) || cl.i < 2) continue;
    seen.add(m);
    const [px, py] = at(cl.i, 8);
    body += show(t, text(M, 10, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m], { x: 0, y: 0, fill: T.dim, transform: `translate(${f1(px)} ${f1(py)}) rotate(${deg(u[0], u[1]).toFixed(1)})` }));
  }
  for (const [j, d] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']]) {
    const [px, py] = at(0, j + 0.5);
    body += show(t, text(M, 10, d, { x: f1(px - 10), y: f1(py + 3.5), fill: T.dim, anchor: 'end' }));
  }
  y = at(NI, 7)[1] + 40;
  body += show(t + 0.5, spans([[MB, fmt(act.yearTotal), T.green], [M, note, T.sub]], 13, { x: PAD + 40, y }));
  const stats = allTimeStats(y + 44, t + 1);
  body += stats.body;
  return { body: `<style>${style}</style>` + body, y: stats.y, t: stats.t };
}

// ---------------------------------------------------------------- concept windows
/** A bar of `n` cells drawn left to right from `start`, `cps` seconds per cell. */
function growing(id, x, y, size, n, start, cps, inner) {
  const cw = M.width('█', size);
  const dur = Math.max(0.05, n * cps);
  return `<style>@keyframes ${id}{from{transform:translateX(0)}to{transform:translateX(${n * cw}px)}}.${id}{animation:${id} ${dur.toFixed(2)}s steps(${Math.max(1, n)},end) ${start.toFixed(2)}s both}</style>${inner}<g class="gone" style="animation-delay:${(start + dur).toFixed(2)}s"><rect class="${id}" x="${x - 1}" y="${y - size - 1}" width="${n * cw + 2}" height="${size + 8}" fill="${T.bg}"/></g>`;
}

// tokei-style breakdown of authored lines by language
function tokei(y, start) {
  const LANG = {
    py: 'Python', pyx: 'Python', pxd: 'Python',
    md: 'Markdown', rst: 'Markdown',
    java: 'Java', fxml: 'Java',
    c: 'C', h: 'C',
    svelte: 'Svelte',
    ts: 'TypeScript', tsx: 'TypeScript',
    js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    sh: 'Shell', bash: 'Shell', sbatch: 'Shell', ps1: 'Shell', bat: 'Shell',
    erl: 'Erlang', hrl: 'Erlang', ex: 'Elixir', exs: 'Elixir', heex: 'Elixir',
    sql: 'SQL', rs: 'Rust', css: 'CSS', scss: 'CSS',
  };
  const COLOR = { Python: T.blue, Markdown: T.sub, Java: T.orange, C: T.cyan, Svelte: T.red, TypeScript: T.teal, JavaScript: T.yellow, Shell: T.green, Erlang: T.magenta, Elixir: T.magenta, SQL: T.yellow, Rust: T.orange, CSS: T.blue, Other: T.dim };
  const by = {};
  for (const [ext, [a, d]] of Object.entries(act.lines.byExt)) {
    const l = LANG[ext] ?? 'Other';
    by[l] ??= [0, 0];
    by[l][0] += a;
    by[l][1] += d;
  }
  let rows = Object.entries(by).filter(([l]) => l !== 'Other').sort((a, b) => b[1][0] - a[1][0]);
  const keep = rows.slice(0, 9);
  const other = rows.slice(9).reduce((s, [, [a, d]]) => [s[0] + a, s[1] + d], by.Other ?? [0, 0]);
  rows = [...keep, ['Other', other]];
  const total = rows.reduce((s, [, [a]]) => s + a, 0);

  const S = 13;
  let body = '';
  const c = typed(y, 'tokei --authored ~/repos/*', start, 0.04);
  body += c.svg;
  let t = c.end + 0.25;
  y += 34;
  const rule = (yy, d) => show(d, text(M, S, '━'.repeat(81), { x: PAD, y: yy, fill: T.border }));
  body += rule(y - 14, t);
  body += show(t, spans([[MB, ' Language'.padEnd(16), T.fg], [MB, 'Added'.padStart(10), T.fg], [MB, 'Deleted'.padStart(11), T.fg], [MB, '   Share', T.fg]], S, { x: PAD, y: y + 4 }));
  body += rule(y + 14, t);
  y += 38;
  const BAR = 30;
  const max = rows[0][1][0];
  const barX = PAD + 40 * M.width('M', S);
  rows.forEach(([lang, [a, d]], i) => {
    const n = Math.max(1, Math.round((a / max) * BAR));
    const share = ((100 * a) / total).toFixed(1).padStart(5) + '%';
    const d0 = t + 0.1 + i * 0.12;
    const line = spans(
      [[M, ' ' + lang.padEnd(15), COLOR[lang] ?? T.fg], [M, fmt(a).padStart(10), T.green], [M, fmt(d).padStart(11), T.red], [M, '   ', T.fg], [M, '█'.repeat(n), COLOR[lang] ?? T.fg], [M, ' '.repeat(BAR - n + 1) + share, T.sub]],
      S,
      { x: PAD, y },
    );
    body += show(d0, growing(`g${i}`, barX, y, S, n, d0, 0.02, line));
    y += 22;
  });
  body += rule(y - 8, t + 0.2 + rows.length * 0.12);
  y += 14;
  body += show(
    t + 0.3 + rows.length * 0.12,
    spans([[MB, ' Total'.padEnd(16), T.fg], [MB, fmt(act.lines.added).padStart(10), T.green], [MB, fmt(act.lines.deleted).padStart(11), T.red], [M, `   in ${act.lines.repos} repos · notebooks, data and lockfiles skipped`, T.dim]], S, { x: PAD, y }),
  );
  return { body, y: y + 30, t: t + 0.3 + rows.length * 0.12 };
}

const extras = await getExtras();

// ls -la of pinned projects, with live stars and last push
function projects(y, start) {
  const LANGC = { Python: T.blue, TypeScript: T.teal, JavaScript: T.yellow };
  // descriptions from the current list, not the cached copy in extras.json
  const DESC = Object.fromEntries(PROJECT_REPOS);
  const S = 12;
  let body = '';
  const c = typed(y, 'ls -la ~/projects', start, 0.05);
  body += c.svg;
  let t = c.end + 0.25;
  y += 32;
  body += show(t, text(M, S, `total ${extras.repos.length}`, { x: PAD, y, fill: T.dim }));
  y += 22;
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  // like ls: time of day for recent entries, year for older ones
  const date = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const md = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'Europe/Warsaw' });
    const recent = Date.now() - d < 182 * 864e5;
    return `${md} ${recent ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : ' ' + d.getUTCFullYear()}`;
  };
  extras.repos.forEach((r, i) => {
    const disp = (r.full === 'Expensify/App' ? 'expensify-app' : r.name) + '/';
    body += show(
      t + 0.1 + i * 0.1,
      spans(
        [
          [M, r.private ? 'drwx------  ' : 'drwxr-xr-x  ', r.private ? T.red : T.dim],
          [M, '* ', T.yellow],
          [M, k(r.stars).padEnd(5), T.yellow],
          [M, r.lang.padEnd(11), LANGC[r.lang] ?? T.sub],
          [M, date(r.pushedAt).padEnd(13), T.dim],
          [MB, disp.padEnd(24), T.blue],
          [M, `# ${DESC[r.full] ?? r.desc}`, T.dim],
        ],
        S,
        { x: PAD, y },
      ),
    );
    y += 22;
  });
  return { body, y, t: t + 0.1 + extras.repos.length * 0.1 };
}

// ---------------------------------------------------------------- composed windows
// Several commands in one terminal, run one after another.
const GAP = 22;

{
  const tl = careerTimeline(36 + 34, 0.3);
  // the legend sits right on the timeline's last line, so the next prompt needs extra air
  const g = careerGraph(tl.y + GAP + 18, tl.t + 0.3);
  const H = g.y + 26;
  await emit('career', 'career --timeline and git log --graph --all: AGH, WRSS, BIT, Software Mansion, IonTracks, PSI, freelance', H, chrome(H, 'jakub@krakow: ~/career (main)') + tl.body + g.body);
}

{
  const c = contribGraph(36 + 34, 0.4);
  const tk = tokei(c.y + GAP, c.t + 0.3);
  const pr = projects(tk.y + GAP, tk.t + 0.3);
  const H = pr.y + 14;
  await emit('contrib', `${fmt(act.yearTotal)} contributions in the last year, ${fmt(act.totals.contributions)} total; lines by language; projects`, H, chrome(H, 'jakub@krakow: ~ — gh') + c.body + tk.body + pr.body);
}

console.log('c-terminal done');
