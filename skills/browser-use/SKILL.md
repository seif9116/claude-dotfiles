---
name: browser-use
description: Guide for building browser automation agents with the browser-use Python library. Use this skill whenever the user wants to automate browser tasks, scrape websites, fill forms, extract data from web pages, navigate sites with AI, build web agents, or interact with web UIs programmatically using browser-use. Also use when you see imports from `browser_use`, when the user mentions "browser agent", "web automation with AI", "autonomous browsing", or wants to control Chrome/Chromium with an LLM. Even if they just say "scrape this site" or "fill out this form automatically" — if browser-use is in the project, use this skill.
---

# browser-use

browser-use is an async Python library (3.11+) that lets AI agents autonomously navigate and interact with websites via Chrome DevTools Protocol. You give it a task in natural language + an LLM, and it figures out how to click, type, scroll, and extract data.

**Everything is async** — all agent and browser methods require `await` and `asyncio.run()`. The synchronous `agent.run_sync()` wrapper exists but is just a convenience around `asyncio.run()`.

## Installation

```bash
uv add browser-use
uvx browser-use install   # downloads Chromium if needed
```

Set environment variables for your LLM provider:
```
BROWSER_USE_API_KEY=...   # For ChatBrowserUse (recommended default)
OPENAI_API_KEY=...        # For OpenAI models
GOOGLE_API_KEY=...        # For Gemini (NOT GEMINI_API_KEY — renamed May 2025)
ANTHROPIC_API_KEY=...     # For Claude
```

## Quick Start

```python
from browser_use import Agent, ChatBrowserUse
import asyncio

async def main():
    agent = Agent(
        task="Find the price of the mass-produced mass gainer on Amazon",
        llm=ChatBrowserUse(),
    )
    result = await agent.run()
    print(result.extracted_content)

asyncio.run(main())
```

## Core API

### Agent

The `Agent` orchestrates the entire automation loop — it takes a task, calls the LLM each step, executes browser actions, and repeats until done or max_steps.

```python
Agent(
    task: str,                              # What to accomplish
    llm: BaseChatModel | None = None,       # LLM provider (default: ChatBrowserUse)
    browser: BrowserSession | None = None,  # Browser instance (auto-created if None)
    browser_profile: BrowserProfile | None = None,
    tools: Tools | None = None,             # Custom actions

    # Behavior
    max_steps: int = 500,                   # passed to run(), not constructor
    max_failures: int = 5,
    max_actions_per_step: int = 5,
    use_vision: bool | Literal['auto'] = True,
    use_thinking: bool = True,
    use_judge: bool = True,
    enable_planning: bool = True,
    flash_mode: bool = False,               # Fast mode — disables planning & thinking
    loop_detection_enabled: bool = True,

    # Output
    output_model_schema: type | None = None, # Pydantic model for structured output

    # System prompt
    extend_system_message: str | None = None,
    override_system_message: str | None = None,

    # Sensitive data
    sensitive_data: dict | None = None,

    # Cost & debug
    calculate_cost: bool = False,
    generate_gif: bool | str = False,
    demo_mode: bool | None = None,          # Live panel in browser
    save_conversation_path: str | None = None,

    # Fallback
    fallback_llm: BaseChatModel | None = None,
    page_extraction_llm: BaseChatModel | None = None,
)
```

Key methods:
```python
result = await agent.run(max_steps=100)  # Returns AgentHistoryList
result = agent.run_sync(max_steps=100)   # Sync wrapper
await agent.pause()
await agent.resume()
```

### Inspecting Results (AgentHistoryList)

`agent.run()` returns an `AgentHistoryList`. Use these methods to get data out:

```python
result = await agent.run()

# Check completion
result.is_done()                  # bool — did the agent call done()?
result.is_successful()            # bool — did it succeed?

# Get extracted text
result.extracted_content()        # list[str] — all extracted_content from all steps
result.final_result()             # str — the agent's final message

# Get structured output (when using output_model_schema)
result.output_model_instance()    # Returns the Pydantic model instance, or None

# Get action history
result.actions()                  # list — all actions taken
result.urls()                     # list[str] — all URLs visited
result.screenshots()              # list — all screenshots taken
result.errors()                   # list[str] — all errors encountered

# Token usage
result.usage                      # TokenUsage — input/output token counts
```

