import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const LOGIN = process.env.PROFILE_OWNER || 'jakubkalinski0';

export const profile = {
  name: 'Jakub Kaliński',
  short: 'Jakub',
  role: 'Research Software Engineer',
  tagline: 'HPC solvers for radiation dosimetry · React Native in production',
  location: 'Kraków, Poland',
  links: {
    github: `https://github.com/${LOGIN}`,
    linkedin: 'https://www.linkedin.com/in/jakubkalinski0/',
    iontracks: 'https://github.com/ion-tracks',
    ecoscan: 'https://github.com/jakubkalinski0/SWM-Hackathon-2025',
    morris: 'https://github.com/jakubkalinski0/Multistage-Morris-AI',
    autark: 'https://github.com/AutarkEOS/autark-mcp',
    expensify: 'https://github.com/Expensify/App',
    paper: 'https://events.plgrid.pl/event/105/attachments/226/608/KUKDM_2026_Proceedings-www.pdf',
  },
};

export const projects = [
  {
    id: 'iontracks',
    name: 'IonTracks',
    org: 'PSI · AGH · ion-tracks',
    desc: [
      'Solvers for ion recombination in ionization chambers,',
      'used to correct dosimetry in proton and ion beams.',
    ],
    facts: ['axitracks: up to 6,000× faster', 'IonTracks3: 222 PRs, solo'],
    tags: ['Python', 'Numba', 'FEniCSx', 'MPI', 'SLURM'],
    short: 'Ion recombination solvers for ion beam dosimetry',
    url: profile.links.iontracks,
    color: '#a78bfa',
  },
  {
    id: 'expensify',
    name: 'New Expensify',
    org: 'Software Mansion · client Expensify',
    desc: [
      'Led odometer expenses end to end: photo capture,',
      'offline drafts, iOS, Android and web. Shipped to all users.',
    ],
    facts: ['MFA state machine (XState)', 'React 19 migration'],
    tags: ['React Native', 'TypeScript', 'Skia'],
    short: 'Led odometer expenses end to end, shipped to all users',
    url: profile.links.expensify,
    color: '#60a5fa',
  },
  {
    id: 'ecoscan',
    name: 'EcoScan',
    org: '1st place · Software Mansion Hackathon 2025',
    desc: [
      'Scan a barcode, learn how to recycle it and find the',
      'nearest bin on a map. I built the API and database.',
    ],
    facts: [],
    tags: ['FastAPI', 'SQLite', 'React', 'TypeScript'],
    short: 'Scan a barcode, learn how to recycle it, find a bin',
    url: profile.links.ecoscan,
    color: '#34d399',
  },
  {
    id: 'autark',
    name: 'autark-mcp',
    org: 'AutarkEOS · hackathon, Oct 2026',
    desc: [
      'MCP server that lets AI agents buy and sell APIs,',
      'compute and idle machines, paid in SOL on Solana.',
    ],
    facts: [],
    tags: ['Python', 'MCP', 'Solana', 'Flask'],
    short: 'MCP server: AI agents buy and sell compute, paid in SOL',
    url: profile.links.autark,
    color: '#f59e0b',
  },
];

export const stack = [
  { group: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'C', 'SQL', 'Bash'], extra: ['Java', 'Rust', 'Elixir'] },
  { group: 'Frontend & mobile', items: ['React Native', 'React', 'Next.js', 'SvelteKit', 'Tailwind'] },
  { group: 'Scientific & HPC', items: ['NumPy', 'Numba', 'SciPy', 'FEniCSx', 'PETSc', 'MPI', 'CuPy', 'SLURM'] },
  { group: 'Backend & infra', items: ['FastAPI', 'Flask', 'PostgreSQL', 'Docker', 'Linux', 'GitHub Actions'] },
  { group: 'AI / ML', items: ['PyTorch', 'MCP servers', 'AI agents'] },
];

/** Career events, newest first. */
export const timeline = [
  { date: 'Oct 2026', kind: 'feat', scope: 'iontracks3', msg: 'one ion track → a whole beam, on CPU or GPU' },
  { date: 'Sep 2026', kind: 'perf', scope: 'psi', msg: 'axitracks: up to 6,000× faster than the 3D code' },
  { date: 'Aug 2026', kind: 'fix', scope: 'mpi', msg: 'ghost entries summed twice in a FEniCSx solver' },
  { date: 'Jul 2026', kind: 'feat', scope: 'psi', msg: 'join Radiation Metrology Group, Villigen CH' },
  { date: 'Apr 2026', kind: 'docs', scope: 'kukdm', msg: 'talk + paper on FEM ion recombination on PLGrid' },
  { date: 'Mar 2026', kind: 'feat', scope: 'expensify', msg: 'odometer expenses shipped to all users' },
  { date: 'Jul 2025', kind: 'feat', scope: 'swm', msg: 'join Software Mansion, work on New Expensify' },
  { date: 'Mar 2025', kind: 'feat', scope: 'hackathon', msg: 'EcoScan wins Software Mansion Hackathon' },
  { date: 'Oct 2023', kind: 'init', scope: 'agh', msg: 'B.Eng. Computer Science, AGH Kraków' },
];

const CACHE = new URL('../.cache/stats.json', import.meta.url);

function graphql(query) {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    return fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json());
  }
  return JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`], { encoding: 'utf8' }));
}

/** Public repos, stars and contributions (past year and all time). Cached for local rebuilds. */
export async function getStats() {
  if (!process.env.REFRESH_STATS && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const base = await graphql(`query { user(login: "${LOGIN}") {
    createdAt followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) { totalCount nodes { stargazerCount } }
    contributionsCollection { contributionCalendar { totalContributions } }
  } }`);
  const u = base.data.user;
  const from = new Date(u.createdAt).getUTCFullYear();
  const years = [];
  for (let y = from; y <= new Date().getUTCFullYear(); y++) years.push(y);
  const yq = years
    .map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } totalPullRequestContributions }`)
    .join('\n');
  const per = (await graphql(`query { user(login: "${LOGIN}") { ${yq} } }`)).data.user;
  const stats = {
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    yearContributions: u.contributionsCollection.contributionCalendar.totalContributions,
    totalContributions: years.reduce((s, y) => s + per[`y${y}`].contributionCalendar.totalContributions, 0),
    totalPRs: years.reduce((s, y) => s + per[`y${y}`].totalPullRequestContributions, 0),
    since: u.createdAt.slice(0, 10),
  };
  fs.mkdirSync(new URL('.', CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(stats, null, 2));
  return stats;
}

export const fmt = (n) => Number(n).toLocaleString('en-US');
