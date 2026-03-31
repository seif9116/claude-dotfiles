---
name: netlify
description: Netlify deployment and configuration expert — netlify.toml, CLI commands, redirects, headers, environment variables, functions, edge functions, build settings, and deploy contexts. Use this skill whenever the user mentions Netlify, edits or creates netlify.toml, runs netlify CLI commands (netlify deploy, netlify dev, netlify link, netlify env), configures redirects or headers for Netlify, deploys a static site or Next.js export to Netlify, or asks about Netlify functions, edge functions, or build plugins. Also trigger when you see netlify.toml in the project or the user mentions "deploy to Netlify", "Netlify redirects", "Netlify headers", or any Netlify-related configuration.
---

# Netlify

Guide for deploying and configuring sites on Netlify. Covers the `netlify.toml` configuration file, CLI usage, and common deployment patterns.

## Why this skill exists

Netlify configuration has many options across redirects, headers, deploy contexts, functions, and environment variables. This skill provides a quick reference so you don't need to look things up each time, and avoids common mistakes like forgetting `force = true` on SPA fallbacks or misconfiguring deploy contexts.

## netlify.toml — Configuration Reference

The `netlify.toml` file in the project root controls all build and deploy behavior. Here's the full structure:

### Build settings

```toml
[build]
  command = "npm run build"       # Build command
  publish = "out"                 # Directory to deploy (relative to root)
  base = "web/"                   # Base directory for the build (monorepo subdirectory)
  edge_functions = "edge-funcs/"  # Custom edge functions directory (default: netlify/edge-functions/)
  functions = "my-functions/"     # Custom functions directory (default: netlify/functions/)
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF ."  # Skip build if no changes

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--prefix=/dev/null"
```

### Redirects

Redirects are processed top-to-bottom; the first match wins.

```toml
# Basic redirect (301 by default)
[[redirects]]
  from = "/old-path"
  to = "/new-path"

# Redirect with explicit status
[[redirects]]
  from = "/old"
  to = "/new"
  status = 302

# SPA fallback — serves index.html for all unmatched routes
# force = true is important: without it, Netlify serves existing files first
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Proxy redirect (rewrites to external URL, transparent to the browser)
[[redirects]]
  from = "/api/*"
  to = "https://my-api.example.com/:splat"
  status = 200
  force = true

# Conditional redirect (by country, language, or role)
[[redirects]]
  from = "/store"
  to = "/store/us"
  status = 302
  conditions = {Country = ["US"]}

# Redirect with custom headers passed to the origin
[[redirects]]
  from = "/api/*"
  to = "https://backend.example.com/:splat"
  status = 200
  force = true
  [redirects.headers]
    X-From = "Netlify"
    X-Api-Key = "some-key"

# Signed proxy (prevents URL tampering)
[[redirects]]
  from = "/search"
  to = "https://api.mysearch.com"
  status = 200
  signed = "API_SIGNATURE_TOKEN"
```

**Key patterns:**
- `:splat` captures the wildcard `*` match
- `:paramname` captures named segments
- `force = true` overrides even if a file exists at that path
- Query params: `query = {path = ":path"}` matches `?path=example`

### Headers

```toml
# Security headers for all pages
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

# Cache static assets aggressively
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Multi-value headers use multi-line strings
[[headers]]
  for = "/*"
  [headers.values]
    cache-control = '''
    max-age=0,
    no-cache,
    no-store,
    must-revalidate'''
```

### Deploy contexts

Override settings per deploy context (production, deploy-preview, branch-deploy, dev, or specific branches):

```toml
# Production overrides
[context.production]
  command = "npm run build"
  publish = "out"
  [context.production.environment]
    NODE_ENV = "production"

# Deploy previews (from PRs)
[context.deploy-preview]
  command = "npm run build:preview"
  [context.deploy-preview.environment]
    NODE_ENV = "staging"

# Branch deploys (non-PR, non-production)
[context.branch-deploy]
  command = "npm run build:staging"

# Specific branch
[context.staging]
  command = "npm run build:staging"

# Branch with special characters
[context."feature/new-ui"]
  command = "npm run build:feature"

# Local dev context (used by `netlify dev`)
[context.dev.environment]
  NODE_ENV = "development"
```

### Functions

```toml
[functions]
  directory = "netlify/functions/"  # Default location
  node_bundler = "esbuild"         # or "nft" (node file trace)
  external_node_modules = ["sharp"] # Don't bundle these
  included_files = ["data/*.json"]  # Include extra files

# Per-function overrides
[functions."api_*"]
  external_node_modules = ["prisma"]

[functions.heavy-compute]
  external_node_modules = ["canvas"]
```

### Plugins

```toml
[[plugins]]
  package = "@netlify/plugin-sitemap"

[[plugins]]
  package = "netlify-plugin-cache"
  [plugins.inputs]
    paths = "node_modules/.cache"
```

### Edge functions declaration

