#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Claude Code Context Usage Statusline                          ║
# ║  Shows context tokens used with a progress bar.                ║
# ║  Text turns RED when usage exceeds 200k tokens.                ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# WHY 200K?
# ─────────
# Research shows LLM performance degrades substantially as input
# context grows — even when the model can perfectly retrieve all
# relevant information. This is sometimes called "context rot."
#
#  • "Lost in the Middle" (Liu et al., 2024 — Stanford/TACL)
#    showed 30%+ accuracy drops when relevant info sits in the
#    middle of long contexts, even for long-context models.
#    https://arxiv.org/abs/2307.03172
#
#  • "Context Length Alone Hurts LLM Performance Despite Perfect
#    Retrieval" (Du et al., 2025 — EMNLP Findings) demonstrated
#    13.9–85% performance degradation as input length increases,
#    even with 100% retrieval accuracy on math, QA, and coding.
#    https://arxiv.org/abs/2510.05381
#
#  • Chroma's "Context Rot" report (Hong et al., 2025) tested
#    18 frontier models and found every single one degrades as
#    context grows — including Claude Opus, GPT-4.1, Gemini 2.5.
#    https://research.trychroma.com/context-rot
#
# 200k is a practical threshold: beyond it, you're well into the
# zone where quality noticeably drops. When you see red, consider
# running /compact or /clear to reset your context.
#
# INSTALL
# ───────
#   1. Copy this script:
#        mkdir -p ~/.claude/scripts
#        cp statusline.sh ~/.claude/scripts/statusline.sh
#        chmod +x ~/.claude/scripts/statusline.sh
#
#   2. Add to ~/.claude/settings.json (create if needed):
#        {
#          "statusLine": {
#            "type": "command",
#            "command": "~/.claude/scripts/statusline.sh"
#          }
#        }
#
#   3. Restart Claude Code

# Read JSON from stdin (Claude Code pipes session data)
input=$(cat)

# ── Parse fields ──────────────────────────────────────────────
MODEL=$(echo "$input" | jq -r '.model.display_name // "?"')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
CTX_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

# Current usage tokens (null before first API call)
INPUT_TOK=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')

# Total input tokens used (same formula Claude uses for used_percentage)
USED_TOKENS=$((INPUT_TOK + CACHE_CREATE + CACHE_READ))

# ── Rate limits (Pro/Max only, v2.1.80+) ────────────────────
FIVE_H_PCT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
FIVE_H_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
SEVEN_D_PCT=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
HAS_RATE_LIMITS=false
if [ -n "$FIVE_H_PCT" ] || [ -n "$SEVEN_D_PCT" ]; then
  HAS_RATE_LIMITS=true
  FIVE_H_PCT_INT=$(printf '%.0f' "${FIVE_H_PCT:-0}")
  SEVEN_D_PCT_INT=$(printf '%.0f' "${SEVEN_D_PCT:-0}")
fi

# ── Format numbers ────────────────────────────────────────────
format_tokens() {
  local t=$1
  if [ "$t" -ge 1000000 ]; then
    printf "%.1fM" "$(echo "scale=1; $t/1000000" | bc)"
  elif [ "$t" -ge 1000 ]; then
    printf "%.1fk" "$(echo "scale=1; $t/1000" | bc)"
  else
    printf "%d" "$t"
  fi
}

USED_FMT=$(format_tokens "$USED_TOKENS")
CTX_FMT=$(format_tokens "$CTX_SIZE")
COST_FMT=$(printf '$%.2f' "$COST")

# ── Colors ────────────────────────────────────────────────────
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BRIGHT_RED="\033[1;31m"
CYAN="\033[36m"
MAGENTA="\033[35m"
WHITE="\033[37m"
BRIGHT_GREEN="\033[1;32m"

# Color logic:
#   - Default: green
#   - >= 50%: yellow
#   - >= 80%: red
#   - > 200k tokens used: BRIGHT RED (your custom threshold)
if [ "$USED_TOKENS" -gt 200000 ]; then
  BAR_COLOR="$BRIGHT_RED"
  PCT_COLOR="$BRIGHT_RED"
  LABEL="⚠ CONTEXT ROT — quality degrades past 200k (run /compact)"
elif [ "$PCT" -ge 80 ]; then
  BAR_COLOR="$RED"
  PCT_COLOR="$RED"
  LABEL=""
elif [ "$PCT" -ge 50 ]; then
  BAR_COLOR="$YELLOW"
  PCT_COLOR="$YELLOW"
  LABEL=""
else
  BAR_COLOR="$GREEN"
  PCT_COLOR="$GREEN"
  LABEL=""
fi

# ── Rate limit colors ────────────────────────────────────────
rate_color() {
  local pct=$1
  if [ "$pct" -ge 80 ]; then printf "$RED"
  elif [ "$pct" -ge 50 ]; then printf "$YELLOW"
  else printf "$GREEN"
  fi
}

