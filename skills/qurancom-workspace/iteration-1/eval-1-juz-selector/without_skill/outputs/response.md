# Adding a Juz Selector to the Mushaf Navigation Sheet

## Good News: The Juz Selector Already Exists

After reading through the codebase, I found that the juz selector tab is **already fully implemented** in your mushaf navigation sheet. Here is a summary of how it all works end-to-end:

### Current Navigation Architecture

The navigation sheet lives at:
- **`/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-nav-sheet.tsx`**

It already has three tabs defined on line 25:

```typescript
type Tab = "surah" | "juz" | "page";
```

And renders all three tab buttons (line 87):

```tsx
{(["surah", "juz", "page"] as const).map((t) => (
  <button key={t} onClick={() => setTab(t)} ...>
    {t}
  </button>
))}
```

The **juz tab content** (lines 126-138) renders a 5-column grid of buttons numbered 1-30:

```tsx
{tab === "juz" && (
  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
    {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
      <button
        key={j}
        onClick={() => handleJuzSelect(j)}
        className="aspect-square rounded-lg border border-border hover:bg-accent ..."
      >
        {j}
      </button>
    ))}
  </div>
)}
```

### How Juz Maps to Page Numbers

The juz-to-page mapping is handled in **`/home/seif/university/projects/hafiz/web/src/lib/quran-api.ts`** (lines 182-189).

It uses a **hardcoded lookup array** (not an API call), which is the correct approach since these page numbers are fixed in the standard Uthmani Mushaf:

```typescript
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function getJuzStartPage(juzNumber: number): number {
  return JUZ_START_PAGES[juzNumber - 1] || 1;
}
```

This is a synchronous function (no API call needed), mapping:
- Juz 1 -> Page 1
- Juz 2 -> Page 22
- Juz 3 -> Page 42
- ... and so on through ...
- Juz 30 -> Page 582

### Full Data Flow

1. User opens the nav sheet by clicking the surah name / chevron in the header bar (`mushaf-viewer.tsx` line 468).
2. User clicks the "juz" tab in the sheet.
3. User clicks a juz number (e.g., 15).
4. `handleJuzSelect(15)` is called in `mushaf-nav-sheet.tsx`, which calls `onGoToJuz(15)` and closes the sheet.
5. In `mushaf-viewer.tsx` (lines 178-183), `handleJuzJump` calls `getJuzStartPage(15)` which returns `282`.
6. `goToPage(282)` sets the page number state, triggering the page data fetch via `getMushafPage(282)`.

### Available Quran.com API Endpoints for Juz

While the current implementation uses a hardcoded mapping (which is fine since Mushaf page boundaries are fixed), the **Quran.com v4 API** does provide juz-related endpoints if you ever need dynamic data:

1. **`GET /juzs`** - Returns all 30 juz with their verse mappings:
   - URL: `https://api.quran.com/api/v4/juzs`
   - Returns: `{ juzs: [{ id, juz_number, verse_mapping, first_verse_id, last_verse_id, verses_count }] }`
   - The `verse_mapping` object maps surah numbers to verse ranges (e.g., `{"2": "142-252"}`)

2. **`GET /verses/by_juz/{juz_number}`** - Returns all verses in a specific juz:
   - URL: `https://api.quran.com/api/v4/verses/by_juz/30?words=true&per_page=50`
   - Useful if you want to show which surahs/verses are in each juz

3. **Juz number from page data** - Already used: when fetching page data via `GET /verses/by_page/{page}`, each verse object includes `juz_number`, which is extracted at line 116 of `quran-api.ts` and stored in `MushafPageData.juz_number`.

### Current Juz Display in the Header

The header bar already shows the current juz number (line 476 of `mushaf-viewer.tsx`):

```tsx
Page {pageNumber} &middot; Juz {page?.juz_number || "\u2014"}
```

### If You Want to Enhance the Juz Selector

The existing implementation is functional but minimal. Here are potential improvements you could make:

1. **Highlight the current juz** - Compare each button's juz number against `page?.juz_number` to visually indicate which juz the user is currently viewing. You would need to pass `currentPage` (or the juz number derived from it) as a prop and apply a highlight style.

2. **Show surah names per juz** - Use the `/juzs` endpoint to fetch `verse_mapping` and display which surahs each juz covers (e.g., "Juz 1: Al-Fatiha - Al-Baqarah 141").

3. **Show hizb/quarter markers** - Each juz is divided into 2 hizbs (60 total), and each hizb into 4 quarters (240 total). The API provides `GET /verses/by_hizb/{hizb_number}` if you want finer-grained navigation.

### Summary

| Component | File | Status |
|---|---|---|
| Juz tab in nav sheet | `web/src/components/quran/mushaf-nav-sheet.tsx` | Already implemented (lines 126-138) |
| Juz-to-page mapping | `web/src/lib/quran-api.ts` | Already implemented as `getJuzStartPage()` (lines 182-189) |
| Juz jump handler | `web/src/components/quran/mushaf-viewer.tsx` | Already implemented as `handleJuzJump` (lines 178-183) |
| Juz display in header | `web/src/components/quran/mushaf-viewer.tsx` | Already shows current juz (line 476) |
| Props wiring | `web/src/components/quran/mushaf-viewer.tsx` | `onGoToJuz={handleJuzJump}` passed to nav sheet (line 583) |

The feature is complete and wired up. No additional API endpoint is needed for the basic juz navigation since the hardcoded `JUZ_START_PAGES` array accurately maps all 30 juz to their standard Mushaf starting pages.
