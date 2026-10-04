#!/usr/bin/env node
// One-time repository hardening, cross-platform (no shell heredocs). Run from inside the cloned repository.
//   node tools/repo-setup.mjs --mode solo|team [--reviewers alice,bob] [--dry-run]
// solo: PR required, 0 approvals (GitHub never lets you approve your own PR). team: 1 code-owner approval.
// Both: squash-only, auto-delete branches, linear history, ci-ok required, Dependabot off, release/prod approval gates.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const mode = opt('mode', 'team');
const dry = args.includes('--dry-run');
const extra = (opt('reviewers', '') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!['solo', 'team'].includes(mode)) {
  console.error('usage: node tools/repo-setup.mjs --mode solo|team [--reviewers a,b] [--dry-run]');
  process.exit(2);
}

function gh(ghArgs, { body, tolerate = false, read = false } = {}) {
  const line = `gh ${ghArgs.join(' ')}`;
  if (dry) {
    // Dry run never touches GitHub (reads included), so it works without gh installed or authenticated.
    if (!read) {
      console.log(line);
      if (body !== undefined) console.log(`  body: ${JSON.stringify(body)}`);
    }
    return '';
  }
  const r = spawnSync('gh', ghArgs, { encoding: 'utf8', input: body === undefined ? undefined : JSON.stringify(body) });
  if (r.error) {
    console.error(`Cannot run gh (${r.error.message}). Install GitHub CLI and run "gh auth login".`);
    process.exit(1);
  }
  if (r.status !== 0) {
    if (tolerate) {
      console.warn(`warn: ${line} -> ${(r.stderr || '').trim().split('\n')[0]}`);
      return '';
    }
    console.error(`${line}\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout.trim();
}
const REPO = 'repos/:owner/:repo';
const userId = (name) => (dry ? `<id-of-${name}>` : Number(gh(['api', `users/${name}`, '--jq', '.id'], { read: true })));
const me = dry ? '<your-user-id>' : Number(gh(['api', 'user', '--jq', '.id'], { read: true }));
const reviewers = [me, ...extra.map(userId)].map((id) => ({ type: 'User', id }));

// 1. Merge settings
gh(['repo', 'edit', '--delete-branch-on-merge', '--enable-squash-merge', '--enable-merge-commit=false', '--enable-rebase-merge=false']);
gh(['api', '-X', 'PATCH', REPO, '-f', 'squash_merge_commit_title=PR_TITLE', '-f', 'squash_merge_commit_message=PR_BODY']);

// 2. Branch protection ruleset (create, or update in place when it already exists)
const file = mode === 'solo' ? '.github/rulesets/protect-main.solo.json' : '.github/rulesets/protect-main.json';
const ruleset = JSON.parse(readFileSync(file, 'utf8'));
const existing = gh(['api', `${REPO}/rulesets`, '--jq', `.[] | select(.name=="${ruleset.name}") | .id`], { read: true });
if (existing) gh(['api', '-X', 'PUT', `${REPO}/rulesets/${existing}`, '--input', '-'], { body: ruleset });
else gh(['api', '-X', 'POST', `${REPO}/rulesets`, '--input', '-'], { body: ruleset });

// 3. No Dependabot alerts or security-update PRs
gh(['api', '-X', 'DELETE', `${REPO}/vulnerability-alerts`], { tolerate: true });
gh(['api', '-X', 'DELETE', `${REPO}/automated-security-fixes`], { tolerate: true });

// 4. Workflow token read-only; Actions cannot approve PRs
gh([
  'api',
  '-X',
  'PUT',
  `${REPO}/actions/permissions/workflow`,
  '-f',
  'default_workflow_permissions=read',
  '-F',
  'can_approve_pull_request_reviews=false',
]);

// 5. Environments. prevent_self_review=false: you CAN approve your own release (unlike a pull request).
const gate = { prevent_self_review: false, reviewers };
gh(['api', '-X', 'PUT', `${REPO}/environments/release`, '--input', '-'], { body: gate });
gh(['api', '-X', 'PUT', `${REPO}/environments/dev`]);
gh(['api', '-X', 'PUT', `${REPO}/environments/prod`, '--input', '-'], { body: gate });

console.log(
  dry ? '\n(dry run: nothing was changed)' : `\nDone (${mode} mode). Verify: gh api ${REPO}/rulesets --jq ".[] | {name, enforcement}"`,
);