# ── Usage messages ──────────────────────────────────────────
LOW_MSGS=(
  "Anthropic doesn't want you to use these. Prove them wrong."
  "Never let tokens expire. That's how Big AI wins."
  "These tokens have an expiry date. Use them out of spite."
  "You're under 50%. Dario is relieved. Fix that."
  "Unused tokens are Anthropic profit. Fight back."
  "Big AI is counting on you taking a break. Don't."
  "Tokens expire. Code is forever. Use every last one."
)

HIGH_MSGS=(
  "You're doing great! Show Big AI what agentic engineering looks like!"
  "Big AI fears your productivity. Keep going!"
  "Anthropic accountants are sweating. Don't stop now."
  "This is what peak agentic engineering looks like."
  "You're making Dario regret unlimited plans. Beautiful."
)

# ── Progress bar ──────────────────────────────────────────────
BAR_WIDTH=20
FILLED=$(( PCT * BAR_WIDTH / 100 ))
EMPTY=$(( BAR_WIDTH - FILLED ))

BAR=""
for ((i=0; i<FILLED; i++)); do BAR+="█"; done
for ((i=0; i<EMPTY; i++)); do BAR+="░"; done

# ── Output ────────────────────────────────────────────────────
# Line 1: Model + Cost + Rate limits
printf "${CYAN}${BOLD}%s${RESET} ${DIM}│${RESET} ${MAGENTA}%s${RESET}" "$MODEL" "$COST_FMT"

if [ "$HAS_RATE_LIMITS" = true ]; then
  if [ -n "$FIVE_H_PCT" ]; then
    FIVE_COLOR=$(rate_color "$FIVE_H_PCT_INT")
    printf " ${DIM}│${RESET} ${FIVE_COLOR}5h: %s%%${RESET}" "$FIVE_H_PCT_INT"
  fi
  if [ -n "$SEVEN_D_PCT" ]; then
    SEVEN_COLOR=$(rate_color "$SEVEN_D_PCT_INT")
    printf " ${DIM}│${RESET} ${SEVEN_COLOR}7d: %s%%${RESET}" "$SEVEN_D_PCT_INT"
  fi
fi

# Line 2: Context bar + token count
if [ -n "$LABEL" ]; then
  printf "\n${BAR_COLOR}${BAR}${RESET} ${PCT_COLOR}${BOLD}%s%%${RESET} ${DIM}(${RESET}${PCT_COLOR}%s${DIM}/${RESET}%s${DIM})${RESET} ${BRIGHT_RED}${BOLD}%s${RESET}" "$PCT" "$USED_FMT" "$CTX_FMT" "$LABEL"
  # Clickable research link (OSC 8 hyperlink for supported terminals)
  PAPER_URL="https://arxiv.org/abs/2510.05381"
  printf '\n\033[2mResearch: \033]8;;%s\a\033[36mContext Length Alone Hurts LLM Performance (Du et al. 2025)\033]8;;\a\033[0m' "$PAPER_URL"
else
  printf "\n${BAR_COLOR}${BAR}${RESET} ${PCT_COLOR}${BOLD}%s%%${RESET} ${DIM}(${RESET}${PCT_COLOR}%s${DIM}/${RESET}%s${DIM})${RESET}" "$PCT" "$USED_FMT" "$CTX_FMT"

  # Line 3: Usage message (only when context rot warning isn't showing)
  if [ "$HAS_RATE_LIMITS" = true ] && [ -n "$FIVE_H_PCT" ]; then
    if [ "$FIVE_H_PCT_INT" -gt 80 ]; then
      MSG="${HIGH_MSGS[$((RANDOM % ${#HIGH_MSGS[@]}))]}"
      printf "\n${BRIGHT_GREEN}%s${RESET}" "$MSG"
    elif [ "$FIVE_H_PCT_INT" -ge 50 ]; then
      # Neutral: show reset timer
      if [ -n "$FIVE_H_RESET" ]; then
        NOW=$(date +%s)
        REMAINING=$((FIVE_H_RESET - NOW))
        if [ "$REMAINING" -gt 0 ]; then
          HOURS=$((REMAINING / 3600))
          MINUTES=$(((REMAINING % 3600) / 60))
          printf "\n${DIM}5h resets in %dh %dm${RESET}" "$HOURS" "$MINUTES"
        else
          MSG="${LOW_MSGS[$((RANDOM % ${#LOW_MSGS[@]}))]}"
          printf "\n${DIM}%s${RESET}" "$MSG"
        fi
      else
        MSG="${LOW_MSGS[$((RANDOM % ${#LOW_MSGS[@]}))]}"
        printf "\n${DIM}%s${RESET}" "$MSG"
      fi
    else
      MSG="${LOW_MSGS[$((RANDOM % ${#LOW_MSGS[@]}))]}"
      printf "\n${DIM}%s${RESET}" "$MSG"
    fi
  fi
fi
