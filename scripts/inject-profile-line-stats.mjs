/**
 * Injects readme.source.build.md with profile aggregates.
 *
 * Repos / Stars: all repositories you *own* (paginated). PAT = private too; else public owned only.
 *
 * Lines +/−: per-repo GET stats/contributors (your row, default branch, weekly buckets) — owned repos
 * only. Same source as line counts.
 *
 * Contributions (card): For each calendar year (UTC Jan 1 → next Jan 1), GraphQL
 *   contributionCalendar.totalContributions + restrictedContributionsCount, then sum years
 *   from account-creation year through current UTC year.
 * Do not use one multi-year contributionsCollection — totalContributions is wrong for long spans (~partial year).
 * restricted* = private aggregate hidden from the viewer; GITHUB_TOKEN often needs PAT + read:user for parity.
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

async function graphqlGitHub(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...HEADERS_BASE,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join('; '));
  }
  return body.data;
}

async function userCreatedYear(login) {
  const data = await graphqlGitHub(
    `query($login: String!) { user(login: $login) { createdAt } }`,
    { login },
  );
  if (!data?.user?.createdAt) throw new Error('GraphQL: user not found');
  return new Date(data.user.createdAt).getUTCFullYear();
}

/** One calendar year (UTC), same window as the profile year tab; includes restricted for this viewer. */
async function contributionTotalsForYear(login, year) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year + 1}-01-01T00:00:00Z`;
  const data = await graphqlGitHub(
    `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar { totalContributions }
          restrictedContributionsCount
        }
      }
    }`,
    { login, from, to },
  );
  const coll = data?.user?.contributionsCollection;
  const cal = coll?.contributionCalendar?.totalContributions;
  const restricted = coll?.restrictedContributionsCount ?? 0;
  if (typeof cal !== 'number') throw new Error(`GraphQL: no totalContributions for ${year}`);
  const r = typeof restricted === 'number' ? restricted : 0;
  return { calendar: cal, restricted: r, total: cal + r };
}

async function sumContributionsByCalendarYear(login) {
  const startYear = await userCreatedYear(login);
  const endYear = new Date().getUTCFullYear();
  let sum = 0;
  for (let y = startYear; y <= endYear; y++) {
    const { calendar, restricted, total } = await contributionTotalsForYear(login, y);
    sum += total;
    console.log(`  contributions ${y}: calendar=${calendar} + restricted=${restricted} → ${total} (sum=${sum})`);
    await sleep(200);
  }
  return sum;
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
  let profileContributionsTotal = null;

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
      for (let i = 0; i < repos.length; i++) {
        const r = repos[i];
        const st = await contributorStats(r.owner, r.name, owner);
        ta += st.added;
        td += st.deleted;
        if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${repos.length}`);
        await sleep(120);
      }
      added = ta;
      deleted = td;
      console.log('Fetching contribution graph totals (GraphQL, per UTC calendar year)…');
      profileContributionsTotal = await sumContributionsByCalendarYear(owner);
      console.log(
        `Totals: ${profileContributionsTotal} contributions (sum of yearly graph totals), +${added} / -${deleted} lines`,
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
  var profileContributionsTotal = ${profileContributionsTotal === null ? 'null' : profileContributionsTotal};
  // @@end-profile-github-stats`;

  content = content.replace(markerRe, block);
  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
