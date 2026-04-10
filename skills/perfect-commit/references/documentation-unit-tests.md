# Documentation Unit Tests

Based on Simon Willison's approach: use unit tests to enforce that code is documented, so documentation can never silently fall behind the codebase.

## Core Idea

Introspect the code to find what needs documenting (public APIs, CLI commands, config options, view classes, plugin hooks), then introspect the documentation to verify each item is covered. Write this as an automated test.

The test can't verify documentation *quality*, but it prevents the common failure mode of adding a feature and forgetting to document it.

## Pattern

1. **Introspect the code** — use reflection/dir()/AST parsing to discover documentable items (functions, classes, config keys, CLI commands, routes, hooks)
2. **Introspect the docs** — parse README, docstrings, or doc files to extract what's covered (regex for labels, headings, function names, etc.)
3. **Compare** — assert that every code item appears in the docs

## Python/pytest Example

```python
from pathlib import Path
import re

docs_path = Path(__file__).parent.parent / "docs"
label_re = re.compile(r"\.\. _([^\s:]+):")

def get_labels(filename):
    contents = (docs_path / filename).open().read()
    return set(label_re.findall(contents))

def documented_views():
    view_labels = set()
    for filename in docs_path.glob("*.rst"):
        for label in get_labels(filename):
            first_word = label.split("_")[0]
            if first_word.endswith("View"):
                view_labels.add(first_word)
    return view_labels

@pytest.mark.parametrize("view_class", [
    v for v in dir(app) if v.endswith("View")
])
def test_view_classes_are_documented(documented_views, view_class):
    assert view_class in documented_views
```

## Practical Adaptations

- **For APIs**: introspect route definitions, assert each has a corresponding section in API docs
- **For CLI tools**: introspect Click/argparse commands, assert each appears in help docs or README
- **For config options**: introspect config schema/defaults, assert each is documented
- **For JS/TS**: use AST parsing or export analysis to find public API surface, check against docs

## Bootstrapping in an Existing Project

Use pytest's `@pytest.mark.xfail` to mark undocumented items as "expected to fail" — this lets you add the test immediately without blocking CI, then gradually remove xfail marks as you write the docs. The test output shows progress:

```
tests/test_docs.py ..........................XXXxx.  [100%]
26 passed, 2 xfailed, 3 xpassed in 1.06 seconds
```

## When to Use

Read this reference when:
- The project has a public API, CLI, or config surface that should be documented
- You want to add a documentation coverage test as part of the "tests" pillar of a perfect commit
- The project already has docs and you want to prevent drift

This is a complement to the main perfect-commit workflow, not a replacement. Most commits won't need a full documentation unit test — but when you're adding a new public API or config option, consider whether a doc test would prevent future drift.
