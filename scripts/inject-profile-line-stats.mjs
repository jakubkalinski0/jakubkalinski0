/**
 * Injects readme.source.build.md with profile aggregates.
 *
 * Repos / Stars: all repositories you *own* (paginated). PAT = private too; else public owned only.
 *
 * Lines +/−: per-commit all-time sum across repositories visible to the token. We enumerate a deduped
 * repo set from REST + GraphQL, then list commits authored by the target user and sum commit stats
 * (additions/deletions). This avoids rolling-window drift from stats/contributors. PAT + repo is
 * effectively required for good private/org coverage.
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
const REQUEST_TIMEOUT_MS = 20_000;
const REPO_LIST_PAGE_LIMIT = 50;
const COMMIT_LIST_PAGE_LIMIT = 200;
const COMMITS_PER_PAGE = 100;
const API_PAUSE_MS = 120;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ghFetch(url, opts = {}) {
  const headers = { ...HEADERS_BASE, ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const signal = opts.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const res = await fetch(url, { ...opts, headers, signal });
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
  for (let page = 1; page <= REPO_LIST_PAGE_LIMIT; page++) {
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
  for (let page = 1; page <= REPO_LIST_PAGE_LIMIT; page++) {
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

function repoKey(r) {
  return `${r.owner.toLowerCase()}/${r.name.toLowerCase()}`;
}

const REPOS_COMMITS_CONTRIBUTED_QUERY = `
query($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    repositoriesContributedTo(
      first: $first
      after: $after
      includeUserRepositories: true
      contributionTypes: [COMMIT]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        owner { login }
        name
      }
    }
  }
}
`;

/** Unique owner/name where the user has commit contributions (not only repos they own). */
async function listReposWithCommitContributions(login) {
  const seen = new Set();
  const out = [];
  const first = 100;
  let after = null;
  for (;;) {
    const data = await graphqlGitHub(REPOS_COMMITS_CONTRIBUTED_QUERY, { login, first, after });
    const conn = data?.user?.repositoriesContributedTo;
    if (!conn?.nodes) break;
    for (const node of conn.nodes) {
      const o = node?.owner?.login;
      const n = node?.name;
      if (!o || !n) continue;
      const key = `${o.toLowerCase()}/${n.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ owner: o, name: n });
    }
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
    await sleep(API_PAUSE_MS);
  }
  return out;
}

async function listAccessibleReposPat() {
  const repos = [];
  for (let page = 1; page <= REPO_LIST_PAGE_LIMIT; page++) {
    const u = new URL('https://api.github.com/user/repos');
    u.searchParams.set('per_page', String(COMMITS_PER_PAGE));
    u.searchParams.set('page', String(page));
    u.searchParams.set('visibility', 'all');
    u.searchParams.set('affiliation', 'owner,collaborator,organization_member');
    u.searchParams.set('sort', 'updated');
    const res = await ghFetch(u.toString());
    if (!res.ok) throw new Error(`user/repos(all accessible): ${res.status} ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      if (!r?.owner?.login || !r?.name) continue;
      repos.push({ owner: r.owner.login, name: r.name, private: Boolean(r.private) });
    }
    if (batch.length < COMMITS_PER_PAGE) break;
    await sleep(API_PAUSE_MS);
  }
  return repos;
}

function mergeReposForLineStats(...groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const r of group) {
      const key = repoKey(r);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ owner: r.owner, name: r.name });
    }
  }
  return out;
}

function formatRepo(r) {
  return `${r.owner}/${r.name}`;
}

async function fetchCommitDetailStats(repoOwner, repoName, ref) {
  const url = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commits/${encodeURIComponent(ref)}`;
  const res = await ghFetch(url);
  if (res.status === 404) return { added: 0, deleted: 0 };
  if (!res.ok) throw new Error(`commit detail ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    added: data?.stats?.additions ?? 0,
    deleted: data?.stats?.deletions ?? 0,
  };
}

