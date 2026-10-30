// Lines added/deleted in hand-written files: per-file commit stats with notebooks, data dumps,
// generated output and lockfiles filtered out by extension, plus vendored/build directories.
// The cache keeps per-extension sums per commit SHA / PR, so the filter can change without refetching.
import fs from 'node:fs';
import path from 'node:path';

const CACHE = new URL('../.cache/lines-cache-v2.json', import.meta.url);

export const EXCLUDED_EXT = new Set(
  `ipynb csv tsv xls xlsx xlsm ods json txt dat out log arff data test names xml html htm svg drawio
   yaml yml npy npz h5 hdf5 pkl parquet mat vtk vtu xdmf msh lock snap map patch sha256 bib tree part probe`.split(/\s+/),
);
const SKIP_DIRS = /(^|\/)(node_modules|vendor|dist|build|out|target|\.venv|venv|__pycache__|\.idea|\.vscode)\//;
const SKIP = '!';

function extKey(filename) {
  const base = path.posix.basename(filename);
  if (SKIP_DIRS.test(filename) || base.endsWith('.min.js')) return SKIP;
  return base.includes('.') ? base.split('.').pop().toLowerCase() : '';
}

const counted = (ext) => ext !== SKIP && !EXCLUDED_EXT.has(ext);
export const isCode = (filename) => counted(extKey(filename));

function byExt(files) {
  const t = {};
  for (const f of files) {
    const k = extKey(f.filename);
    const e = (t[k] ??= [0, 0]);
    e[0] += f.additions;
    e[1] += f.deletions;
  }
  return t;
}

function tally(exts) {
  const t = { a: 0, d: 0, xa: 0, xd: 0 };
  for (const [k, [a, d]] of Object.entries(exts)) {
    if (counted(k)) {
      t.a += a;
      t.d += d;
    } else {
      t.xa += a;
      t.xd += d;
    }
  }
  return t;
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export function makeClient(token) {
  const headers = { Authorization: `bearer ${token}`, 'User-Agent': 'jakubkalinski0-profile', Accept: 'application/vnd.github+json' };
  async function rest(url) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, { headers });
      if (res.ok) return res.json();
      if (attempt >= 3 || res.status === 404 || res.status === 422) throw new Error(`${res.status} ${url}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  async function gql(query, variables = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const body = res.ok ? await res.json() : null;
      if (body && !body.errors?.length) return body.data;
      if (attempt >= 3) throw new Error(body?.errors?.map((e) => e.message).join('; ') || `GraphQL ${res.status}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return { rest, gql };
}

const OIDS_Q = `query($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) { defaultBranchRef { target { ... on Commit {
    history(first: 100, after: $after, since: $since, author: { id: $author }) {
      pageInfo { hasNextPage endCursor } nodes { oid parents { totalCount } }
    } } } } } }`;

async function commitOids(client, repo, authorId, since) {
  const [owner, name] = repo.split('/');
  const oids = [];
  let after = null;
  for (let page = 0; page < 100; page++) {
    const vars = { owner, name, author: authorId, since };
    if (after) vars.after = after;
    const h = (await client.gql(OIDS_Q, vars)).repository?.defaultBranchRef?.target?.history;
    if (!h) break;
    for (const n of h.nodes) if (n.parents.totalCount === 1) oids.push(n.oid);
    if (!h.pageInfo.hasNextPage) break;
    after = h.pageInfo.endCursor;
  }
  return oids;
}

async function commitFiles(client, repo, sha) {
  const files = [];
  for (let page = 1; page <= 10; page++) {
    const c = await client.rest(`/repos/${repo}/commits/${sha}?per_page=300&page=${page}`);
    files.push(...(c.files ?? []));
    if ((c.files?.length ?? 0) < 300) break;
  }
  return files;
}

async function mergedPRs(client, repo, login) {
  const nums = [];
  for (let page = 1; page <= 10; page++) {
    const q = encodeURIComponent(`repo:${repo} author:${login} is:pr is:merged`);
    const r = await client.rest(`/search/issues?q=${q}&per_page=100&page=${page}`);
    nums.push(...r.items.map((i) => i.number));
    if (r.items.length < 100) break;
  }
  return nums;
}

async function prFiles(client, repo, n) {
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await client.rest(`/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

/**
 * repos: "owner/name" list. prRepos: repos counted from merged PRs instead of commits
 * (work lands there via merge commits of PR branches).
 */
export async function countLines(client, { repos, prRepos = [], authorId, login, since }) {
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const total = { added: 0, deleted: 0, excludedAdded: 0, excludedDeleted: 0, commits: 0, repos: 0, byExt: {} };
  for (const repo of repos) {
    let jobs;
    try {
      jobs = prRepos.includes(repo)
        ? (await mergedPRs(client, repo, login)).map((n) => [`pr:${repo}#${n}`, () => prFiles(client, repo, n)])
        : (await commitOids(client, repo, authorId, since)).map((sha) => [`${repo}@${sha}`, () => commitFiles(client, repo, sha)]);
    } catch (e) {
      console.warn(`  skip ${repo}: ${e.message}`);
      continue;
    }
    if (!jobs.length) continue;
    const results = await pool(jobs, 8, async ([key, load]) => {
      if (!cache[key]) {
        try {
          cache[key] = byExt(await load());
        } catch (e) {
          console.warn(`  skip ${key}: ${e.message}`);
          return null;
        }
      }
      return cache[key];
    });
    const r = { a: 0, d: 0, xa: 0, xd: 0, n: 0 };
    const top = {};
    for (const exts of results.filter(Boolean)) {
      for (const [k, [a, d]] of Object.entries(exts)) {
        if (!counted(k)) continue;
        const e = (top[k] ??= [0, 0]);
        e[0] += a;
        e[1] += d;
      }
      const t = tally(exts);
      r.a += t.a;
      r.d += t.d;
      r.xa += t.xa;
      r.xd += t.xd;
      r.n++;
    }
    total.added += r.a;
    total.deleted += r.d;
    total.excludedAdded += r.xa;
    total.excludedDeleted += r.xd;
    total.commits += r.n;
    total.repos++;
    for (const [k, [a, d]] of Object.entries(top)) {
      const e = (total.byExt[k] ??= [0, 0]);
      e[0] += a;
      e[1] += d;
    }
    const main = Object.entries(top).sort((x, y) => y[1][0] - x[1][0]).slice(0, 3).map(([k, [a]]) => `${k} ${a}`).join(', ');
    console.log(`  ${repo}: +${r.a} -${r.d}  [${main}]  (excluded +${r.xa} -${r.xd}, ${r.n} ${prRepos.includes(repo) ? 'PRs' : 'commits'})`);
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
  return total;
}
