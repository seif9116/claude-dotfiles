When using the brainstorming skill, always use `brainstorming` (personal copy in ~/.claude/skills/) instead of `superpowers:brainstorming` (plugin copy). The personal copy includes online research in the explore step.

When using a python command use python3.
When dealing with packages with python always use uv and venv. This means if you notice that packages aren't installed, check if there's a venv in the directory you can source and use that. If not, then create a venv using uv and install the packages there.
The venv are in .venv, so you should do source .venv/bin/activate and look for .venv

When I give you a direct link (blog post, article, docs page) and say things like "follow this", "based on this", "read this", "check this out" — use `curl` via Bash to fetch the full content. Do NOT use WebFetch, which summarizes and loses detail. Pipe through a text extractor if needed to strip HTML, but get the real content.
When I give you a GitHub repo URL and say things like "based on this", "look at this", "use this as reference" — clone it into /tmp/ to inspect the actual code. e.g. `git clone <repo> /tmp/<repo-name>` then explore it.