These are the correct method names — do not use `model_output()`, `final_output()`, or other variants.

### Browser / BrowserSession

`Browser` is an alias for `BrowserSession`. It manages the Chromium instance.

```python
from browser_use import Browser

# Simple
browser = Browser(headless=True)

# With profile (reuse existing Chrome login/cookies)
browser = Browser(
    user_data_dir="~/.config/google-chrome/Default",
    headless=False,
)

# With proxy
browser = Browser(
    proxy={"server": "http://proxy:8080", "username": "u", "password": "p"},
)

# Cloud browser
browser = Browser(use_cloud=True)

# Connect to existing browser via CDP
browser = Browser(cdp_url="ws://localhost:9222")
```

For full browser configuration options, read `references/configuration.md`.

### Tools (Custom Actions)

Register custom actions the agent can call alongside built-in browser actions:

```python
from browser_use import Tools, Agent
from browser_use.agent.views import ActionResult

tools = Tools()

@tools.action(description="Save extracted data to a JSON file")
async def save_data(data: str, filename: str) -> ActionResult:
    import json
    with open(filename, "w") as f:
        json.dump(json.loads(data), f, indent=2)
    return ActionResult(extracted_content=f"Saved to {filename}")

agent = Agent(task="...", llm=llm, tools=tools)
```

The agent's built-in actions include: `click`, `input`, `scroll`, `navigate`, `search_page`, `find_elements`, `extract`, `screenshot`, `send_keys`, `switch_tab`, `close_tab`, `upload_file`, `save_as_pdf`, `get_dropdown_options`, `select_dropdown_option`, and `done`.

For advanced custom action patterns (Pydantic models, injectable parameters, domain restrictions), read `references/custom-actions.md`.

### LLM Providers

browser-use supports 15+ LLM providers. **Always import LLM classes from `browser_use`**, not from `langchain_openai`, `langchain_anthropic`, etc. — browser-use re-exports them with the correct configuration.

```python
from browser_use import ChatBrowserUse, ChatOpenAI, ChatAnthropic, ChatGoogle

llm = ChatBrowserUse()                          # Recommended
llm = ChatOpenAI(model="gpt-4o")                # OpenAI
llm = ChatAnthropic(model="claude-sonnet-4-6")  # Anthropic
llm = ChatGoogle(model="gemini-2.5-flash")       # Google
```

For the complete provider list (Azure, Groq, Ollama, DeepSeek, Bedrock, etc.), read `references/llm-providers.md`.

## Common Patterns

### Structured Data Extraction

```python
from pydantic import BaseModel

class Product(BaseModel):
    name: str
    price: float
    rating: float | None = None

agent = Agent(
    task="Extract all products from this page",
    llm=ChatBrowserUse(),
    output_model_schema=Product,
)
result = await agent.run()
```

### Sensitive Data (Passwords, API Keys)

The LLM never sees real values — only placeholder names. Real values are injected into form fields after the LLM decides what to type.

```python
agent = Agent(
    task="Log into example.com with my credentials",
    sensitive_data={"my_email": "real@email.com", "my_password": "s3cret"},
    use_vision=False,  # Prevent screenshots from capturing credentials
)
```

### Multi-Step with Planning

```python
agent = Agent(
    task="Search for flights from NYC to London, find the cheapest option, and extract the details",
    llm=ChatBrowserUse(),
    enable_planning=True,        # Multi-step planning (default True)
    use_thinking=True,           # Reasoning steps (default True)
    max_actions_per_step=5,
)
```

### Multi-Agent Chaining (Shared Browser)

For multi-phase workflows (login then scrape, navigate then download), use separate agents with a shared browser session. Each agent gets a clean context but the browser state (cookies, page, tabs) carries over.

