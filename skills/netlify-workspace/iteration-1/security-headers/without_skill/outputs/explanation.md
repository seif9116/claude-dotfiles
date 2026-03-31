# Changes to netlify.toml

## Security Headers (applied to all routes via `/*`)

- **X-Frame-Options: DENY** -- Prevents the site from being embedded in iframes, blocking clickjacking attacks.
- **X-Content-Type-Options: nosniff** -- Stops browsers from MIME-type sniffing, forcing them to respect the declared Content-Type.
- **Referrer-Policy: strict-origin-when-cross-origin** -- Sends the full URL as referrer for same-origin requests but only the origin for cross-origin requests, balancing analytics needs with privacy.
- **Permissions-Policy** -- Disables camera, geolocation, and payment APIs; allows microphone only from the same origin (needed for Quran recitation recording).
- **X-XSS-Protection: 1; mode=block** -- Enables the browser's built-in XSS filter as a defense-in-depth measure for older browsers.
- **Strict-Transport-Security (HSTS)** -- Forces HTTPS for 2 years with subdomain coverage and preload eligibility, preventing protocol downgrade attacks.
- **Content-Security-Policy** -- Restricts resource loading to same-origin by default, with targeted exceptions for inline scripts/styles (common in Next.js static exports), data URIs for fonts/images, and HTTPS for API connections. `frame-ancestors 'none'` reinforces the clickjacking protection.

## Caching Strategy

| Asset type | Max-age | Rationale |
|---|---|---|
| `/_next/static/*` | 1 year, immutable | Next.js includes content hashes in filenames -- these never change, so they can be cached permanently. |
| `.woff` / `.woff2` | 1 year, immutable | Font files (including QCF V2 fonts) are versioned and do not change. |
| `.png` / `.jpg` / `.svg` / `.ico` | 30 days + stale-while-revalidate | Images change infrequently; stale-while-revalidate allows seamless background updates. |
| `.js` / `.css` (root-level) | 1 day + stale-while-revalidate | Non-hashed scripts/stylesheets get a shorter cache with background revalidation. |
| `.html` | 0, must-revalidate | HTML pages always revalidate so users get the latest app shell and routing. |

The `_next/static/*` rule is the most impactful -- it covers the bulk of JS, CSS, and media that Next.js outputs with content-hashed filenames, enabling browsers to skip network requests entirely on repeat visits.
