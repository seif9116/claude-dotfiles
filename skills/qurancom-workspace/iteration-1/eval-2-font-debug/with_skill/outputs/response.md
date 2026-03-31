# Mushaf View: Box Characters Instead of Arabic Text

## Root Cause

The box characters (tofu) you're seeing are caused by a **mismatch between the font family name and the CDN URL** in the `ensureQcfFont` function in `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-page.tsx`.

Here's the bug at lines 18-31:

```typescript
function ensureQcfFont(pageNumber: number): string {
  const fontFamily = `QCF_P${String(pageNumber).padStart(3, "0")}`;  // e.g. "QCF_P050"
  if (loadedFonts.has(pageNumber)) return fontFamily;

  if (typeof document !== "undefined") {
    const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;
    //          ^^^ NO PADDING HERE — generates "p50.woff2" instead of "p050.woff2"
```

The **font family name** uses zero-padded page numbers (`QCF_P050`), but the **CDN URL** uses the raw unpadded page number (`p50.woff2`). The correct CDN URL format requires zero-padded 3-digit page numbers: `p050.woff2`.

### Why it appears random

This explains the "random" behavior perfectly:

- **Pages 1-9**: `p1.woff2` should be `p001.woff2` -- BROKEN
- **Pages 10-99**: `p50.woff2` should be `p050.woff2` -- BROKEN
- **Pages 100-604**: `p234.woff2` is correct as `p234.woff2` -- WORKS

So pages 100+ render fine, but pages 1-99 show tofu/boxes. If page 50 appeared to work for you, it's possible the `v2_page` field on the words for that page was returning a page >= 100 from the API (some edge cases near page boundaries), or the browser had the font cached from a previous session.

### Why there are no console errors

Two reasons:

1. **The `@font-face` declaration uses `font-display: block`** (line 25). This tells the browser to wait for the font to load (with an invisible text period), then if it fails, fall back to the next font in the stack. The browser doesn't throw errors for 404'd font files -- it silently falls back.

2. **The 500ms timeout fallback** (line 67) forces `fontReady = true` after half a second regardless of whether the font actually loaded. The `preloadFont` function also swallows errors with `.catch(() => {})` (line 41). So even when the font 404s, the component still renders -- it just renders with the wrong font (or no matching font), producing boxes.

3. **The `loadedFonts` Set caches the page number immediately** (line 27) after injecting the `@font-face` rule, *before* the font actually downloads. So subsequent renders of the same page won't even re-attempt the (broken) load.

## The Fix

In `ensureQcfFont`, pad the page number in the URL to match the CDN's expected format:

**File:** `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-page.tsx`, line 23

Change:
```typescript
const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2`;
```

To:
```typescript
const paddedPage = String(pageNumber).padStart(3, "0");
const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${paddedPage}.woff2`;
```

Since `paddedPage` is already computed for `fontFamily` on line 19, you can refactor the whole function to reuse it:

```typescript
function ensureQcfFont(pageNumber: number): string {
  const paddedPage = String(pageNumber).padStart(3, "0");
  const fontFamily = `QCF_P${paddedPage}`;
  if (loadedFonts.has(pageNumber)) return fontFamily;

  if (typeof document !== "undefined") {
    const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${paddedPage}.woff2`;
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: '${fontFamily}'; src: url('${url}') format('woff2'); font-display: block; }`;
    document.head.appendChild(style);
    loadedFonts.add(pageNumber);
  }

  return fontFamily;
}
```

## Secondary Issue: `loadedFonts` Caches Before Download Completes

The `loadedFonts.add(pageNumber)` on line 27 marks the font as "loaded" immediately after injecting the `<style>` tag, not after the font file actually downloads. This means:

- If the network request fails (timeout, CDN issue), the font is permanently marked as loaded for that session
- Navigating away and back to the same page won't retry the font load

This isn't causing the current bug (the URL fix resolves that), but it makes the system fragile. A more robust approach would track loading state and only cache on successful download:

```typescript
const loadedFonts = new Set<number>();
const loadingFonts = new Map<number, Promise<void>>();

function ensureQcfFont(pageNumber: number): string {
  const paddedPage = String(pageNumber).padStart(3, "0");
  const fontFamily = `QCF_P${paddedPage}`;

  if (!loadedFonts.has(pageNumber) && typeof document !== "undefined") {
    const url = `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${paddedPage}.woff2`;
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: '${fontFamily}'; src: url('${url}') format('woff2'); font-display: block; }`;
    document.head.appendChild(style);
    loadedFonts.add(pageNumber);
  }

  return fontFamily;
}

function preloadFont(pageNumber: number): Promise<void> {
  if (loadingFonts.has(pageNumber)) return loadingFonts.get(pageNumber)!;

  const fontFamily = ensureQcfFont(pageNumber);
  if (typeof document === "undefined") return Promise.resolve();

  const promise = document.fonts
    .load(`1rem '${fontFamily}'`)
    .then(() => {})
    .catch(() => {
      // Remove from cache so it can be retried
      loadedFonts.delete(pageNumber);
      loadingFonts.delete(pageNumber);
    });

  loadingFonts.set(pageNumber, promise);
  return promise;
}
```

## Third Issue: `per_page=50` May Truncate Long Pages

In `/home/seif/university/projects/hafiz/web/src/lib/quran-api.ts`, line 105:

```typescript
`${API_BASE}/verses/by_page/${pageNumber}?...&per_page=50`
```

The `per_page=50` limit should be fine since no single Mushaf page has more than ~15 verses. However, the API's `pagination` object in the response is never checked, so if a page somehow had more results, they'd be silently dropped. This is not causing the box character issue but is worth noting.

## How to Verify the Fix

1. Open the browser DevTools Network tab
2. Navigate to a page < 100 (e.g., page 50)
3. Before the fix: you'll see a 404 for `p50.woff2`
4. After the fix: you'll see a successful download of `p050.woff2`
5. The Arabic text should render with proper Mushaf glyphs instead of boxes

## Summary

| Issue | Severity | Fix |
|-------|----------|-----|
| CDN URL missing zero-padding for pages 1-99 | **Critical** -- causes tofu on ~16% of pages | Pad `pageNumber` with `padStart(3, "0")` in the URL |
| `loadedFonts` caches before download completes | Low -- makes failed loads non-retryable | Cache on successful `document.fonts.load()`, retry on failure |
| Errors swallowed silently in `preloadFont` | Low -- hides network issues from developers | Add `console.warn` in the `.catch()` handler |