```toml
[[edge_functions]]
  path = "/admin/*"
  function = "auth-check"

[[edge_functions]]
  path = "/api/geo"
  function = "geolocation"
```

## Netlify CLI — Quick Reference

### Setup and linking

```bash
netlify login              # Authenticate with Netlify
netlify init               # Initialize new site (interactive)
netlify link               # Link existing project to a Netlify site
netlify status             # Show current site + user info
netlify open               # Open site dashboard in browser
netlify open:site          # Open the deployed site URL
```

### Local development

```bash
netlify dev                # Start local dev server (auto-detects framework)
netlify dev --port 8888    # Custom port
netlify dev --live         # Share a live URL for testing
```

`netlify dev` automatically loads environment variables from the linked site and injects them into the dev server. It also serves Netlify Functions at `/.netlify/functions/<name>`.

### Deploying

```bash
netlify deploy             # Deploy a draft (preview URL)
netlify deploy --prod      # Deploy to production
netlify deploy --dir=out   # Specify publish directory
netlify deploy --open      # Deploy and open in browser
netlify deploy --no-build  # Deploy without running build
netlify deploy --message "v1.2.3"  # Add deploy message
netlify deploy --trigger   # Trigger a new build on Netlify (remote)
```

### Environment variables

```bash
netlify env:list                                  # List all env vars
netlify env:get VAR_NAME                          # Get a specific var
netlify env:set VAR_NAME value                    # Set in all contexts
netlify env:set VAR_NAME value --context production  # Set for specific context
netlify env:set VAR_NAME value --secret           # Mark as secret (write-only)
netlify env:set VAR_NAME value --scope builds     # Only available during builds
netlify env:set VAR_NAME value --scope builds functions  # Multiple scopes
netlify env:unset VAR_NAME                        # Remove a var
netlify env:import .env                           # Import from .env file
netlify env:clone --to <site-id>                  # Clone vars to another site
```

**Scopes:** `builds` (build time), `functions` (serverless functions), `post-processing` (post-processing), `runtime` (edge functions and on-demand builders).

### Sites management

```bash
netlify sites:list         # List all sites
netlify sites:create       # Create a new site
netlify sites:delete       # Delete a site
```

## Common Deployment Patterns

### Next.js Static Export

For `output: "export"` in `next.config.ts`:

```toml
[build]
  command = "npm run build"
  publish = "out"

# SPA fallback for client-side routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This is what you need for a static Next.js app. The `out/` directory is the default export output.

### Next.js with SSR (full server rendering)

Use the `@netlify/plugin-nextjs` adapter (OpenNext for Netlify) for full SSR, ISR, and API routes:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Install: `npm install -D @netlify/plugin-nextjs`

This adapter handles server-side rendering, ISR revalidation, image optimization, and middleware via Netlify Edge Functions. Do NOT use `output: "export"` with this approach — let Next.js use its default server output.

### Standard SPA (React, Vue, etc.)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### API proxy (avoid CORS)

```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.mybackend.com/:splat"
  status = 200
  force = true
```

The browser sees `/api/users`, but Netlify proxies to `https://api.mybackend.com/users`. No CORS headers needed.

### Security headers baseline

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
```

Adjust the CSP to your needs — the above is a reasonable starting point that allows inline scripts/styles and external images over HTTPS.

## Common Gotchas

1. **SPA fallback needs `status = 200`** — Using 301/302 redirects the browser. Use `status = 200` for SPA rewriting so the URL stays the same.

2. **Redirect order matters** — First match wins. Put specific routes above the `/*` catch-all.

3. **`force = true` vs default behavior** — Without `force`, Netlify serves an existing file if one matches the `from` path. With `force = true`, the redirect always applies. You usually want `force = true` for proxy redirects but NOT for SPA fallbacks (you want static assets to be served directly).

4. **Environment variables in netlify.toml are not secret** — The file is in your repo. Use the Netlify UI or CLI (`netlify env:set --secret`) for sensitive values like API keys.

5. **Build vs runtime env vars** — Variables set under `[build.environment]` or `[context.*.environment]` are available at build time. For runtime (edge/serverless functions), set them via the Netlify UI/CLI.

6. **`publish` is relative to `base`** — If you set `base = "web/"`, then `publish = "out"` means `web/out/`.

7. **Deploy previews use branch context** — PR deploys inherit from `[context.deploy-preview]`. Branch deploys (pushed branches without PRs) inherit from `[context.branch-deploy]`.

8. **Max redirect rules** — Netlify supports up to 1,000 redirect rules. If you hit this, consolidate with wildcards.

9. **Functions cold starts** — Netlify Functions (AWS Lambda under the hood) have cold starts. For latency-sensitive endpoints, consider Edge Functions instead.

10. **Edge Functions run Deno** — Edge Functions use Deno runtime, not Node.js. Imports use URL syntax (`import { ... } from "https://..."`), and Node.js built-in modules need the `node:` prefix or may not be available.
