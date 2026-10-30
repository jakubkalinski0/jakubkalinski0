// Recent activity (events API) and repo metadata for the terminal concept windows.
import fs from 'node:fs';
import { LOGIN } from './data.mjs';
import { apiClient } from './activity.mjs';

const CACHE = new URL('../.cache/extras.json', import.meta.url);

// Private repos whose names may appear on the profile; titles are only ever shown for public repos.
const NAMED = /^(ion-tracks\/|Expensify\/App$|AutarkEOS\/(autark-mcp|Autark)$)/;

export const PROJECT_REPOS = [
  ['ion-tracks/IonTracks3', 'full-fledged recombination sim, new RDD model'],
  ['ion-tracks/IonTracks-Axisymmetric', 'axitracks: 6,000× faster than IonTracks-FEniCSx'],
  ['Expensify/App', 'New Expensify: biometric MFA (in-app 3DS)'],
  ['jakubkalinski0/SWM-Hackathon-2025', 'EcoScan: 1st place, SWM Hackathon 2025'],
  ['AutarkEOS/autark-mcp', 'Autark: marketplace where AI agents trade'],
  ['jakubkalinski0/Multistage-Morris-AI', 'Nine Men’s Morris: MCTS and DQN agents'],
];

function describe(e) {
  const p = e.payload ?? {};
  const repo = e.public || NAMED.test(e.repo.name) ? e.repo.name : 'private repo';
  const title = e.public ? (p.pull_request?.title ?? p.issue?.title ?? '') : '';
  const num = p.number ?? p.pull_request?.number ?? p.issue?.number;
  switch (e.type) {
    case 'PushEvent':
      return { verb: 'push', what: (p.ref ?? '').replace('refs/heads/', ''), repo };
    case 'PullRequestEvent':
      if (!['opened', 'merged', 'closed'].includes(p.action)) return null;
      return { verb: p.action === 'merged' || p.pull_request?.merged ? 'merge' : p.action === 'opened' ? 'pr' : 'close', what: num ? `#${num}` : 'PR', repo, title, key: `${repo}#${num}` };
    case 'PullRequestReviewEvent':
      return { verb: 'review', what: num ? `#${num}` : 'PR', repo, title };
    case 'IssuesEvent':
      if (!['opened', 'closed'].includes(p.action)) return null;
      return { verb: p.action === 'closed' ? 'done' : 'issue', what: num ? `#${num}` : '', repo, title };
    case 'CreateEvent':
      return p.ref_type === 'repository' ? { verb: 'init', what: 'new repo', repo } : null;
    case 'ReleaseEvent':
      return { verb: 'release', what: p.release?.tag_name ?? '', repo, title: e.public ? p.release?.name ?? '' : '' };
    default:
      return null;
  }
}

async function events(client) {
  const raw = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await client.rest(`/users/${LOGIN}/events?per_page=100&page=${page}`);
    raw.push(...batch);
    if (batch.length < 100) break;
  }
  raw.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out = [];
  const merged = new Set();
  for (const e of raw) {
    const d = describe(e);
    if (!d) continue;
    // an "opened" PR that was later merged reads better as just the merge
    if (d.key && d.verb === 'merge') merged.add(d.key);
    else if (d.key && merged.has(d.key)) continue;
    out.push({ at: e.created_at, ...d });
  }
  return out.slice(0, 40);
}

const REPO_Q = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
  stargazerCount isPrivate pushedAt primaryLanguage { name } } }`;

async function repos(client) {
  const out = [];
  for (const [full, desc] of PROJECT_REPOS) {
    const [owner, name] = full.split('/');
    // without a token that can read it, a private repo comes back as null: keep the row, drop the live fields
    const r = await client.gql(REPO_Q, { owner, name }).then((d) => d.repository, () => null);
    out.push(r
      ? { full, name, desc, stars: r.stargazerCount, private: r.isPrivate, pushedAt: r.pushedAt, lang: r.primaryLanguage?.name ?? '' }
      : { full, name, desc, stars: 0, private: true, pushedAt: null, lang: '' });
  }
  return out;
}

export async function getExtras() {
  if (!process.env.REFRESH_STATS && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const client = apiClient();
  const data = { events: await events(client), repos: await repos(client) };
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
  return data;
}
