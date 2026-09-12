import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, chmodSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const first = 'Prompt 1: Record Initial Request\n\nKeep this typo verbatimm.\n';
const second = '\nPrompt 2: Record Next Request\n\nPreserve this next request.\n';

function repository(t, initial = first) {
  const cwd = mkdtempSync(join(tmpdir(), 'vintage-prompt-hook-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  // Git exports repository/index variables when tests run inside a hook.
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  const git = (...args) => spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  const ok = (...args) => {
    const result = git(...args);
    assert.equal(result.status, 0, result.stderr);
    return result;
  };
  ok('init', '--quiet');
  ok('config', 'user.name', 'Hook Test');
  ok('config', 'user.email', 'hook@example.test');
  ok('config', 'commit.gpgsign', 'false');
  mkdirSync(join(cwd, '.githooks'));
  mkdirSync(join(cwd, 'scripts'));
  for (const path of ['.githooks/pre-commit', 'scripts/check-prompts.mjs']) {
    copyFileSync(join(root, path), join(cwd, path));
  }
  chmodSync(join(cwd, '.githooks/pre-commit'), 0o755);
  ok('config', 'core.hooksPath', '.githooks');
  const write = (content) => writeFileSync(join(cwd, 'PROMPTS.md'), content);
  if (initial !== null) {
    write(initial);
    ok('add', 'PROMPTS.md');
    ok('commit', '--quiet', '-m', 'Initial request');
  }
  writeFileSync(join(cwd, 'work.txt'), 'Change answering a request.\n');
  ok('add', 'work.txt');
  return { git, ok, write };
}

test('permits an initial commit with recorded prompts', (t) => {
  const repo = repository(t, null);
  repo.write(first);
  repo.ok('add', 'PROMPTS.md');
  repo.ok('commit', '--quiet', '-m', 'Bootstrap');
});

test('rejects an initial commit without a prompt file', (t) => {
  const repo = repository(t, null);
  assert.notEqual(repo.git('commit', '--quiet', '-m', 'Missing prompt').status, 0);
});

test('permits multiple appended records with verbatim multiline text', (t) => {
  const repo = repository(t);
  repo.write(first + second + '\nPrompt 3: Preserve Typed Whitespace\n\n  Exact spacing.\nSecond line: $value `literal`.\n');
  repo.ok('add', 'PROMPTS.md');
  repo.ok('commit', '--quiet', '-m', 'Recorded requests');
});

for (const [name, content] of [
  ['unchanged history', first],
  ['whitespace without a record', first + '\n\n'],
  ['edited earlier prompt', first.replace('verbatimm', 'verbatim') + second],
  ['deleted earlier prompt', second.trimStart()],
  ['skipped number', first + second.replace('Prompt 2:', 'Prompt 3:')],
  ['two-word summary', first + second.replace('Record Next Request', 'Next Request')],
  ['empty prompt', first + '\nPrompt 2: Record Next Request\n\n'],
  ['missing blank line', first + '\nPrompt 2: Record Next Request\nSome text.\n'],
  ['extra text before new record', first + 'Retrofitted old prompt text.\n' + second]
]) {
  test(`rejects ${name}`, (t) => {
    const repo = repository(t);
    repo.write(content);
    repo.ok('add', 'PROMPTS.md');
    const result = repo.git('commit', '--quiet', '-m', 'Invalid history');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Prompt check failed:/);
    assert.equal(repo.ok('rev-list', '--count', 'HEAD').stdout.trim(), '1');
  });
}

test('rejects a new prompt present only in the working tree', (t) => {
  const repo = repository(t);
  repo.write(first + second);
  assert.notEqual(repo.git('commit', '--quiet', '-m', 'Unstaged prompt').status, 0);
});

test('rejects staged deletion of PROMPTS.md', (t) => {
  const repo = repository(t);
  repo.ok('rm', 'PROMPTS.md');
  assert.notEqual(repo.git('commit', '--quiet', '-m', 'Delete history').status, 0);
});

test('checks staged content even if working-tree history is edited later', (t) => {
  const repo = repository(t);
  repo.write(first + second);
  repo.ok('add', 'PROMPTS.md');
  repo.write('Unstaged content must not be committed.\n');
  repo.ok('commit', '--quiet', '-m', 'Correct staged history');
  assert.equal(repo.ok('show', 'HEAD:PROMPTS.md').stdout, first + second);
});

test('allows the same user prompt to be recorded for a subsequent commit', (t) => {
  const repo = repository(t);
  repo.write(first + '\n' + first.replace('Prompt 1:', 'Prompt 2:'));
  repo.ok('add', 'PROMPTS.md');
  repo.ok('commit', '--quiet', '-m', 'Continue same request');
});
