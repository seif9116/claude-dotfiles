#!/bin/bash
# Hook: Block Claude from reading .env files
# Checks the Read tool's file_path and Bash commands for .env file access

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // ""')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Pattern: .env, .env.local, .env.production, .env.development, .env.*, etc.
ENV_PATTERN='(^|/)\.env(\.[a-zA-Z0-9_.]+)?$'

case "$tool_name" in
  Read|Edit|Write)
    if [[ "$file_path" =~ $ENV_PATTERN ]]; then
      echo '{"decision": "block", "reason": "Reading .env files is blocked to protect secrets. If you need to know what env vars are expected, check .env.example or ask the user."}'
      exit 0
    fi
    ;;
  Bash)
    # Block cat/head/tail/less/more/bat/sed/awk on .env files
    if echo "$command" | grep -qP '(cat|head|tail|less|more|bat|sed|awk|nano|vim|vi|code|source|\.)\s+.*\.env(\.[a-zA-Z0-9_.]+)?\b'; then
      echo '{"decision": "block", "reason": "Reading .env files via shell is blocked to protect secrets. If you need to know what env vars are expected, check .env.example or ask the user."}'
      exit 0
    fi
    ;;
esac

echo '{"decision": "allow"}'
