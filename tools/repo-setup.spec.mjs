import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dry = (...a) => execFileSync('node', ['tools/repo-setup.mjs', '--dry-run', ...a], { encoding: 'utf8' });
const rulesetBody = (out) => JSON.parse(/body: (\{"name":"protect-main".*\})/.exec(out)[1]);
const pr = (rs) => rs.rules.find((r) => r.type === 'pull_request').parameters;

test('solo mode: a pull request is still required but no second approver is', () => {
  const rs = rulesetBody(dry('--mode', 'solo'));
  assert.equal(pr(rs).required_approving_review_count, 0);
  assert.equal(pr(rs).require_code_owner_review, false);
  assert.deepEqual(pr(rs).allowed_merge_methods, ['squash']);
  assert.ok(rs.rules.some((r) => r.type === 'required_status_checks'));
});

test('team mode: one code-owner approval; solo and team differ only in the pull_request rule', () => {
  const team = rulesetBody(dry('--mode', 'team'));
  assert.equal(pr(team).required_approving_review_count, 1);
  assert.equal(pr(team).require_code_owner_review, true);
  const solo = rulesetBody(dry('--mode', 'solo'));
  for (const rs of [team, solo]) pr(rs).required_approving_review_count = pr(rs).require_code_owner_review = 0;
  assert.deepEqual(team, solo);
});

test('release and prod gates allow self-approval; extra reviewers are added; everything is cross-platform (no shell)', () => {
  const out = dry('--mode', 'solo', '--reviewers', 'alice');
  for (const env of ['release', 'prod']) {
    const m = new RegExp(`environments/${env} --input -\\n  body: (.*)`).exec(out);
    const body = JSON.parse(m[1]);
    assert.equal(body.prevent_self_review, false);
    assert.equal(body.reviewers.length, 2);
  }
  assert.match(out, /vulnerability-alerts/);
  assert.match(out, /--delete-branch-on-merge --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false/);
  assert.ok(
    !/<<|\$\(/.test(readFileSync('tools/repo-setup.mjs', 'utf8').replace(/\$\{[^}]*\}/g, '')),
    'no shell heredocs or command substitution',
  );
});

test('rejects an unknown mode', () => {
  assert.throws(() => dry('--mode', 'chaos'));
});
