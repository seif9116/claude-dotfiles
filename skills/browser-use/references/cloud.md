# Cloud vs Open-Source

browser-use has two products:
- **Open-source library** (`pip install browser-use`) — self-hosted, full control
- **Cloud SDK** (`pip install browser-use-sdk`) — managed infrastructure

## When to Use Which

**Use open-source when:**
- You need custom tools/actions (the primary differentiator)
- Self-hosted / air-gapped deployment required
- Cost-sensitive (only pay for LLM API calls)
- Full control over browser lifecycle needed
- Privacy — data never leaves your infrastructure

**Use cloud when:**
- Anti-bot detection matters (Cloudflare, CAPTCHA, fingerprinting)
- Scaling beyond ~10 concurrent browser sessions
- Production reliability with managed infrastructure
- You want residential proxies (195+ countries)
- Human-in-the-loop with live browser URLs needed

## Cloud SDK Setup

```bash
pip install --upgrade browser-use-sdk
export BROWSER_USE_API_KEY=bu_your_key  # Get from cloud.browser-use.com
```

### Basic Cloud Usage

```python
from browser_use_sdk.v3 import AsyncBrowserUse

client = AsyncBrowserUse()

# Simple task
result = await client.run("List the top 20 posts on Hacker News today")
print(result.output)
```

### Cloud with Open-Source Agent

You can also use the open-source Agent class with a cloud-hosted browser:

```python
from browser_use import Agent, Browser, ChatBrowserUse

browser = Browser(use_cloud=True)

agent = Agent(
    task="...",
    llm=ChatBrowserUse(),
    browser=browser,
)
await agent.run()
```

## Cloud Features

### Stealth & Anti-Detection
- Hardened Chromium fork with anti-fingerprinting
- Canvas, WebGL, fonts, navigator randomized per session
- Residential proxies enabled by default
- Automatic Cloudflare bypass
- Ad/cookie banner blocking

### CAPTCHA Solving
Built-in CAPTCHA solving — no configuration needed. The cloud browser handles it transparently.

### Human-in-the-Loop
Cloud sessions provide a live browser URL. You can share this with a human to take over or assist mid-task.

### Session Persistence
- 15-minute idle timeout
- 4-hour max session length
- Profile sync from local browser

### Deterministic Rerun (Caching)
```python
# First run: full LLM cost
result = await client.run("Search for {{query}} on Amazon and get the price")

# Subsequent runs with different params: cached, ~$0 LLM cost, 3-10s
result = await client.run("Search for 'wireless mouse' on Amazon and get the price")
```

### Agent Mail (2FA)
Cloud can read 2FA emails automatically via Agent Mail integration.

### Webhooks
```python
result = await client.run(
    task="...",
    webhook_url="https://your-server.com/callback",  # Async completion
)
```

## Cloud Pricing

| Resource | Cost |
|----------|------|
| Task initialization | $0.01/task |
| Agent steps (LLM) | $0.002/step |
| Browser session | $0.06/hour |
| Proxy data (standard) | $10/GB |
| Proxy data (Scaleup) | $4/GB |

Free tier: 5 prompts, no credit card.
Subscription plans: $40-$1,625/month (20-35% savings).

## MCP Server (for Claude Code / Cursor / Windsurf)

Run browser-use as an MCP server:

```bash
uvx browser-use[cli] --mcp
```

In Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "browser-use": {
      "command": "uvx",
      "args": ["browser-use[cli]", "--mcp"]
    }
  }
}
```

This lets Claude Code or other MCP clients use browser-use as a tool without writing Python code.
