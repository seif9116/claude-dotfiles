When using the brainstorming skill, always use `brainstorming` (personal copy in ~/.claude/skills/) instead of `superpowers:brainstorming` (plugin copy). The personal copy includes online research in the explore step.

When using a python command use python3.
When dealing with packages with python always use uv and venv. This means if you notice that packages aren't installed, check if there's a venv in the directory you can source and use that. If not, then create a venv using uv and install the packages there.
The venv are in .venv, so you should do source .venv/bin/activate and look for .venv