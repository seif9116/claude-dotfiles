# Adding a Juz Selector to the Mushaf Navigation Sheet

## Good news: it is already implemented

After reading the source files, the juz selector tab **already exists** in the navigation sheet. Here is what the codebase already has:

### Current state of the juz feature

**1. The nav sheet already has a "juz" tab** (`/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-nav-sheet.tsx`)

The component defines three tabs -- `"surah" | "juz" | "page"` (line 25) -- and renders a 5x6 grid of buttons (numbers 1-30) when the juz tab is selected (lines 126-137). Clicking a juz button calls `handleJuzSelect`, which invokes the `onGoToJuz` prop and closes the sheet.

**2. The viewer wires up juz navigation** (`/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-viewer.tsx`)

The `MushafViewer` component passes `onGoToJuz={handleJuzJump}` to `MushafNavSheet` (line 583). The `handleJuzJump` callback (lines 178-183) calls `getJuzStartPage(juzNumber)` and navigates to that page.

**3. Juz-to-page mapping exists as a hardcoded lookup** (`/home/seif/university/projects/hafiz/web/src/lib/quran-api.ts`)

Lines 181-189 define:

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

This is a synchronous function (no API call needed) that maps each juz number (1-30) to its starting Mushaf page number.

---

## API endpoint for juz data (if you want richer info)

If you want to fetch additional juz metadata beyond the start page (e.g., verse ranges, verse counts), the Quran.com API provides:

**`GET /juzs`** at `https://api.quran.com/api/v4/juzs`

Response shape:
```json
{
  "juzs": [{
    "id": 1,
    "juz_number": 1,
    "verse_mapping": { "1": "1-7", "2": "1-141" },
    "first_verse_id": 1,
    "last_verse_id": 148,
    "verses_count": 148
  }]
}
```

Key fields:
- **`juz_number`**: 1-30
- **`verse_mapping`**: An object where keys are surah numbers and values are verse ranges (e.g., `{"1": "1-7", "2": "1-141"}` means Juz 1 contains Al-Fatihah 1-7 and Al-Baqarah 1-141)
- **`first_verse_id`** / **`last_verse_id`**: Global verse IDs
- **`verses_count`**: Total verses in the juz

You can also fetch all verses within a specific juz using:

**`GET /verses/by_juz/{juz_number}`** with the same query parameters as other verse endpoints (`words=true`, `word_fields=...`, etc.).

---

## How juz maps to page numbers

The hardcoded `JUZ_START_PAGES` array in `quran-api.ts` is the standard Madani Mushaf mapping. If you wanted to derive this dynamically instead of hardcoding it, you could:

1. Call `GET /juzs` to get the `verse_mapping` for each juz
2. Take the first surah:verse from `verse_mapping` (e.g., for Juz 1 it is `1:1`)
3. Call `GET /verses/by_key/{first_verse_key}?fields=page_number` to get its page number

But the hardcoded array is the standard approach -- these page numbers are fixed in the Madani Mushaf and will never change.

---

## Possible enhancements

Since the basic juz selector already works, here are improvements you could consider:

### 1. Highlight the current juz
The viewer already shows the current juz number in the header (line 476: `Juz {page?.juz_number}`). You could highlight the current juz button in the grid:

```tsx
{tab === "juz" && (
  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
    {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
      <button
        key={j}
        onClick={() => handleJuzSelect(j)}
        className={cn(
          "aspect-square rounded-lg border transition-colors flex items-center justify-center text-sm font-medium",
          j === page?.juz_number
            ? "border-primary bg-primary/10 text-primary"
            : "border-border hover:bg-accent"
        )}
      >
        {j}
      </button>
    ))}
  </div>
)}
```

This would require passing `currentJuz` (from `page?.juz_number`) as a prop to `MushafNavSheet`.

### 2. Show juz names / verse ranges
Using the `GET /juzs` API, you could show each juz with its starting surah and verse info (e.g., "Juz 1 -- Al-Fatihah 1:1 to Al-Baqarah 2:141").

### 3. Auto-scroll to current juz
Similar to how the surah list auto-scrolls to the approximate current surah (lines 40-47), you could scroll to highlight the current juz in the grid.

---

## Key files

| File | Purpose |
|------|---------|
| `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-nav-sheet.tsx` | Navigation sheet with surah/juz/page tabs |
| `/home/seif/university/projects/hafiz/web/src/components/quran/mushaf-viewer.tsx` | Main mushaf viewer, wires up navigation callbacks |
| `/home/seif/university/projects/hafiz/web/src/lib/quran-api.ts` | API client with `getJuzStartPage()` and `JUZ_START_PAGES` mapping |
| `/home/seif/university/projects/hafiz/web/src/lib/types.ts` | TypeScript types including `MushafPageData` (has `juz_number` field) |

## Summary

The juz selector is already fully functional in the navigation sheet. The `MushafNavSheet` component has three tabs (surah, juz, page), and the juz tab renders a 5x6 grid of numbered buttons. Clicking one calls `getJuzStartPage(juzNumber)` from `quran-api.ts`, which uses a hardcoded `JUZ_START_PAGES` lookup array to map juz numbers 1-30 to their starting Mushaf page numbers. No additional API call is needed for basic juz-to-page navigation. If you want richer juz metadata (verse ranges, verse counts), use `GET /juzs` from the Quran.com API at `https://api.quran.com/api/v4/juzs`.
