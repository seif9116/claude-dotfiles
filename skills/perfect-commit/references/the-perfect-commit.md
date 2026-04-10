# The Perfect Commit — Simon Willison

Source: https://simonwillison.net/2022/Oct/29/the-perfect-commit/

## The Core Definition

A single commit containing four essential components:

1. **Implementation** — a focused, singular change
2. **Tests** demonstrating the implementation works
3. **Updated documentation** reflecting the change
4. **A link to an issue thread** providing context

Our job as software engineers generally isn't to write new software from scratch: we spend the majority of our time adding features and fixing bugs in existing software. The commit is our principal unit of work. It deserves to be treated thoughtfully and with care.

## Implementation

Each commit should change a single thing. The definition of "thing" is deliberately vague — the goal is to have something that can be easily reviewed, and that can be clearly understood in the future when revisited using tools like `git blame` or `git bisect`.

Benefits of focused commits:
- Easy code review
- Clear understanding via git blame / git bisect
- Linear commit history for comprehension
- Clean reversion or cherry-picking capability
- For web applications, commits should represent deployable units

## Tests

The ultimate goal of tests is to increase your productivity. If your testing practices are slowing you down, you should consider ways to improve them.

How do you know when the change you have made is finished and ready to commit? It's ready when the new tests pass.

Without tests, there's a very strong possibility that your change will have broken some other, potentially unrelated feature. Your commit could be held up by hours of tedious manual testing. Or you could YOLO it and learn that you broke something important later.

Writing tests becomes far less time consuming if you already have good testing practices in place. Adding a new test to a project with a lot of existing tests is easy: you can often find an existing test that has 90% of the pattern you need already worked out for you.

Start every single project with a passing test. It doesn't matter what this test is — `assert 1 + 1 == 2` is fine! The key thing is to get a testing framework in place, such that you can run a command to execute the test suite — and you have an obvious place to add new tests in the future.

Simon advocates "tests-included development" rather than test-first. What matters is tests-included development, where the final commit bundles the tests and the implementation together.

## Documentation

If your project defines APIs that are meant to be used outside of your project, they need to be documented. This includes:
- Python APIs (modules, functions and classes) designed to be imported
- Web APIs (usually JSON over HTTP)
- Command line interface tools

It is critical that documentation must live in the same repository as the code itself:
- Documentation is only valuable if people trust it. People will only trust it if they know it is kept up to date.
- If docs live in a separate wiki it's easy for them to get out of date — and hard for anyone to quickly confirm if docs are in sync with code.
- Documentation should be versioned alongside code.
- Documentation changes should be reviewed in the same way as code.
- Ideally, documentation should be tested (see documentation-unit-tests.md).

Many commits include documentation that is just a sentence or two. This doesn't take very long to write, but it adds up to something very comprehensive over time.

## A Link to an Issue

Every perfect commit should include a link to an issue thread. Sometimes Simon opens an issue seconds before writing the commit message, just to have something to link to.

Issue threads provide effectively unlimited space for commentary and background:
- **Background**: the reason for the change (in the opening comment)
- **State of play before the change**: links to the current version of code and docs
- **Links**: inspiration, relevant documentation, conversations on Slack or Discord, StackOverflow clues
- **Code snippets**: illustrating potential designs and false-starts (use fenced code blocks for syntax highlighting)
- **Decisions**: what was considered, what was decided, and the reasoning
- **Screenshots**: before/after, animated screenshots (LICEcap for GIFs, QuickTime for videos), dropped straight into GitHub issue comments
- **Prototypes**: code from console sessions, blocks of HTML/CSS, UI prototype screenshots

After closing issues, add one last comment linking to the updated documentation and ideally a live demo.

## Issue Threads vs. Commit Messages

Simon moved from lengthy commit messages to issue threads because they:
- Support embedded media
- Are more discoverable
- Can be extended after the commit lands
- Provide better long-term context

Today many of his commit messages are a single line summary and a link to an issue. The biggest benefit of lengthy commit messages is that they survive as long as the repo — so consider the long term archival value. Simon uses github-to-sqlite to maintain an ongoing archive of issues as a SQLite database.

## Not Every Commit Needs to Be "Perfect"

- Typo fix for documentation or a comment? Just ship it.
- Bug fix that doesn't deserve documentation? Still bundle implementation + test + issue link, but no need to update docs if they already describe the correct (bug-free) behavior.
- Generally, aiming for implementation, tests, documentation and an issue link covers almost all work. It's a really good default model.

## Branch Workflow

For exploratory or experimental code, work in a branch with "WIP" commit messages and failing tests with abandon. Then squash-merge into a single perfect commit (sometimes via a self-closed GitHub pull request) to keep the main branch tidy.

## Real Examples

- Upgrade Docker images to Python 3.11 for datasette #1853 — tiny change, still includes tests, docs and an issue link
- sqlite-utils schema now takes optional tables for sqlite-utils #299
- shot-scraper html command for shot-scraper #96
- s3-credentials put-objects command for s3-credentials #68
- Initial implementation for datasette-gunicorn #1 — first commit to this repository, still bundled tests, docs, implementation and an issue link
