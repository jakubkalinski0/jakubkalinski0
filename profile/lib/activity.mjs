// Contribution breakdown, calendar, streaks and lines changed, for the terminal variant.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LOGIN } from './data.mjs';
import { makeClient, countLines } from './lines.mjs';

const CACHE = new URL('../.cache/activity.json', import.meta.url);
const TOKEN =
  process.env.PROFILE_STATS_TOKEN || process.env.GITHUB_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();

// Private repos whose contributions GitHub reports only as "restricted".
const EXTRA_REPOS = (
  process.env.EXTRA_REPOS ||
  'ion-tracks/IonTracks3,ion-tracks/IonTracks-FEniCSx,ion-tracks/IonTracks-Axisymmetric,ion-tracks/IonTracks-experiments-archive,ion-tracks/experimental-data,AutarkEOS/Autark'
).split(',');

// Repos where work lands through merge commits of PR branches; counted from merged PRs instead.
const PR_REPOS = (process.env.PR_REPOS || 'Expensify/App').split(',');

const YEAR_Q = `query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) {
  contributionsCollection(from: $from, to: $to) {
    totalCommitContributions totalIssueContributions totalPullRequestContributions
    totalPullRequestReviewContributions totalRepositoryContributions restrictedContributionsCount
    contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
  } } }`;

export const apiClient = () => makeClient(TOKEN);

function streaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.date > today) break;
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const past = days.filter((d) => d.date <= today);
  // today without contributions yet does not break the streak
  let i = past.length - 1;
  if (past[i]?.contributionCount === 0) i--;
  for (; i >= 0 && past[i].contributionCount > 0; i--) current++;
  return { longest, current };
}

export async function getActivity() {
  if (!process.env.REFRESH_STATS && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const client = makeClient(TOKEN);
  const u = (await client.gql(`query($login: String!) { user(login: $login) { id createdAt } }`, { login: LOGIN })).user;
  const first = new Date(u.createdAt).getUTCFullYear();
  const last = new Date().getUTCFullYear();
  const totals = { contributions: 0, commits: 0, issues: 0, prs: 0, reviews: 0, repos: 0, restricted: 0 };
  const repos = new Set();
  let days = [];
  for (let y = first; y <= last; y++) {
    const c = (await client.gql(YEAR_Q, { login: LOGIN, from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` })).user
      .contributionsCollection;
    totals.contributions += c.contributionCalendar.totalContributions;
    totals.commits += c.totalCommitContributions;
    totals.issues += c.totalIssueContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    totals.repos += c.totalRepositoryContributions;
    totals.restricted += c.restrictedContributionsCount;
    for (const r of c.commitContributionsByRepository) repos.add(r.repository.nameWithOwner);
    days = days.concat(c.contributionCalendar.weeks.flatMap((w) => w.contributionDays));
  }
  days = [...new Map(days.map((d) => [d.date, d])).values()].sort((a, b) => a.date.localeCompare(b.date));

  // last 53 weeks, Sunday-aligned like GitHub's graph
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay());
  const byDate = new Map(days.map((d) => [d.date, d.contributionCount]));
  const calendar = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    calendar.push({ date, count: byDate.get(date) ?? 0 });
  }

  for (const r of EXTRA_REPOS) repos.add(r);
  const lines = await countLines(client, { repos: [...repos], prRepos: PR_REPOS, authorId: u.id, login: LOGIN, since: u.createdAt });

  const best = days.reduce((m, d) => (d.contributionCount > m.contributionCount ? d : m), days[0]);
  const activity = {
    totals,
    lines,
    calendar,
    yearTotal: calendar.reduce((s, d) => s + d.count, 0),
    streak: streaks(days),
    best: { date: best.date, count: best.contributionCount },
    since: u.createdAt.slice(0, 10),
  };
  fs.writeFileSync(CACHE, JSON.stringify(activity, null, 2));
  return activity;
}
