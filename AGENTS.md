# Project workflow

- Record every user-authored project prompt verbatim in `PROMPTS.md`, including questions and corrections. Preserve spelling, punctuation, capitalization, and line breaks. Do not include generated environment context, tool output, or assistant messages.
- Append only. Never edit, remove, reorder, or renumber earlier records. Use `Prompt N: Three word summary` as a plain heading, with the next sequential number and exactly three whitespace-separated summary words, followed by a blank line and the exact prompt text.
- Every commit must stage at least one new prompt record for the request it implements. If one request requires multiple commits, repeat its exact text under a new sequential heading in each commit. Record intervening prompts as well; do not invent a new user request to satisfy the hook.
- Install the tracked pre-commit hook with `npm run setup:hooks` (also run automatically by `npm install` and `npm ci`). Do not bypass the prompt check.
- Put all project work up as a PR for user review. Do not merge your own work without authorization.

The initial prompt history contains the nine user-authored project prompts available in the recovery conversation. Earlier project conversations were not available and must not be reconstructed from guesses or commit messages. If their exact text becomes available, append it with a new number; do not rewrite existing history.
