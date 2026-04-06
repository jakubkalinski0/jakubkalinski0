/**
 * Sums GitHub "contributors" additions/deletions for the profile owner across repos.
 * Writes readme.source.build.md (inject numbers into @@profile-line-stats block).
 *
 * - With PROFILE_LINE_STATS_TOKEN (PAT, repo read): /user/repos?affiliation=owner (public + private you own).
 * - Otherwise: /users/{owner}/repos?type=owner (public repos only) + GITHUB_TOKEN if present.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const owner = process.env.PROFILE_OWNER || process.env.GITHUB_REPOSITORY_OWNER;
const pat = process.env.PROFILE_LINE_STATS_TOKEN || '';
const ghToken = process.env.GITHUB_TOKEN || '';
const token = pat || ghToken;

const HEADERS_BASE = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'jakubkalinski0-profile-line-stats',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ghFetch(url, opts = {}) {
  const headers = { ...HEADERS_BASE, ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  return res;
}

async function listReposPat(login) {
  const repos = [];
  for (let page = 1; page <= 50; page++) {
    const u = new URL('https://api.github.com/user/repos');
    u.searchParams.set('per_page', '100');
    u.searchParams.set('page', String(page));
    u.searchParams.set('affiliation', 'owner');
    u.searchParams.set('sort', 'pushed');
    const res = await ghFetch(u.toString());
    if (!res.ok) throw new Error(`user/repos: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      if (r.owner?.login?.toLowerCase() === login.toLowerCase()) {
        repos.push({ owner: r.owner.login, name: r.name });
      }
    }
    if (batch.length < 100) break;
  }
  return repos;
}

async function listReposPublic(login) {
  const repos = [];
  for (let page = 1; page <= 50; page++) {
    const u = new URL(`https://api.github.com/users/${encodeURIComponent(login)}/repos`);
    u.searchParams.set('per_page', '100');
    u.searchParams.set('page', String(page));
    u.searchParams.set('type', 'owner');
    u.searchParams.set('sort', 'pushed');
    const res = await ghFetch(u.toString());
    if (!res.ok) throw new Error(`users/.../repos: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      repos.push({ owner: r.owner.login, name: r.name });
    }
    if (batch.length < 100) break;
  }
  return repos;
}

async function contributorAddsDels(repoOwner, repoName, login) {
  const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/stats/contributors`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await ghFetch(url);
    if (res.status === 202) {
      await sleep(800 + attempt * 400);
      continue;
    }
    if (res.status === 404) return { added: 0, deleted: 0 };
    if (!res.ok) {
      console.warn(`  skip ${repoName}: contributors ${res.status}`);
      return { added: 0, deleted: 0 };
    }
    const data = await res.json();
    if (!Array.isArray(data)) return { added: 0, deleted: 0 };
    const row = data.find(
      (c) => c.author?.login && c.author.login.toLowerCase() === login.toLowerCase(),
    );
    if (!row?.weeks) return { added: 0, deleted: 0 };
    let added = 0;
    let deleted = 0;
    for (const w of row.weeks) {
      added += w.a || 0;
      deleted += w.d || 0;
    }
    return { added, deleted };
  }
  return { added: 0, deleted: 0 };
}

async function main() {
  const root = process.cwd();
  const srcPath = resolve(root, 'readme.source.md');
  const outPath = resolve(root, 'readme.source.build.md');

  let content = readFileSync(srcPath, 'utf8');
  const markerRe = /\/\/ @@profile-line-stats[\s\S]*?\/\/ @@end-profile-line-stats/;
  if (!markerRe.test(content)) {
    throw new Error('readme.source.md: missing @@profile-line-stats block');
  }

  let added = null;
  let deleted = null;

  if (!owner) {
    console.warn('No PROFILE_OWNER / GITHUB_REPOSITORY_OWNER; line stats left null');
  } else if (!token) {
    console.warn('No token; line stats left null (local preview)');
  } else {
    try {
      const usePat = Boolean(pat);
      console.log(
        usePat
          ? `Listing owned repos via PAT (public + private) for ${owner}…`
          : `Listing public owner repos for ${owner} (add PROFILE_LINE_STATS_TOKEN for private too)…`,
      );
      const repos = usePat ? await listReposPat(owner) : await listReposPublic(owner);
      console.log(`Found ${repos.length} repos. Fetching contributor stats (slow)…`);
      let ta = 0;
      let td = 0;
      for (let i = 0; i < repos.length; i++) {
        const r = repos[i];
        const { added: a, deleted: d } = await contributorAddsDels(r.owner, r.name, owner);
        ta += a;
        td += d;
        if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${repos.length}`);
        await sleep(120);
      }
      added = ta;
      deleted = td;
      console.log(`Totals: +${added} / -${deleted} lines (GitHub default-branch contributor stats)`);
    } catch (e) {
      console.warn('Line stats failed:', e.message);
    }
  }

  const block = `// @@profile-line-stats
  var profileLinesAdded = ${added === null ? 'null' : added};
  var profileLinesDeleted = ${deleted === null ? 'null' : deleted};
  // @@end-profile-line-stats`;

  content = content.replace(markerRe, block);
  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
