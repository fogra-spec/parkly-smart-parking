// Read-only pre-upload audit. Never print matched secret values.
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';

const git = args => execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 });
const notice = 'Educational project for the course Business Analysis, Astana IT University. Not a real product or service. All data are fictional.';
for (const path of ['README.md', 'backend/README.md']) {
  assert.ok((await readFile(path, 'utf8')).startsWith(notice), 'Missing required README notice: ' + path);
}
for (const path of ['.env', '.env.local', 'backend/.env', 'backend/.local/.env', '.vercel/project.json', '.local-tools/gh/bin/gh']) {
  execFileSync('git', ['check-ignore', '-q', path]);
}
const staged = process.argv.includes('--staged');
const files = git(staged ? ['ls-files', '-z'] : ['ls-files', '-c', '-o', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
const forbidden = /(?:^|\/)(?:node_modules|\.local|\.git|\.vercel|\.netlify|\.sites-runtime|\.local-tools|outputs|coverage|dist-vercel)(?:\/|$)|(?:^|\/)\.env(?:$|\.)|\.(?:pem|key|p12|pfx|keystore)$/;
let env = {};
try { env = parseEnv(await readFile('backend/.local/.env', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const settings = env.PARKLY_LOCAL_DATABASE_SETTINGS ? JSON.parse(env.PARKLY_LOCAL_DATABASE_SETTINGS) : {};
const secrets = [settings.ownerPassword, settings.apiPassword, settings.notificationPassword,
  env.PARKLY_VAPID_PRIVATE_KEY, env.PARKLY_PUSH_ENCRYPTION_KEY,
  env.PARKLY_LEGACY_BROWSER_ACCOUNT ? JSON.parse(env.PARKLY_LEGACY_BROWSER_ACCOUNT).password : undefined,
  ...(env.PARKLY_FIXTURE_ACCOUNTS ? JSON.parse(env.PARKLY_FIXTURE_ACCOUNTS).map(account => account.password) : [])
].filter(value => value?.length >= 20);
function inspect(content, label) {
  assert.ok(!secrets.some(secret => content.includes(Buffer.from(secret))), 'Private local credential found in ' + label);
  const text = content.toString('utf8');
  const patterns = [
    /^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n/m,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/,
    /\bsb_secret_[A-Za-z0-9_-]{24,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
  ];
  assert.ok(!patterns.some(pattern => pattern.test(text)), 'Credential/key pattern found in ' + label);
  for (const match of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"`]+/g)) {
    try {
      const password = decodeURIComponent(new URL(match[0]).password);
      assert.ok(!password || /CHANGE_ME|placeholder|example|<|>|\$|\{|\}/i.test(password), 'Non-placeholder database password in ' + label);
    } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; }
  }
  for (const token of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)) {
    try { assert.notEqual(JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url')).role, 'service_role', 'Supabase service-role token in ' + label); }
    catch (error) { if (error.code === 'ERR_ASSERTION') throw error; }
  }
}
for (const path of new Set(files)) {
  assert.ok(path.endsWith('.env.example') || !forbidden.test(path), 'Private/generated file selected: ' + path);
  if (staged) inspect(git(['show', ':' + path]), 'index:' + path);
  else {
    if (!(await lstat(path)).isFile()) throw Error('Review non-regular source file before upload: ' + path);
    inspect(await readFile(path), path);
  }
}
const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n').filter(Boolean);
const batch = execFileSync('git', ['cat-file', '--batch'], { input: objects.map(line => line.split(' ')[0]).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
let offset = 0, blobs = 0;
while (offset < batch.length) {
  const newline = batch.indexOf(10, offset);
  const [sha, type, sizeText] = batch.subarray(offset, newline).toString().split(' ');
  const size = Number(sizeText); assert.ok(Number.isFinite(size));
  if (type === 'blob') { blobs++; inspect(batch.subarray(newline + 1, newline + 1 + size), 'Git object ' + sha); }
  offset = newline + 1 + size + 1;
}
console.log(`PASS: ${new Set(files).size} ${staged ? 'staged' : 'candidate'} files and ${blobs} historical blobs checked; required notices/ignore rules intact; no known local credentials or supported secret patterns found. Local .env comparison: ${secrets.length ? 'enabled' : 'not available in clean checkout'}. Not a universal secret detector.`);
