# SPA "Page Not Found" on Refresh -- Problem and Solution

## The Problem

When you deploy a React single-page application (SPA) to Netlify and navigate to a route like `/dashboard` using client-side routing (e.g., React Router), everything works. But when you **refresh the page** (or paste that URL directly into the browser), Netlify returns a "Page Not Found" error.

### Why This Happens

1. **Client-side routing is invisible to the server.** When you click a link in your React app, React Router intercepts the navigation and renders the correct component -- no request ever reaches the server. The browser URL bar updates via the History API, but no actual HTTP request is made for `/dashboard`.

2. **A hard refresh sends a real HTTP request.** When you press F5 or Ctrl-R on `/dashboard`, the browser sends `GET /dashboard` to Netlify's servers.

3. **Netlify looks for a file at that path.** Because your SPA is a static site, Netlify tries to find a file at `/dashboard/index.html` or `/dashboard.html`. No such file exists -- your entire app lives in a single `/index.html` file. Netlify therefore returns its default 404 page.

This is not unique to Netlify; it affects every static hosting provider (GitHub Pages, Vercel static exports, S3, etc.) unless the server is configured to handle it.

## The Solution

Add (or update) a `netlify.toml` file in the root of your repository with a catch-all redirect rule:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### How It Works

- **`from = "/*"`** -- matches every incoming request path.
- **`to = "/index.html"`** -- tells Netlify to serve your single `index.html` file instead.
- **`status = 200`** -- this is the critical part. It makes this a **rewrite** (the server returns `index.html` with a 200 OK status), not a redirect (which would be a 301 or 302 and would change the URL in the browser). The browser still sees `/dashboard` in the address bar, and React Router reads that path and renders the correct component.

### Why 200, Not 301 or 302?

- A **301/302 redirect** would change the browser URL to `/index.html`, breaking deep linking and making every URL look the same.
- A **200 rewrite** transparently serves `index.html` while preserving the original URL, which is exactly what an SPA needs.

## Alternative: The `_redirects` File

Instead of `netlify.toml`, you can place a `_redirects` file in your build output directory (e.g., `public/` or `out/`) with this single line:

```
/*    /index.html   200
```

This is functionally identical. The `netlify.toml` approach is generally preferred because:
- It lives in the repository root and is easy to find.
- It can contain other Netlify configuration (build commands, headers, plugins, etc.) in one place.
- It is less likely to be accidentally excluded from the build output.

## Important Caveats

1. **Ordering matters.** Netlify processes redirects in order and serves actual files before applying redirect rules. This means requests for real static assets (JS bundles, CSS, images) will still be served correctly -- the catch-all only fires when no matching file exists.

2. **API proxying.** If your app makes API calls to paths like `/api/*`, and you are proxying them through Netlify, put those more-specific redirect rules **before** the catch-all:

   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-api.example.com/:splat"
     status = 200

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

3. **Custom 404 page.** With this rewrite in place, Netlify will never show its own 404 page. If you want a custom "not found" experience, handle it inside your React app (e.g., a catch-all route in React Router that renders a 404 component).
