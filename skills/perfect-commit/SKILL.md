---
name: perfect-commit
description: Enforces Simon Willison's "Perfect Commit" principles whenever creating commits or pull requests. Use this skill whenever you are about to commit code, create a PR, or the user asks you to commit, ship, merge, or submit changes. Also triggers on /commit if the user has custom commit workflows. Even small changes benefit from this — don't skip it just because the change looks trivial.
---

# The Perfect Commit

Based on Simon Willison's principles: every commit should be a single, focused, deployable unit that bundles **implementation, tests, documentation, and context** together. A commit isn't just code — it's a complete record of a change that future-you (or someone else) can understand, trust, and safely revert.

This skill applies when you're making commits or creating PRs. It doesn't replace your normal workflow — it wraps around the final step to make sure nothing ships incomplete.

## The Four Pillars

### 1. Implementation — One focused change

Each commit should do one thing. Not "one file" — one logical change. A feature, a bug fix, a refactor. Something that makes sense as an atomic unit.

Why this matters: clean `git blame`, easy reverts, reviewable diffs, and a main branch that stays deployable. If you can't describe the commit in one sentence, it might be doing too much.

If you're working on something exploratory, do the messy work in a branch and squash-merge into a clean commit at the end.

### 2. Tests — Prove it works, prove it was broken

Every commit that changes behavior should include tests. But not just any tests — tests that **actually verify the change matters**:

- **Write the test first against the existing code** (or mentally verify the scenario). The test should **fail without your implementation**. If a test passes before and after your change, it proves nothing.
- **Then confirm the test passes with your implementation**. This red-green cycle is the proof that your change does what it claims.

This is "tests-included development" — the test and implementation ship together in the same commit. You don't need to practice strict TDD, but the final commit must bundle both.

**Proving the red-green cycle:**
1. Write the test for the new behavior
2. Stash or revert your implementation changes, run the test — it should **fail**
3. Reapply your implementation, run the test — it should **pass**
4. If the test passes both ways, it's not testing your change. Rewrite it.

If the project has no test infrastructure yet, set it up — even a single `assert 1 + 1 == 2` to get the framework in place. Future tests become trivial once the first one exists. Use cookiecutter templates or framework generators to bootstrap testing from the start.

For projects with public APIs, CLI commands, or config surfaces, consider writing **documentation unit tests** that introspect the code and verify each documentable item is covered. Read `references/documentation-unit-tests.md` for the full pattern — it's especially valuable when adding new public interfaces.

Exceptions: pure typo fixes, comment changes, or config tweaks that have no behavioral impact don't need tests.

### 3. Documentation — Update it in the same commit

If your change affects anything user-facing — an API, a CLI command, a function signature, a config option — update the docs in the same commit.

Documentation that lives in the same repo as code is trustworthy because:
- It's versioned alongside the code
- It gets reviewed in the same PR
- `git blame` shows when docs and code diverge
- People can quickly verify docs match the current version

You don't need to write a novel. Even a single sentence addition compounds over time into comprehensive docs. The key is that **docs ship with the code that changes them**, not as a follow-up that never happens.

What counts as documentation:
- README updates
- Docstrings/JSDoc on changed public APIs
- CLI help text
- Inline comments where the logic isn't self-evident (but don't over-comment obvious code)
- Migration guides if you're making a breaking change

Exceptions: internal refactors that don't change public behavior, or bug fixes where the docs already describe the correct (now-fixed) behavior.

### 4. Context — Link to an issue or explain why

Every meaningful commit should carry context about *why* the change was made. The best way is a link to an issue thread, because issues provide unlimited space for:

- Background and motivation
- Screenshots and before/after comparisons
- Design decisions and alternatives considered
- Links to relevant discussions, docs, or inspiration
- Prototypes and code snippets from exploration

**If there's no existing issue, create one.** Even a brief issue created seconds before committing is better than no context at all. Issue threads are more discoverable, support embedded media, and can be extended after the commit lands — all things commit messages can't do well.

If the project genuinely doesn't use an issue tracker, put a concise "why" in the commit message body. But strongly prefer creating issues — they are cheap to make and invaluable months later.

The commit message title should be a clear one-line summary. The body should link to the issue. Don't write an essay in the commit message — that's what the issue thread is for.

## UI Changes — Show, don't just tell

When a commit changes something visual (frontend components, layouts, styling, CLI output formatting), **screenshots are not optional**:

- Use **Playwright** (via the MCP tools if available) to capture before/after screenshots programmatically
- For PRs, embed screenshots directly in the PR description
- For issues, add them as comments before or alongside the commit
- Animated GIFs or short recordings are even better for interaction changes — tools like LICEcap or QuickTime screen capture work well

Reviewers should never have to check out a branch to see what a UI change looks like. The visual diff belongs in the PR/issue alongside the code diff.

## Putting It Together — The Checklist

Before you commit or create a PR, run through this:

- [ ] **Focused change**: Does this commit do one logical thing?
- [ ] **Tests included**: Do tests ship with this commit? Do they fail without the implementation?
- [ ] **Docs updated**: If behavior changed, are docs updated in this commit?
- [ ] **Issue linked**: Is there an issue providing context? If not, create one.
- [ ] **UI shown**: If it's a visual change, are screenshots/recordings attached?
- [ ] **Deployable**: Could this commit be deployed on its own without breaking anything?

If something is missing, fix it before committing. The goal isn't ceremony — it's that every commit in the history is a complete, understandable, trustworthy unit of work.

## Branch Workflow

For exploratory or experimental work, don't force this discipline on every intermediate save. Work in a branch with messy WIP commits, then squash-merge into a single perfect commit for the main branch. The perfect commit is the *final product*, not every step along the way.

## References

- `references/the-perfect-commit.md` — The full original blog post by Simon Willison with all examples, reasoning, and real commit links. Read this for the philosophy and to see concrete examples of perfect commits in the wild.
- `references/documentation-unit-tests.md` — How to write unit tests that enforce documentation coverage (based on Simon Willison's "Documentation unit tests" approach). Read this when adding public APIs, CLI commands, or config options.