async function sumRepoCommitStats(repoOwner, repoName, login) {
  let added = 0;
  let deleted = 0;
  let commits = 0;
  let truncated = false;

  for (let page = 1; page <= COMMIT_LIST_PAGE_LIMIT; page++) {
    const u = new URL(
      `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commits`,
    );
    u.searchParams.set('author', login);
    u.searchParams.set('per_page', String(COMMITS_PER_PAGE));
    u.searchParams.set('page', String(page));
    const res = await ghFetch(u.toString());
    if (res.status === 409 || res.status === 404) {
      return { added: 0, deleted: 0, commits: 0, truncated: false, skipped: false };
    }
    if (!res.ok) {
      throw new Error(`commit list ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      return { added, deleted, commits, truncated, skipped: false };
    }
    for (const item of batch) {
      const stats =
        item?.stats && typeof item.stats.additions === 'number' && typeof item.stats.deletions === 'number'
          ? { added: item.stats.additions, deleted: item.stats.deletions }
          : await fetchCommitDetailStats(repoOwner, repoName, item.sha);
      added += stats.added;
      deleted += stats.deleted;
      commits += 1;
      await sleep(API_PAUSE_MS);
    }
    if (batch.length < COMMITS_PER_PAGE) {
      return { added, deleted, commits, truncated, skipped: false };
    }
    await sleep(API_PAUSE_MS);
  }

  truncated = true;
  return { added, deleted, commits, truncated, skipped: false };
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
      const reposOwned = usePat ? await listReposPat(owner) : await listReposPublic(owner);
      totalRepos = reposOwned.length;
      totalStars = reposOwned.reduce((s, r) => s + r.stars, 0);
      console.log(`${totalRepos} owned repos, ${totalStars} total stars on those.`);

      let accessibleRepos = [];
      if (usePat) {
        try {
          accessibleRepos = await listAccessibleReposPat();
          console.log(`${accessibleRepos.length} accessible repos from /user/repos.`);
        } catch (e) {
          console.warn('Accessible repo listing failed, falling back to owned + contributed only:', e.message);
        }
      } else {
        console.warn('No PAT: line stats cover public/known repos only. Add PROFILE_LINE_STATS_TOKEN with repo + read:user for fuller coverage.');
      }

      let contributedRepos = [];
      try {
        contributedRepos = await listReposWithCommitContributions(owner);
        console.log(`${contributedRepos.length} repos from repositoriesContributedTo (COMMIT).`);
      } catch (e) {
        console.warn('repositoriesContributedTo failed (owned repos still included for lines):', e.message);
      }
      const reposForLines = mergeReposForLineStats(
        accessibleRepos,
        contributedRepos,
        reposOwned.map((r) => ({ owner: r.owner, name: r.name })),
      );
      console.log(
        `${reposForLines.length} unique repos for Lines ± (accessible ∪ contributed ∪ owned); walking commits…`,
      );

      let ta = 0;
      let td = 0;
      let totalCommitSamples = 0;
      let truncatedRepos = 0;
      let skippedRepos = 0;
      for (let i = 0; i < reposForLines.length; i++) {
        const r = reposForLines[i];
        try {
          const st = await sumRepoCommitStats(r.owner, r.name, owner);
          ta += st.added;
          td += st.deleted;
          totalCommitSamples += st.commits;
          if (st.truncated) {
            truncatedRepos += 1;
            console.warn(`  truncated ${formatRepo(r)} after ${COMMIT_LIST_PAGE_LIMIT} pages`);
          }
        } catch (e) {
          skippedRepos += 1;
          console.warn(`  skip ${formatRepo(r)}: ${e.message}`);
        }
        if ((i + 1) % 10 === 0) console.log(`  …lines ${i + 1}/${reposForLines.length}`);
        await sleep(API_PAUSE_MS);
      }
      added = ta;
      deleted = td;
      console.log('Fetching contribution graph totals (GraphQL, per UTC calendar year)…');
      profileContributionsTotal = await sumContributionsByCalendarYear(owner);
      console.log(
        `Totals: ${profileContributionsTotal} contributions, +${added} / -${deleted} lines from ${totalCommitSamples} commits; skipped repos=${skippedRepos}, truncated repos=${truncatedRepos}`,
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
