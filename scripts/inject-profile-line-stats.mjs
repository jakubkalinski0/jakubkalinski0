/**
 * Injects readme.source.build.md with profile aggregates.
 *
 * Repos / Stars: all repositories you *own* (paginated). PAT = private too; else public owned only.
 *
 * Lines +/− and "contributor" commit sum: per-repo GET stats/contributors (your row, default branch,
 * weekly buckets) — only for repos we iterate (owned list). Same source as line counts.
 *
 * Commits (card): max( sum of those weekly "c" , Search API total_count for author:LOGIN ).
 *   Search includes commits on repos you do *not* own (orgs, forks you contributed to), within
 *   GitHub's index and visibility rules. Not a raw `git rev-list --all` — GitHub does not expose that.
 *
 * PAT PROFILE_LINE_STATS_TOKEN: /user/repos?affiliation=owner.
 * Else: /users/{login}/repos?type=owner + GITHUB_TOKEN.
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
  'User-Agent': 'jakubkalinski0-profile-stats-inject',
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

function repoRow(r, login) {
  if (!r.owner?.login || r.owner.login.toLowerCase() !== login.toLowerCase()) return null;
  return {
    owner: r.owner.login,
    name: r.name,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
  };
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
      const row = repoRow(r, login);
      if (row) repos.push(row);
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
      repos.push({
        owner: r.owner.login,
        name: r.name,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
      });
    }
    if (batch.length < 100) break;
  }
  return repos;
}

async function contributorStats(repoOwner, repoName, login) {
  const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/stats/contributors`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await ghFetch(url);
    if (res.status === 202) {
      await sleep(800 + attempt * 400);
      continue;
    }
    if (res.status === 404) return { added: 0, deleted: 0, commits: 0 };
    if (!res.ok) {
      console.warn(`  skip ${repoName}: contributors ${res.status}`);
      return { added: 0, deleted: 0, commits: 0 };
    }
    const data = await res.json();
    if (!Array.isArray(data)) return { added: 0, deleted: 0, commits: 0 };
    const row = data.find(
      (c) => c.author?.login && c.author.login.toLowerCase() === login.toLowerCase(),
    );
    if (!row?.weeks) return { added: 0, deleted: 0, commits: 0 };
    let added = 0;
    let deleted = 0;
    let commits = 0;
    for (const w of row.weeks) {
      added += w.a || 0;
      deleted += w.d || 0;
      commits += w.c || 0;
    }
    return { added, deleted, commits };
  }
  return { added: 0, deleted: 0, commits: 0 };
}

/** Commits across GitHub visible to the token (incl. repos you don't own), not full git history. */
async function searchCommitsTotal(login) {
  const q = `author:${login}`;
  const url = new URL('https://api.github.com/search/commits');
  url.searchParams.set('q', q);
  url.searchParams.set('per_page', '1');
  const res = await ghFetch(url.toString());
  if (!res.ok) {
    const t = await res.text();
    console.warn(`  commit search failed ${res.status}: ${t.slice(0, 200)}`);
    return null;
  }
  const data = await res.json();
  if (typeof data.total_count !== 'number') return null;
  return data.total_count;
}

async function main() {
  const root = process.cwd();
  const srcPath = resolve(root, 'readme.source.md');
  const outPath = resolve(root, 'readme.source.build.md');

  let content = readFileSync(srcPath, 'utf8');
  const markerRe = /\/\/ @@profile-github-stats[\s\S]*?\/\/ @@end-profile-github-stats/;
  if (!markerRe.test(content)) {
    throw new Error('readme.source.md: missing @@profile-github-stats block');
  }

  let added = null;
  let deleted = null;
  let totalRepos = null;
  let totalStars = null;
  let totalCommits = null;

  if (!owner) {
    console.warn('No PROFILE_OWNER / GITHUB_REPOSITORY_OWNER; profile aggregates left null');
  } else if (!token) {
    console.warn('No token; profile aggregates left null (local preview)');
  } else {
    try {
      const usePat = Boolean(pat);
      console.log(
        usePat
          ? `Listing owned repos via PAT (public + private) for ${owner}…`
          : `Listing public owner repos for ${owner} (add PROFILE_LINE_STATS_TOKEN for private too)…`,
      );
      const repos = usePat ? await listReposPat(owner) : await listReposPublic(owner);
      totalRepos = repos.length;
      totalStars = repos.reduce((s, r) => s + r.stars, 0);
      console.log(
        `${totalRepos} repos, ${totalStars} total stars on those repos. Fetching per-repo contributor stats…`,
      );
      let ta = 0;
      let td = 0;
      let tc = 0;
      for (let i = 0; i < repos.length; i++) {
        const r = repos[i];
        const st = await contributorStats(r.owner, r.name, owner);
        ta += st.added;
        td += st.deleted;
        tc += st.commits;
        if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${repos.length}`);
        await sleep(120);
      }
      added = ta;
      deleted = td;
      let searchCommits = null;
      try {
        searchCommits = await searchCommitsTotal(owner);
        if (searchCommits != null) {
          console.log(`  Search commits author:${owner} → total_count=${searchCommits}`);
        }
      } catch (e) {
        console.warn('  commit search error:', e.message);
      }
      totalCommits = Math.max(tc, searchCommits ?? 0);
      console.log(
        `Totals: ${totalCommits} commits (max of contributor-sum on owned repos=${tc}, search=${searchCommits ?? 'n/a'}), +${added} / -${deleted} lines`,
      );
    } catch (e) {
      console.warn('Profile stats failed:', e.message);
    }
  }

  const block = `// @@profile-github-stats
  var profileLinesAdded = ${added === null ? 'null' : added};
  var profileLinesDeleted = ${deleted === null ? 'null' : deleted};
  var profileTotalRepos = ${totalRepos === null ? 'null' : totalRepos};
  var profileTotalStars = ${totalStars === null ? 'null' : totalStars};
  var profileTotalCommits = ${totalCommits === null ? 'null' : totalCommits};
  // @@end-profile-github-stats`;

  content = content.replace(markerRe, block);
  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
