# LLM Providers

browser-use supports 15+ LLM providers. All are imported from `browser_use` directly.

## Recommended Default

```python
from browser_use import ChatBrowserUse

llm = ChatBrowserUse()  # Requires BROWSER_USE_API_KEY env var
```

ChatBrowserUse is specifically optimized for browser-use — 3-5x faster than alternatives, cheapest pricing ($0.20/$2.00 per 1M input/output tokens), and highest accuracy. It auto-enables `flash_mode`.

## Provider Quick Reference

### OpenAI
```python
from browser_use import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")          # Requires OPENAI_API_KEY
llm = ChatOpenAI(model="gpt-4o-mini")     # Cheaper
llm = ChatOpenAI(model="o3")              # Reasoning model
```

### Anthropic (Claude)
```python
from browser_use import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6")   # Requires ANTHROPIC_API_KEY
llm = ChatAnthropic(model="claude-opus-4")
```

### Google Gemini
```python
from browser_use import ChatGoogle

llm = ChatGoogle(model="gemini-2.5-flash")    # Requires GOOGLE_API_KEY
llm = ChatGoogle(model="gemini-2.5-pro")      # (NOT GEMINI_API_KEY)
```

### Azure OpenAI
```python
from browser_use import ChatAzureOpenAI

llm = ChatAzureOpenAI(
    model="gpt-4o",
    api_version="2025-03-01-preview",  # Must be >= this version
    azure_endpoint="https://your-resource.openai.azure.com/",
    api_key="...",
)
```

### Groq
```python
from browser_use import ChatGroq

llm = ChatGroq(model="llama-4-maverick")  # Requires GROQ_API_KEY
```

### Mistral
```python
from browser_use import ChatMistral

llm = ChatMistral(model="mistral-large-latest")  # Requires MISTRAL_API_KEY
```

### Ollama (Local Models)
```python
from browser_use import ChatOllama

llm = ChatOllama(model="llama3.1:8b")  # Requires ollama serve running
```

Local models may need compatibility flags:
```python
from browser_use import Agent

agent = Agent(
    task="...",
    llm=ChatOllama(model="llama3.1:8b"),
    # These help local models with schema issues:
    tool_calling_method="auto",
)
```

### DeepSeek
```python
from browser_use import ChatOpenAI

llm = ChatOpenAI(
    model="deepseek-chat",
    base_url="https://api.deepseek.com/v1",
    api_key="...",  # DEEPSEEK_API_KEY
)
```

### AWS Bedrock
```python
from browser_use import ChatAWSBedrock

llm = ChatAWSBedrock(model_id="anthropic.claude-sonnet-4-6-v1")
# Uses AWS credentials from environment / IAM role
```

### OpenRouter (100+ models)
```python
from browser_use import ChatOpenAI

llm = ChatOpenAI(
    model="anthropic/claude-sonnet-4-6",
    base_url="https://openrouter.ai/api/v1",
    api_key="...",  # OPENROUTER_API_KEY
)
```

### Cerebras
```python
from browser_use import ChatCerebras

llm = ChatCerebras(model="llama-3.1-70b")  # Requires CEREBRAS_API_KEY
```

### Vercel AI Gateway
```python
from browser_use import ChatVercel

llm = ChatVercel(model="...")  # Provides rate limiting, caching, fallback routing
```

## Lazy Model Factory

For quick access without explicit imports:

```python
from browser_use import llm as models

llm = models.openai_gpt_4o           # Lazy loads, uses OPENAI_API_KEY
llm = models.anthropic_claude_sonnet  # Uses ANTHROPIC_API_KEY
llm = models.google_gemini_flash      # Uses GOOGLE_API_KEY
```

Or by name:
```python
from browser_use.llm.models import get_llm_by_name

llm = get_llm_by_name("openai_gpt_4o")
```

## OpenAI-Compatible Endpoints

Any API that speaks the OpenAI protocol works with ChatOpenAI + custom base_url:

```python
llm = ChatOpenAI(
    model="your-model",
    base_url="https://your-endpoint.com/v1",
    api_key="your-key",
)
```

This covers: vLLM, LiteLLM, Together AI, Fireworks, Anyscale, etc.

## Multi-LLM Setup

Use different models for different purposes to optimize cost:

```python
agent = Agent(
    task="...",
    llm=ChatOpenAI(model="gpt-4o"),                     # Main reasoning
    fallback_llm=ChatOpenAI(model="gpt-4o-mini"),       # Fallback on error
    page_extraction_llm=ChatOpenAI(model="gpt-4o-mini"),# Cheap extraction
    judge_llm=ChatOpenAI(model="gpt-4o-mini"),          # Validation
)
```
