import { execFileSync } from 'node:child_process';

function git(...args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function records(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const headings = [...text.matchAll(/^Prompt (\d+): ([^\r\n]+)\r?$/gm)];
  if (!headings.length || headings[0].index !== 0) {
    throw new Error('PROMPTS.md must start with Prompt 1: followed by a three-word summary.');
  }
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading[1] !== String(i + 1)) {
      throw new Error('Prompt numbers must be consecutive, starting at 1.');
    }
    if (heading[2].trim().split(/\s+/).length !== 3) {
      throw new Error(`Prompt ${i + 1} must have exactly three summary words.`);
    }
    const body = text.slice(heading.index + heading[0].length, headings[i + 1]?.index);
    if (!/^\r?\n\r?\n/.test(body) || !body.trim()) {
      throw new Error(`Prompt ${i + 1} needs a blank line and verbatim prompt text.`);
    }
  }
  if (!text.endsWith('\n')) throw new Error('End PROMPTS.md with a newline.');
  return headings.length;
}

try {
  let staged;
  try {
    staged = git('show', ':PROMPTS.md');
  } catch {
    throw new Error('Stage PROMPTS.md with a new verbatim prompt record.');
  }

  // The index, not the working tree, is the content this commit will record.
  const nextCount = records(staged);
  let previous = Buffer.alloc(0);
  let hasHead = true;
  try {
    git('rev-parse', '--verify', 'HEAD');
  } catch {
    hasHead = false;
  }
  if (hasHead && git('ls-tree', '--name-only', 'HEAD', '--', 'PROMPTS.md').length) {
    previous = git('show', 'HEAD:PROMPTS.md');
  }
  const previousCount = previous.length ? records(previous) : 0;
  if (!staged.subarray(0, previous.length).equals(previous)) {
    throw new Error('PROMPTS.md is append-only: earlier committed bytes must not change.');
  }
  const suffix = staged.subarray(previous.length).toString('utf8');
  if (nextCount <= previousCount || !/^\s*Prompt \d+: /.test(suffix)) {
    throw new Error('Every commit must append a new Prompt N record; stage the prompt for this work.');
  }
  console.log(`Prompt check passed: ${nextCount - previousCount} new record(s).`);
} catch (error) {
  console.error(`Prompt check failed: ${error.message}`);
  process.exitCode = 1;
}
