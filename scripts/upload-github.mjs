// Authorized private source upload only; never deploys a website or force-pushes.
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

let gh = 'gh';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--gh' && process.argv[i + 1]) gh = resolve(process.argv[++i]);
  else throw Error('Usage: node scripts/upload-github.mjs [--gh /path/to/gh]');
}
const owner = 'fogra-spec', name = 'parkly-smart-parking', repository = owner + '/' + name;
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' };
function run(program, args) { return execFileSync(program, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function api(path, args = []) { return JSON.parse(run(gh, ['api', path, ...args])); }
function optionalApi(path) {
  const result = spawnSync(gh, ['api', path], { env, encoding: 'utf8' });
  if (result.status === 0) return JSON.parse(result.stdout);
  if (/\(HTTP 404\)/.test(result.stderr || '')) return null;
  throw Error('GitHub lookup failed. Check CLI login and repository permissions; no repository was created.');
}
const login = api('user').login;
if (login !== owner) throw Error('Expected GitHub account ' + owner + '; authenticated as ' + login + '. No upload performed.');
run('git', ['diff', '--quiet']); run('git', ['diff', '--cached', '--quiet']);
run(process.execPath, ['scripts/check-course-safety.mjs', '--staged']);
const branch = run('git', ['branch', '--show-current']);
if (!branch) throw Error('Detached HEAD; select the intended existing branch before upload.');
const sha = run('git', ['rev-parse', 'HEAD']);
let info = optionalApi('repos/' + repository), created = false;
if (!info) {
  run(gh, ['repo', 'create', repository, '--private', '--description', 'Educational smart parking discovery and reservation platform with driver/operator dashboards, PostgreSQL database, and Web Push notifications.']);
  created = true; info = api('repos/' + repository);
}
if (info.owner.login !== owner || info.full_name !== repository || info.private !== true) throw Error('Repository owner/name/private visibility mismatch; no push performed.');
const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { env, encoding: 'utf8' });
if (remote.status === 0) {
  if (remote.stdout.trim() !== info.clone_url) throw Error('Existing origin differs from the verified target; refusing to overwrite it.');
} else run('git', ['remote', 'add', 'origin', info.clone_url]);
// A command helper obtains credentials from the user's authenticated gh process,
// without placing a token in arguments, config files or repository content.
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const gitArgs = ['-c', 'credential.helper=', '-c', 'credential.helper=!' + shellQuote(gh) + ' auth git-credential'];
function git(args) { return run('git', [...gitArgs, ...args]); }
const references = git(['ls-remote', 'origin', 'refs/heads/*']);
if (references) {
  const sameBranch = references.split('\n').find(line => line.endsWith('\trefs/heads/' + branch));
  const base = sameBranch ? branch : info.default_branch;
  git(['fetch', 'origin', base]);
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], { env });
  if (ancestry.status !== 0) throw Error('Remote history is not an ancestor of this checkout. Review/merge it before uploading; no force push attempted.');
}
git(['push', '--set-upstream', 'origin', branch]);
if (created && info.default_branch !== branch) api('repos/' + repository, ['--method', 'PATCH', '-f', 'default_branch=' + branch]);
const remoteHead = api('repos/' + repository + '/git/ref/heads/' + branch);
if (remoteHead.object.sha !== sha) throw Error('Remote/local commit SHA mismatch. Upload is not verified.');
info = api('repos/' + repository);
if (info.private !== true) throw Error('Visibility changed; inspect GitHub before claiming a private upload.');
const commit = api('repos/' + repository + '/git/commits/' + sha);
const tree = api('repos/' + repository + '/git/trees/' + commit.tree.sha + '?recursive=1');
if (tree.truncated) throw Error('Remote tree was truncated; inspect before claiming complete upload.');
const paths = tree.tree.filter(entry => entry.type === 'blob').map(entry => entry.path);
for (const path of ['README.md', '.env.example', 'package.json', 'pnpm-lock.yaml', 'app/parkly.tsx', 'backend/src/http-handler.ts', 'backend/migrations/001_core.sql', 'backend/migrations/014_password_settings.sql', 'backend/.env.example', 'public/sw.js', 'public/manifest.webmanifest', 'api/parkly.ts', 'vercel.json']) {
  if (!paths.includes(path)) throw Error('Required remote source file missing: ' + path);
}
if (paths.some(path => /(?:^|\/)\.env(?:$|\.)/.test(path) && !path.endsWith('.env.example'))) throw Error('A private .env was uploaded; rotate and inform the owner.');
console.log(JSON.stringify({ url: info.html_url, visibility: 'Private', branch, commit: sha, remoteCommit: remoteHead.object.sha, files: paths.length, verified: true }, null, 2));
