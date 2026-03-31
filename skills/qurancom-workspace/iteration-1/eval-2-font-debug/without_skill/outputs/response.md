# Mushaf View Showing Box Characters: Root Cause Analysis and Fix

## The Problem

Some Mushaf pages display box/tofu characters (rectangles) instead of Arabic text. It appears random -- some pages render perfectly while others show boxes. No console errors are logged.

## Root Cause

There are **two independent bugs** working together to cause this issue. Both stem from how QCF V2 (Quran Complex Fonts version 2) work.

### How QCF V2 Fonts Work

QCF V2 is a set of **604 separate font files** -- one per page of the Mushaf. Each font contains custom glyphs mapped to Unicode Private Use Area (PUA) codepoints. The `code_v2` field from the Quran.com API contains these PUA characters. A word's glyph **only exists in the specific page font it belongs to**. If you try to render a `code_v2` glyph with the wrong page font (or no font at all), the browser has no glyph for that codepoint and renders a box/tofu character.

---

### Bug 1: API Pagination Truncation (`per_page=50`)

**File:** `/home/seif/university/projects/hafiz/web/src/lib/quran-api.ts`, line 105

```typescript
const res = await fetch(
  `${API_BASE}/verses/by_page/${pageNumber}?language=en&words=true&word_fields=text_uthmani,code_v2,v2_page,line_number,page_number,position&per_page=50`
);
```

The API is called with `per_page=50`, which limits results to 50 **verses** per request. Most Mushaf pages contain fewer than 15 verses, so this works fine for the majority of pages. However, the Quran.com API returns **words nested inside verses**, and some pages may have many short verses (e.g., late-Quran surahs). More critically, if pagination metadata is returned and there are more results, the code **never checks for or fetches subsequent pages** -- there is no pagination handling anywhere in the codebase.

While 50 verses per page is typically enough for a single Mushaf page, this is a latent risk. The real danger is if the API ever returns fewer words than expected (due to rate limiting, partial responses, etc.), the missing words would simply not render.

### Bug 2: Font/Glyph Mismatch -- The Primary Cause

**File:** `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-page.tsx`, lines 18-31 and 170

This is the actual bug causing box characters. The issue is a **mismatch between the font loaded for the page and the font that individual words actually need**.

In `ensureQcfFont`, the font is loaded based on a `pageNumber` parameter:

```typescript
function ensureQcfFont(pageNumber: number): string {
  const fontFamily = `QCF_P${String(pageNumber).padStart(3, "0")}`;
  // ...
  const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;
  // ...
}
```

And each word renders using `word.v2_page`:

```typescript
const fontFamily = ensureQcfFont(word.v2_page);  // line 170
```

The font URL uses `p${pageNumber}.woff2` **without zero-padding**, but the Quran CDN expects **zero-padded filenames** for its font files. The CDN URL structure for QCF V2 fonts is:

- `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p1.woff2` -- works (or may not exist)
- `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p50.woff2` -- works (or may not exist)
- `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p234.woff2` -- works (or may not exist)

Actually, looking more carefully at the CDN, the real issue is more subtle. Let me trace the exact flow:

1. `getMushafPage(pageNumber)` fetches words from the API
2. For each word, `v2_page` is set: `w.v2_page || pageNumber`
3. When rendering, `ensureQcfFont(word.v2_page)` creates a `@font-face` rule and loads the font
4. The `preloadFont` in the `useEffect` only preloads the **page-level** font, not fonts for individual words

**The critical issue: the `v2_page` field from the API can be `null` or `undefined` for certain words.** When the API doesn't return `v2_page`, the fallback is `pageNumber`:

```typescript
v2_page: w.v2_page || pageNumber,   // quran-api.ts line 123
```

But `w.v2_page` could also be `0` (falsy in JavaScript), causing it to incorrectly fall back to `pageNumber`. More importantly, the Quran.com API's `v2_page` field for words that span page boundaries may differ from the Mushaf page number being viewed. If a verse starts on page 233 but continues onto page 234, the words from page 233 have `v2_page: 233` but are being displayed on page 234. The `preloadFont` in the useEffect only preloads the current page number and adjacent pages -- it does NOT scan all words to find which `v2_page` values are actually needed.

**The 500ms timeout is the smoking gun:**

```typescript
const timeout = setTimeout(() => setFontReady(true), 500); // max wait
```

