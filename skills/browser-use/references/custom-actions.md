# Custom Actions (Tools)

## Basic Pattern

```python
from browser_use import Tools, Agent
from browser_use.agent.views import ActionResult

tools = Tools()

@tools.action(description="Description the LLM sees to decide when to use this")
async def my_action(param1: str, param2: int) -> ActionResult:
    # Do something
    return ActionResult(extracted_content="Result text")

agent = Agent(task="...", llm=llm, tools=tools)
```

The description matters — it's what the LLM reads to decide whether to call this action. Be specific about what the action does and when to use it.

## Pydantic Model Parameters

For complex inputs, use a Pydantic model:

```python
from pydantic import BaseModel, Field

class JobListing(BaseModel):
    title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    salary: str | None = Field(default=None, description="Salary range if shown")

@tools.action(
    description="Save a job listing to the database",
    param_model=JobListing,
)
async def save_job(params: JobListing) -> ActionResult:
    # params is validated Pydantic model
    db.save(params.model_dump())
    return ActionResult(extracted_content=f"Saved {params.title} at {params.company}")
```

## Injectable Parameters

Custom actions can request special objects by using exact parameter names. browser-use injects them automatically — you don't pass them when calling.

| Parameter Name | Type | What You Get |
|---|---|---|
| `browser_session` | `BrowserSession` | The current browser session |
| `page_extraction_llm` | `BaseChatModel` | The agent's LLM (for custom LLM calls) |
| `file_system` | `FileSystem` | File system access |
| `available_file_paths` | `list[str]` | Files available for upload |
| `has_sensitive_data` | `bool` | Whether sensitive data mode is on |

**The name must match exactly.** `browser: BrowserSession` won't work — it must be `browser_session: BrowserSession`.

```python
from browser_use import BrowserSession

@tools.action(description="Take a screenshot and save it")
async def save_screenshot(
    filename: str,
    browser_session: BrowserSession,  # Injected automatically
) -> ActionResult:
    screenshot = await browser_session.take_screenshot()
    with open(filename, "wb") as f:
        f.write(screenshot)
    return ActionResult(extracted_content=f"Screenshot saved to {filename}")
```

## Domain-Restricted Actions

Limit an action to specific domains:

```python
@tools.action(
    description="Extract product data from our store",
    allowed_domains=["*.mystore.com", "mystore.com"],
)
async def extract_product(url: str) -> ActionResult:
    # Only callable when browser is on mystore.com
    ...
```

## ActionResult Fields

```python
ActionResult(
    is_done=False,                  # Mark task as complete
    success=True,                   # Whether the action succeeded
    error="Something went wrong",   # Error message for the LLM
    extracted_content="...",        # Content the LLM should remember
    long_term_memory="...",         # Important facts to persist
    include_extracted_content_only_once=False,
    attachments=["path/to/file"],   # Files to show
    images=[{"base64": "..."}],     # Base64 images
)
```

## Sync vs Async

Both work:

```python
# Async (preferred)
@tools.action(description="...")
async def my_async_action(x: str) -> ActionResult:
    result = await some_async_call()
    return ActionResult(extracted_content=result)

# Sync (also fine)
@tools.action(description="...")
def my_sync_action(x: str) -> str:
    # Can return str directly — gets wrapped in ActionResult
    return "result"
```

## Built-in Actions

These are always available to the agent (no need to register):

- **click(index)** — Click element by DOM index
- **input(index, text, clear=True)** — Type text in input field
- **scroll(down=True, pages=1.0)** — Scroll page
- **navigate(url, new_tab=False)** — Go to URL
- **search_page(pattern, regex=False)** — Find text on page
- **find_elements(selector)** — Query DOM with CSS selector
- **extract(query, extract_links=False)** — Extract content
- **screenshot()** — Take screenshot
- **send_keys(keys)** — Keyboard shortcuts (Escape, Enter, Ctrl+C, etc.)
- **switch_tab(tab_id)** — Switch browser tab
- **close_tab(tab_id)** — Close tab
- **upload_file(index, file_path)** — Upload file
- **save_as_pdf(path)** — Save page as PDF
- **get_dropdown_options(index)** — List dropdown options
- **select_dropdown_option(index, option)** — Choose dropdown option
- **done(text, success=True)** — Mark task complete

## Filtering Built-in Actions

You can restrict which built-in actions the agent has access to:

```python
tools = Tools(
    exclude_actions=["save_as_pdf", "upload_file"],  # Remove specific actions
)
```

## Real-World Example: Save to Database + Notify

```python
import httpx
from browser_use import Tools, BrowserSession
from browser_use.agent.views import ActionResult

tools = Tools()

@tools.action(description="Save scraped data to our API and notify the team on Slack")
async def save_and_notify(
    data: str,
    category: str,
    browser_session: BrowserSession,
) -> ActionResult:
    # Save to API
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.myapp.com/data",
            json={"data": data, "category": category},
        )
        if resp.status_code != 200:
            return ActionResult(error=f"API error: {resp.status_code}")

    # Notify Slack
    await client.post(
        "https://hooks.slack.com/...",
        json={"text": f"New {category} data saved: {data[:100]}..."},
    )

    return ActionResult(
        extracted_content=f"Saved and notified. ID: {resp.json()['id']}",
    )
```
