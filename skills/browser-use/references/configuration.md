# Configuration Reference

## BrowserProfile

Controls browser launch settings, security, and behavior.

```python
from browser_use import Browser
from browser_use.browser.profile import BrowserProfile, ProxySettings

browser = Browser(browser_profile=BrowserProfile(
    # Launch
    headless=True,                          # None = auto-detect display
    user_data_dir="./chrome-profile",       # Persist cookies/login
    executable_path="/path/to/chrome",      # Custom Chrome binary
    channel="chromium",                     # "chromium" | "chrome" | "msedge"
    downloads_path="./downloads",
    args=["--disable-gpu"],                 # Extra CLI flags

    # Viewport
    viewport={"width": 1280, "height": 720},
    device_scale_factor=1.0,
    user_agent="custom-agent-string",

    # Security
    disable_security=False,                 # Disable CORS, CSP, etc.
    allowed_domains=["*.example.com"],      # Only allow these domains
    prohibited_domains=["ads.example.com"], # Block these domains
    block_ip_addresses=False,
    proxy=ProxySettings(
        server="http://proxy:8080",
        username="user",
        password="pass",
        bypass="localhost,127.0.0.1",
    ),

    # Behavior
    accept_downloads=True,
    cross_origin_iframes=False,             # Include cross-origin iframe content
    max_iframes=100,
    max_iframe_depth=5,
    keep_alive=False,                       # Keep browser open between tasks
    devtools=False,

    # Cloud
    use_cloud=False,
    cloud_browser_params=None,

    # Debug
    demo_mode=False,                        # Live thinking panel
))
```

### Key shortcuts (top-level Browser params)

These are common BrowserProfile fields exposed as direct `Browser()` constructor args:

```python
browser = Browser(
    headless=True,
    user_data_dir="./profile",
    use_cloud=False,
    cdp_url="ws://...",           # Connect to existing browser
    downloads_path="./downloads",
)
```

## AgentSettings

Controls agent behavior. Most are set via `Agent()` constructor params.

```python
Agent(
    # Vision
    use_vision=True,                        # True | False | "auto"
    vision_detail_level="auto",             # "auto" | "low" | "high"

    # Planning & reasoning
    enable_planning=True,
    use_thinking=True,
    planning_replan_on_stall=3,             # Nudge after N steps with no progress
    planning_exploration_limit=5,

    # Reliability
    max_failures=5,                         # Consecutive failures before stopping
    loop_detection_enabled=True,
    loop_detection_window=20,               # Rolling window for loop detection
    final_response_after_failure=True,      # One last LLM call on failure

    # Performance
    max_actions_per_step=5,                 # Actions per LLM call
    flash_mode=False,                       # Skip planning/thinking/evaluation
    llm_timeout=60,                         # Per-call timeout (auto-adjusted per model)
    step_timeout=180,                       # Per-step timeout

    # Output
    output_model_schema=MyPydanticModel,    # Structured output

    # Message management
    message_compaction=True,                # Or MessageCompactionSettings(...)
    max_history_items=None,                 # None = keep all

    # Debug
    save_conversation_path="./convo.json",
    demo_mode=True,
    generate_gif=True,
    calculate_cost=True,
)
```

## MessageCompactionSettings

Controls how old conversation history is compressed to save tokens during long tasks.

```python
from browser_use.agent.views import MessageCompactionSettings

Agent(
    message_compaction=MessageCompactionSettings(
        enabled=True,
        compact_every_n_steps=25,           # Compress every N steps
        trigger_token_count=None,           # Or compress at this token count
        keep_last_items=6,                  # Keep last N steps intact
        summary_max_chars=6000,
        compaction_llm=None,                # Custom LLM for summarization
    ),
)
```

## Timing Defaults by Provider

browser-use auto-detects timeouts per model:

| Provider | Timeout |
|----------|---------|
| Gemini 3-Pro | 90s |
| Gemini (others) | 75s |
| Claude / Sonnet | 90s |
| O3 / DeepSeek | 90s |
| Groq | 30s |
| Default | 75s |

## Browser Wait Times

```python
BrowserProfile(
    minimum_wait_page_load_time=0.25,       # Min wait after navigation
    wait_for_network_idle_page_load_time=0.5, # Wait for network idle
    wait_between_actions=0.5,               # Pause between actions
)
```

## DOM Extraction Settings

These control how the agent sees the page:

```python
BrowserProfile(
    highlight_elements=True,                # Visual element overlay
    max_clickable_elements_length=40000,    # Max chars in DOM prompt
    include_attributes=["data-testid", "aria-label"],  # Extra attributes
    paint_order_filtering=True,             # Prioritize visible elements
)
```