This forces the page to become visible after 500ms regardless of whether the font has loaded. If the font file is slow to download (large files, CDN latency, or the font hasn't been requested yet), the page renders with missing glyphs. The `font-display: block` in the `@font-face` rule would normally hide text until the font loads, but the component's own opacity transition (`opacity-0` to `opacity-100`) overrides this by forcing visibility after 500ms.

### Bug 3: Race Condition in Font Loading

**File:** `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-page.tsx`, lines 16-31

The `loadedFonts` Set tracks which fonts have had their `@font-face` style injected, but it marks a font as "loaded" immediately when the style tag is appended -- **not when the font file has actually been downloaded and parsed by the browser**:

```typescript
document.head.appendChild(style);
loadedFonts.add(pageNumber);  // Marked as loaded, but font file isn't downloaded yet!
```

On subsequent renders or when navigating back to a page, `ensureQcfFont` sees the page in `loadedFonts` and returns immediately without checking if the font is actually available. The `preloadFont` function does use `document.fonts.load()` to trigger actual loading, but:

1. It swallows errors silently with `.catch(() => {})`
2. It's only called for the current page and 3 adjacent pages in the useEffect
3. Individual word-level `ensureQcfFont` calls (line 170) only inject the style tag but never wait for the font to download

---

## Why It Appears Random

The randomness comes from several factors:

1. **CDN caching**: Fonts for commonly visited pages (1, 2, 604, etc.) may already be in browser/CDN cache, loading instantly. Less-visited pages take longer.
2. **Network timing**: The 500ms timeout races against font download. On fast connections, most fonts load in time. On slower connections or with cold caches, they don't.
3. **Page complexity**: Some pages have words referencing different `v2_page` values than the page number itself, and those cross-page fonts aren't preloaded.
4. **Browser font cache**: Once a font loads successfully, it stays in the browser cache, making the page work on refresh even if the initial load had issues.

---

## The Fix

Here is a comprehensive fix addressing all three issues:

### Fix 1: Preload ALL fonts actually needed by words on the page (not just the page number)

In `mushaf-page.tsx`, the `useEffect` should scan all words to find every unique `v2_page` value and preload all of them:

```typescript
useEffect(() => {
  setFontReady(false);

  // Collect ALL unique v2_page values from words on this page
  const neededPages = new Set<number>();
  neededPages.add(page.page_number);
  for (const line of page.lines) {
    for (const word of line.words) {
      neededPages.add(word.v2_page);
    }
  }

  // Preload all needed fonts, plus adjacent pages for smooth navigation
  const fontPromises = Array.from(neededPages).map((p) => preloadFont(p));

  // Also prefetch adjacent for navigation
  if (page.page_number > 1) preloadFont(page.page_number - 1);
  if (page.page_number < 604) preloadFont(page.page_number + 1);

  // Wait for ALL needed fonts (no arbitrary timeout)
  Promise.all(fontPromises)
    .then(() => setFontReady(true))
    .catch(() => setFontReady(true)); // show content even if fonts fail

  // No arbitrary 500ms timeout -- let fonts load properly
}, [page]);  // Depend on the full page object, not just page_number
```

### Fix 2: Remove the 500ms forced-visibility timeout

Delete the `setTimeout(() => setFontReady(true), 500)` line. Instead, rely on `Promise.all` completing for all required fonts. If you want a safety net, use a longer timeout (e.g., 3000ms) only as a last resort:

```typescript
const timeout = setTimeout(() => setFontReady(true), 3000); // generous fallback

Promise.all(fontPromises).then(() => {
  clearTimeout(timeout);
  setFontReady(true);
});

return () => clearTimeout(timeout);
```

### Fix 3: Fix the `loadedFonts` tracking to be meaningful

The `loadedFonts` set should only be used to avoid injecting duplicate `<style>` tags (which it does correctly). But `preloadFont` should always call `document.fonts.load()` regardless of whether the style was previously injected, because the font file may not have actually loaded:

```typescript
function preloadFont(pageNumber: number): Promise<void> {
  const fontFamily = ensureQcfFont(pageNumber); // injects style if needed
  if (typeof document === "undefined") return Promise.resolve();

  // Always attempt to load -- the browser will use cache if available
  return document.fonts
    .load(`1rem '${fontFamily}'`)
    .then(() => {})
    .catch((err) => {
      console.warn(`Failed to load font ${fontFamily}:`, err);
    });
}
```

### Fix 4: Handle `v2_page` falsy values properly in the API layer

In `quran-api.ts`, line 123, use nullish coalescing instead of logical OR to handle the case where `v2_page` is `0`:

```typescript
v2_page: w.v2_page ?? pageNumber,  // was: w.v2_page || pageNumber
```

This ensures that `0` (if the API ever returns it) is not incorrectly treated as falsy. Same for `code_v2`:

```typescript
code_v2: w.code_v2 ?? w.text_uthmani,  // was: w.code_v2 || w.text_uthmani
```

---

## Summary

| Issue | Location | Impact |
|-------|----------|--------|
| Only current page font preloaded, not all `v2_page` values | `mushaf-page.tsx` useEffect | Words needing a different page's font show as boxes |
| 500ms forced visibility timeout | `mushaf-page.tsx` line 67 | Page renders before fonts finish downloading |
| `loadedFonts` tracks style injection, not actual font availability | `mushaf-page.tsx` line 20 | Revisited pages may still have unloaded fonts |
| `v2_page \|\| pageNumber` falsy handling | `quran-api.ts` line 123 | Edge case: `v2_page: 0` falls back incorrectly |
| Silent error swallowing in preloadFont | `mushaf-page.tsx` line 41 | Font load failures are invisible |

The primary fix is ensuring that **all fonts referenced by `v2_page` across all words on the page are loaded before the page becomes visible**, rather than only preloading the font matching the page number and hoping for the best within 500ms.
