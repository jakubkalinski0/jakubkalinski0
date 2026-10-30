// Career as a real git history, so the graph window shows genuine `git log --graph` output:
//   node career-graph.mjs  -> .cache/career-graph.txt   (run from profile/, then rebuild)
// Builds a throwaway repo with one empty commit per milestone, branches wrss / bit / swm / psi
// merged back into main, then saves the coloured log. Fixed dates and author keep it stable.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = path.resolve('.cache/career-graph.txt');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-'));

const git = (args, date) =>
  execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'jakub',
      GIT_AUTHOR_EMAIL: 'jakub@krakow',
      GIT_COMMITTER_NAME: 'jakub',
      GIT_COMMITTER_EMAIL: 'jakub@krakow',
      ...(date && { GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` }),
    },
  });
const commit = (date, msg) => git(['commit', '--allow-empty', '-q', '-m', msg], date);
const merge = (date, branch) => git(['merge', '--no-ff', '-q', '-m', `Merge branch '${branch}'`, branch], date);

git(['init', '-q', '-b', 'main']);
git(['config', 'commit.gpgsign', 'false']);
commit('2023-10-01', 'init(agh): B.Eng. Computer Science, AGH Kraków');
git(['checkout', '-q', '-b', 'wrss']);
commit('2024-10-15', 'feat(wrss): join the WRSS WI AGH board, faculty student council');
git(['checkout', '-q', '-b', 'bit', 'main']);
commit('2024-11-15', 'feat(bit): join BIT, game theory section');
git(['checkout', '-q', 'main']);
commit('2025-03-22', 'feat(hackathon): EcoScan wins Software Mansion Hackathon');
git(['checkout', '-q', 'bit']);
commit('2025-05-20', 'docs(bit/morris): Multistage Morris AI talk at 62nd HSKKN');
git(['checkout', '-q', '-b', 'swm', 'main']);
commit('2025-07-01', 'feat(swm): join Software Mansion, work on New Expensify');
git(['checkout', '-q', 'main']);
merge('2025-10-31', 'bit');
commit('2025-11-10', 'feat(thesis): IonTracks: ion recombination on HPC');
git(['checkout', '-q', 'swm']);
commit('2026-02-27', 'feat(swm/mfa): biometric transaction approval, Expensify Cards UK/EU');
commit('2026-03-31', 'feat(swm/odometer): odometer expenses shipped to all users');
git(['checkout', '-q', 'main']);
commit('2026-04-20', 'docs(kukdm): talk on FEM ion recombination on PLGrid');
merge('2026-06-20', 'wrss');
merge('2026-06-30', 'swm');
git(['checkout', '-q', '-b', 'psi']);
commit('2026-07-01', 'feat(psi): join PSI, Radiation Metrology Group, Villigen');
commit('2026-08-12', 'fix(psi/IonTracks-FEniCSx): stale MPI ghost entries blew densities up to 1e86');
commit('2026-09-16', 'perf(psi/axitracks): 6,027x faster than IonTracks-FEniCSx');
git(['checkout', '-q', 'main']);
merge('2026-09-30', 'psi');
commit('2026-10-26', 'feat(iontracks3): full-fledged recombination simulator with new RDD model');

// Graph and decorations keep git's own colours; fields are split by \x1f.
const log = git([
  'log', '--graph', '--all', '--date-order', '--color=always', '--date=format:%b %Y',
  '--format=%C(auto)%h\x1f%C(auto)%D\x1f%s\x1f%ad',
]);
fs.rmSync(dir, { recursive: true, force: true });
fs.writeFileSync(OUT, log);
console.log(log.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1f/g, ' | '));