```python
browser = Browser(headless=False, keep_alive=True)

# Phase 1: Login
login_agent = Agent(
    task="Log into site X using x_user and x_pass",
    llm=llm, browser=browser, tools=tools,
    sensitive_data={"x_user": "me@co.com", "x_pass": "secret"},
    use_vision=False,  # Don't screenshot credentials
)
await login_agent.run()

# Phase 2: Work (reuses authenticated session)
work_agent = Agent(
    task="Navigate to /reports and download the monthly PDF",
    llm=llm, browser=browser, tools=tools,
    use_vision=True,  # Vision fine after login
)
await work_agent.run()

await browser.kill()  # Clean up when done
```

This is better than a single agent for multi-phase tasks because each agent gets a focused task and clean LLM context, reducing confusion on long workflows.

### Fast Mode (Speed Over Reliability)

```python
agent = Agent(
    task="Quick lookup — what's the current BTC price on CoinGecko",
    llm=ChatBrowserUse(),  # flash_mode auto-enabled with ChatBrowserUse
    flash_mode=True,       # Skips planning, thinking, evaluation
)
```

### GIF Recording

```python
agent = Agent(
    task="...",
    generate_gif=True,  # or a string path like "output.gif"
)
```

## Decision Guide

| Situation | Recommendation |
|-----------|----------------|
| Default LLM choice | `ChatBrowserUse()` — fastest, cheapest, best accuracy |
| Need custom tools | Use open-source with `Tools()` |
| Anti-bot / CAPTCHA sites | Use Cloud (`Browser(use_cloud=True)`) |
| Sensitive data (passwords) | `sensitive_data={}` + `use_vision=False` |
| Long-running tasks | Enable `message_compaction` (default), set `max_steps` |
| Simple quick lookups | `flash_mode=True` |
| Debugging agent behavior | `demo_mode=True` + `headless=False` |
| Production reliability | `fallback_llm=...` + `use_judge=True` |
| Cost tracking | `calculate_cost=True` |
| Reuse Chrome login | `Browser(user_data_dir="path/to/chrome/profile")` |

## Gotchas

1. **Async-only**: Every `agent.run()` and browser method needs `await`. Use `asyncio.run(main())` as the entry point, or `agent.run_sync()` for quick scripts.
2. **`Browser` = `BrowserSession`**: They're the same class. Old code uses `BrowserSession`, new code uses `Browser`.
3. **`controller` renamed to `tools`**: Both still work, but `tools` is the current name.
4. **`BrowserConfig` doesn't exist**: Use `BrowserProfile` from `browser_use.browser.profile`. The constructor is `Browser(browser_profile=BrowserProfile(...))`, not `Browser(config=BrowserConfig(...))`.
5. **Import LLMs from `browser_use`**: Use `from browser_use import ChatOpenAI`, not `from langchain_openai import ChatOpenAI`. browser-use re-exports with correct config.
6. **`GEMINI_API_KEY` renamed to `GOOGLE_API_KEY`**: Changed May 2025.
7. **DOM indices are 1-based**: Element index 0 doesn't exist.
8. **Parameter injection in custom actions is by exact name**: Must use `browser_session: BrowserSession`, not `browser` or any other name.
9. **Vision screenshots**: Sent by default. Disable with `use_vision=False` for sensitive pages or to save tokens.
10. **`flash_mode`**: Auto-enabled when using `ChatBrowserUse`. Disables planning and thinking.
11. **Profile portability**: Chrome profiles are OS-specific — can't reuse a Linux profile on Mac.
12. **Memory**: Each Chrome instance uses 100-300MB. Clean up with `await browser.kill()` (not `browser.close()`).
13. **`directly_open_url=True`** (default): The agent auto-navigates to URLs found in the task text before the LLM even starts — this saves tokens but can be surprising.

## Reference Files

For deeper documentation on specific topics:
- `references/configuration.md` — BrowserProfile, AgentSettings, message compaction, all parameters
- `references/custom-actions.md` — Advanced custom tools, Pydantic models, injectable parameters, domain restrictions
- `references/llm-providers.md` — All 15+ supported LLM providers with setup examples
- `references/cloud.md` — Cloud vs open-source, Cloud SDK, pricing, stealth, CAPTCHA handling
