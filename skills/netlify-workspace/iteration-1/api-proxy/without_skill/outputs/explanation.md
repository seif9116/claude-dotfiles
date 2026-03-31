# Netlify API Proxy Configuration -- Explanation

## Problem

The frontend at `hafiz.app` (a statically-exported Next.js SPA on Netlify) needs to talk to a backend at `https://api.hafiz.app`. Making direct cross-origin requests from the browser means dealing with CORS headers, preflight requests, and cookie/credential complications. A reverse proxy at the edge eliminates all of that.

## How It Works

### Netlify Rewrites (status 200 redirects)

Netlify's `[[redirects]]` rules with `status = 200` act as **invisible reverse proxies**. The browser sends a request to `/api/whatever`, Netlify fetches `https://api.hafiz.app/api/whatever` server-side, and returns the response as if it came from the same origin. The browser never sees a 301/302 redirect and never knows a different server is involved.

### Key Directives

| Directive | Purpose |
|-----------|---------|
| `from = "/api/*"` | Matches any path starting with `/api/`. The `*` captures the rest of the path into the `:splat` placeholder. |
| `to = "https://api.hafiz.app/api/:splat"` | Forwards to the backend, preserving the full path. `/api/v1/sessions` becomes `https://api.hafiz.app/api/v1/sessions`. |
| `status = 200` | Makes this a **rewrite** (transparent proxy), not a redirect. The browser sees a 200 from the same origin. |
| `force = true` | Ensures the rule fires even if a static file happens to exist at that path. Without this, Netlify serves static assets first and only falls through to redirects for missing files. Since `/api` should never resolve to a static file this is a safety measure. |
| `X-Forwarded-Host` header | Tells the backend which host the original request was intended for. Useful if the backend does host-based routing or generates absolute URLs in responses. |

### Rule Ordering

Netlify processes redirect rules **top-down, first match wins**. The `/api/*` rule must come before the `/*` SPA catch-all. If the catch-all were first, every request -- including API calls -- would get `index.html`.

### Why the SPA Catch-All Still Works

The `/*` catch-all with `status = 200` tells Netlify: "for any path that didn't match an earlier rule and doesn't correspond to a real static file, serve `/index.html`." This lets client-side routing (Next.js or React Router) handle paths like `/surah/2` without a 404.

## Deploy Previews and Branch Deploys

Netlify generates unique URLs for deploy previews (e.g., `deploy-preview-42--hafiz.netlify.app`) and branch deploys. By default, **context-specific redirect blocks completely replace the top-level redirects** -- they do not merge. This means if you only define redirects at the top level, deploy previews could lose them under certain conditions.

To be safe, the configuration explicitly repeats the redirect rules under:

- `[context.deploy-preview]` -- for PR preview deployments
- `[context.branch-deploy]` -- for branch-based deployments

All three contexts (production, deploy-preview, branch-deploy) point at the same backend (`https://api.hafiz.app`). If you later set up a staging backend, you would change the `to` value in the deploy-preview or branch-deploy context to point there instead:

```toml
[[context.deploy-preview.redirects]]
  from = "/api/*"
  to = "https://staging-api.hafiz.app/api/:splat"
  status = 200
  force = true
```

## What the Browser Sees

1. Browser requests `https://hafiz.app/api/v1/sessions`
2. Netlify edge matches the `/api/*` rule
3. Netlify fetches `https://api.hafiz.app/api/v1/sessions` server-side
4. Netlify returns the backend's response with a `200` status
5. Browser thinks the response came from `hafiz.app` -- no CORS, no redirect

## Query Strings and Request Bodies

Netlify's proxy automatically forwards:
- **Query strings** (`/api/search?q=baqara` forwards as-is)
- **Request bodies** (POST/PUT/PATCH payloads pass through)
- **HTTP methods** (GET, POST, DELETE, etc. are all preserved)
- **Most request headers** (including `Authorization`, `Content-Type`, cookies)

## Limitations

- **WebSockets** are not supported through Netlify redirects. If the backend uses WebSocket connections, those must connect directly to `api.hafiz.app`.
- **Response streaming** may be buffered. Netlify's proxy collects the full response before forwarding it to the client.
- **Timeout**: Netlify's proxy has a 26-second timeout for the backend to respond. Long-running requests (like audio transcription) should use async patterns (start job, poll for result).
- **Payload size**: Netlify limits request bodies to 6 MB on the free tier. Large file uploads should go directly to the backend or use presigned upload URLs.
