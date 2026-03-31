#!/bin/bash
# Bootstrap script: reinstall all Claude Code plugins from tracked manifests
# Run this after cloning the dotfiles repo to ~/.claude/
#
# Usage: ~/.claude/setup.sh

set -e

echo "=== Claude Code Dotfiles Setup ==="
echo ""

# Check if claude is available
if ! command -v claude &> /dev/null; then
    echo "Error: 'claude' command not found. Install Claude Code first."
    echo "  https://docs.anthropic.com/en/docs/claude-code"
    exit 1
fi

echo "Plugins to install (from settings.json):"
echo ""

# Extract enabled plugins from settings.json
SETTINGS="$HOME/.claude/settings.json"
if [ ! -f "$SETTINGS" ]; then
    echo "Error: settings.json not found"
    exit 1
fi

# List enabled plugins
python3 -c "
import json, sys
with open('$SETTINGS') as f:
    settings = json.load(f)
plugins = settings.get('enabledPlugins', {})
for name, enabled in plugins.items():
    status = 'enabled' if enabled else 'disabled'
    print(f'  {name} ({status})')
"

echo ""
echo "Claude Code will auto-fetch plugins on next launch based on settings.json."
echo "If any are missing, install them manually with:"
echo "  claude /install-plugin <plugin-name>"
echo ""
echo "Custom marketplaces configured in settings.json:"
python3 -c "
import json
with open('$SETTINGS') as f:
    settings = json.load(f)
mkts = settings.get('extraKnownMarketplaces', {})
for name, info in mkts.items():
    repo = info.get('source', {}).get('repo', '?')
    print(f'  {name} -> github:{repo}')
"
echo ""
echo "Done! Start claude to trigger plugin auto-install."
