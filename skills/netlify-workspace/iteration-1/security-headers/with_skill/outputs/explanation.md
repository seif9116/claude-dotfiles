# Changes to netlify.toml

## Security headers (applied to all routes via `/*`)

| Header | Purpose |
|---|---|
| `X-Frame-Options: DENY` | Prevents the site from being embedded in iframes (clickjacking protection). |
| `X-XSS-Protection: 1; mode=block` | Tells older browsers to block reflected XSS attacks. |
| `X-Content-Type-Options: nosniff` | Prevents browsers from MIME-sniffing a response away from the declared content type. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Sends origin-only referrer on cross-origin requests; full referrer on same-origin. |
| `Permissions-Policy: camera=(), geolocation=()` | Disables camera and geolocation APIs. Microphone is intentionally allowed because the app uses the Web Audio / MediaRecorder API for Quran recitation. |
| `Strict-Transport-Security` | Forces HTTPS for 2 years with subdomain coverage and preload eligibility. |
| `Content-Security-Policy` | Restricts resource loading to same-origin by default. Allows inline scripts/styles (needed by Next.js), data: URIs for fonts, HTTPS images, HTTPS for fetch/XHR (API calls), and blob: for media (audio recording). |

## Caching strategy (three tiers)

1. **`/_next/*` and `/_next/static/*` -- immutable, 1 year.** All assets under `_next/` are content-hashed by Next.js. When any source file changes, the build produces new filenames, so these can safely be cached forever. This covers JS chunks, CSS, woff2 fonts, and other media.

2. **Root-level static files (`*.svg`, `*.ico`) -- 1 day + stale-while-revalidate for 7 days.** These files sit at the public root without content hashes, so they need a shorter TTL to pick up changes after a redeploy while still being cacheable.

3. **HTML pages (`*.html`, `/`) -- no cache, must-revalidate.** HTML documents are never cached so that new deploys are visible immediately. This ensures the SPA shell always references the latest `_next/` chunk filenames.

## What was kept unchanged

- Build command and publish directory remain the same.
- The SPA fallback redirect (`/* -> /index.html`, status 200) is preserved at the bottom, ensuring client-side routing continues to work. `force` is intentionally omitted so that Netlify serves actual static files when they exist before falling back.
