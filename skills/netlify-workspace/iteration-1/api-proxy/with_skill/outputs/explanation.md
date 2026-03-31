# API Proxy Configuration for netlify.toml

## What this does

The configuration proxies all requests matching `/api/*` to `https://api.hafiz.app` without the browser seeing a redirect. From the browser's perspective, it is talking to the same origin -- requests go to `/api/users` and responses come back from `/api/users`. Behind the scenes, Netlify forwards the request to `https://api.hafiz.app/users` and relays the response.

## How it works

### The proxy redirect rule

```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.hafiz.app/:splat"
  status = 200
  force = true
```

There are four pieces working together:

1. **`from = "/api/*"`** -- Matches any request path that starts with `/api/`. The `*` is a wildcard that captures everything after `/api/`.

2. **`to = "https://api.hafiz.app/:splat"`** -- The destination URL. `:splat` is a special Netlify placeholder that gets replaced with whatever the `*` wildcard captured. So `/api/v1/surahs/1/verses` becomes `https://api.hafiz.app/v1/surahs/1/verses`.

3. **`status = 200`** -- This is what makes it a proxy (rewrite) instead of a redirect. A `301` or `302` would tell the browser to navigate to the new URL, exposing the backend domain. A `200` tells Netlify to fetch the content from the destination and serve it as if it came from the original URL. The browser never sees `api.hafiz.app`.

4. **`force = true`** -- Normally, Netlify checks if a static file exists at the requested path before applying a redirect. With `force = true`, the redirect always applies regardless. This is important for proxy rules because you never want a stale file in `/api/` to shadow a real API call.

### Rule ordering

```toml
# 1st: API proxy
[[redirects]]
  from = "/api/*"
  ...

# 2nd: SPA fallback
[[redirects]]
  from = "/*"
  ...
```

Netlify processes redirect rules **top-to-bottom** and **the first match wins**. The `/api/*` rule must come before the `/*` SPA fallback. If the SPA fallback were first, it would catch `/api/health` and serve `index.html` instead of proxying to the backend.

## Deploy previews

This configuration works identically for deploy previews (PR-based preview deployments). Here is why:

- **Redirects in `netlify.toml` are global by default.** They apply to all deploy contexts -- production, deploy-preview, branch-deploy, and dev -- unless you explicitly override them in a `[context.*]` block.
- Deploy previews get a unique URL like `deploy-preview-42--hafiz.netlify.app`. When a request hits `deploy-preview-42--hafiz.netlify.app/api/health`, the same redirect rules apply, and it proxies to `https://api.hafiz.app/health`.
- There is nothing extra to configure. The `[[redirects]]` rules are not scoped to production.

### If you ever need a different backend for previews

If deploy previews should hit a staging API instead of production, you would use Netlify's deploy-context environment variables plus a Netlify Function or Edge Function to dynamically route. But since the `to` field in `[[redirects]]` does not support environment variable interpolation, the simplest approach for a different staging backend would be to use an Edge Function:

```toml
# Alternative approach (only if you need per-context routing)
[[edge_functions]]
  path = "/api/*"
  function = "api-proxy"
```

For now, since both production and previews should hit `https://api.hafiz.app`, the simple redirect rule is the correct and sufficient approach.

## CORS elimination

A major benefit of this proxy setup: you do not need CORS headers on your backend for browser requests from your Netlify site. Since the browser thinks it is talking to the same origin (same domain, same port), there is no cross-origin request. This eliminates preflight `OPTIONS` requests and simplifies your backend configuration.

## Query parameters and request bodies

Netlify's proxy redirect preserves:
- **Query parameters** -- `/api/search?q=fatiha` proxies to `https://api.hafiz.app/search?q=fatiha`
- **Request body** -- POST/PUT/PATCH bodies are forwarded as-is
- **HTTP method** -- GET, POST, PUT, DELETE, etc. are all forwarded
- **Request headers** -- Most headers are forwarded (Netlify may add or modify some, like `X-Forwarded-For`)

## Passing custom headers to the backend

If the backend requires an API key or custom header, add a `[redirects.headers]` block:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.hafiz.app/:splat"
  status = 200
  force = true
  [redirects.headers]
    X-Api-Key = "your-key-here"
```

However, do not put secrets directly in `netlify.toml` since it is checked into version control. Use Netlify environment variables via the dashboard or CLI (`netlify env:set`) for sensitive values, and reference them in a Netlify Function or Edge Function if header injection is needed.
