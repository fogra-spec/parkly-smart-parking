# Private GitHub source handoff

Target: `fogra-spec/parkly-smart-parking`. Visibility: **Private**. The prepared default branch is `main`; the existing `feature/mobile-app` branch and the initial commit's authorship are preserved. Preparation uses a fast-forward from the existing working branch, never a history rewrite. This is a private source upload, not a website deployment.

This document describes the verified local preparation. Remote creation/push is complete only after GitHub confirms the repository and matching remote/local commit IDs. Do not present a local commit or this target name as proof of upload.

## Confirmed private upload

GitHub created [fogra-spec/parkly-smart-parking](https://github.com/fogra-spec/parkly-smart-parking) as Private on 14 November 2026. The first verified upload on `main` was `da18f877875ef2db61913a4c0797f165f44169dd`, containing 332 tracked files. The GitHub ref matched the local commit exactly; required frontend/backend, migrations, lockfiles, README, environment templates and PWA/Vercel files were present. The initial commit `0d09da9` and its original author remain in history. This paragraph records that first upload; subsequent documentation commits have their own SHA.

No website was deployed. Repository access does not keep localhost running or make it accessible from another computer.

## Contents and clean-clone setup

The application root is the repository root. It includes `app/`, `components/`, `lib/`, `backend/src`, SQL migrations, seed/setup scripts, tests, PWA assets, fictional fixture definitions, `public/project` academic artifacts, optional `mobile/`, Cloudflare/Netlify adapters and the new future Vercel target. Each of root, backend and mobile has its own pnpm lockfile. Private PostgreSQL data, passwords, keys, tool caches and generated builds are excluded.

After the repository exists, authenticate to GitHub as its owner or an invited collaborator and clone it:

```bash
git clone https://github.com/fogra-spec/parkly-smart-parking.git
cd parkly-smart-parking
git switch main
pnpm install --frozen-lockfile
pnpm --dir backend install --frozen-lockfile --ignore-scripts
pnpm dev:fullstack
```

Requires Node 24+ and pnpm 10.28.0. First launch creates a local PostgreSQL cluster, applies only new checksum-tracked migrations and provisions invented test accounts. Passwords are random and live in ignored `backend/.local/.env`; never send that file to GitHub or the professor. See root README.md for roles, full-stack flow and verification.

## Required GitHub authorization

The Codex GitHub connection identifies the account `fogra-spec`. At the initial check it exposed no repositories and could not resolve the target repository. This connection provides repository operations but no repository-creation or raw Git push credentials. GitHub CLI was not installed/authenticated, so the official CLI was downloaded into ignored `.local-tools/gh/bin/gh` and its release checksum verified. That local tool is deliberately not part of a clone; collaborators should install GitHub CLI from its official distribution if needed.

From the original prepared checkout, log in yourself (never paste a password/token into chat):

```bash
".local-tools/gh/bin/gh" auth login --hostname github.com --git-protocol https --web
".local-tools/gh/bin/gh" auth status
```

After login, the upload helper checks the authenticated owner, target repository ownership/private visibility, existing remote and branch ancestry before pushing. It creates the target only if GitHub confirms it is absent; it never force-pushes, deletes a remote branch or rewrites the original commit. For an existing nonempty repository with unrelated history, it stops for review.

```bash
# Original checkout; GitHub login is required first.
node scripts/upload-github.mjs --gh .local-tools/gh/bin/gh
```

If using an independently installed gh, omit `--gh ...`. The helper verifies the branch head SHA on GitHub after pushing and checks key source/configuration/migration paths. For a new empty repository it preserves the existing branch and sets that pushed branch as the GitHub default. A pre-existing repository's default branch is preserved.

Official instructions: [GitHub CLI login](https://cli.github.com/manual/gh_auth_login), [repository creation](https://cli.github.com/manual/gh_repo_create).

## Professor access and team history

For a private repository, the owner opens repository Settings → Collaborators/Manage access and invites the professor's own GitHub username or email. The professor must accept the invitation. Do not publish the repository or share account passwords as a substitute.

Every student should clone with their own GitHub account, configure their own Git name/email (or GitHub-provided noreply address), work on their own branch and submit their own commits/PRs. Preserve existing authors; do not fabricate contribution counts or replay changes under other students' identities. The original local commit uses the system-generated local identity; it is preserved without rewriting it. Future commits should use an email linked to the student's GitHub account if attribution on GitHub is desired.

Demo video: **University OneDrive URL — TO BE ADDED AFTER RECORDING**.

## Verification snapshot, 14 November 2026

Local TypeScript checks and lint passed. Root unit tests: 17 passed. Backend: 46 passed, 1 skipped (external synthetic push transport). This includes a new isolated PostgreSQL Vercel routing/auth/booking/operator-visibility/cancellation test. The Vercel static build and ordinary production build passed. A clean source copy installed both root/backend frozen lockfiles and passed both TypeScript checks and the Vercel build. The offline-only install initially lacked cached tarballs; the normal registry-enabled install succeeded without changing either lockfile. Candidate source/history scans passed; a separate staged scan is required immediately before committing. No hosted Vercel build or device delivery is claimed.

Known application limits remain documented in COURSE_PROTOTYPE.md: no real-device push certification, incomplete immediate booking-change Web Push for both roles, no full three-student usability results. Vercel configuration/build preparation is distinct from hosted verification; Supabase schema compatibility and independent worker provisioning remain required before a real deployment.
