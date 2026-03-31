# SPA "Page Not Found" on Refresh — Problem and Solution

## The Problem

When you deploy a React Single-Page Application (SPA) to Netlify, navigating to `/dashboard` via an in-app link works fine because React Router handles the route entirely in the browser — no server request is made. However, when you **refresh the page** (or type the URL directly), the browser sends an HTTP request to Netlify's servers asking for `/dashboard`. Netlify looks for a file at that path (e.g., `dist/dashboard/index.html` or `dist/dashboard`), finds nothing, and returns its default **404 "Page Not Found"** page.

This happens because an SPA has only one real HTML file (`index.html`) and all routing is handled client-side by JavaScript. The server has no knowledge of `/dashboard`, `/settings`, `/profile`, or any other route your React Router defines.

## The Solution

Add a **catch-all redirect rule** in your `netlify.toml` file that tells Netlify: "For any URL that doesn't match an existing static file, serve `index.html` instead with a 200 status."

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### How it works

1. A user requests `/dashboard` (via refresh or direct URL entry).
2. Netlify checks whether a static file exists at `/dashboard` — it does not.
3. The `/*` redirect rule matches, and Netlify serves the contents of `/index.html` with HTTP status `200`.
4. The browser loads `index.html`, which loads your React app's JavaScript bundle.
5. React Router reads the current URL (`/dashboard`) and renders the correct component.

### Why `status = 200` and not `301` or `302`

- **`200`** is a rewrite: Netlify serves `index.html` but the browser URL stays as `/dashboard`. This is what SPAs need.
- **`301`/`302`** would redirect the browser to `/index.html`, changing the visible URL and breaking client-side routing entirely.

### Why NOT to add `force = true`

The `force` option makes Netlify apply the redirect even when a static file exists at the matched path. For SPA fallbacks you should **omit** `force` (or set it to `false`). This way:

- Requests for `/assets/app.js`, `/styles.css`, images, and other real files are served directly from the `dist/` (or `publish`) directory.
- Only requests that don't match any real file fall through to the `index.html` rewrite.

If you added `force = true`, every request — including those for CSS, JS, and images — would return `index.html`, completely breaking your app.

### Redirect order matters

If you have additional redirect rules (e.g., an API proxy), place them **above** the `/*` catch-all. Netlify processes redirects top-to-bottom and uses the first match:

```toml
# Specific rules first
[[redirects]]
  from = "/api/*"
  to = "https://api.mybackend.com/:splat"
  status = 200
  force = true

# SPA catch-all last
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Complete `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Adjust `publish` to match your build tool's output directory (`dist` for Vite/CRA defaults, `build` for older CRA, `out` for Next.js static export, etc.).

## Alternative: `_redirects` file

Instead of `netlify.toml`, you can place a `_redirects` file in your publish directory with a single line:

```
/*    /index.html   200
```

Both approaches are equivalent. The `netlify.toml` approach is generally preferred because it keeps all Netlify configuration in one place and supports richer options (headers, deploy contexts, plugins, etc.).
