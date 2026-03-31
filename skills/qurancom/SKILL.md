---
name: qurancom
description: "Quran.com ecosystem expert — Content API (api.quran.com/api/v4), Quran Foundation User APIs (apis.quran.foundation), OAuth2 PKCE auth, QCF V1/V2 fonts, audio CDN, GitHub repos (github.com/quran), MCP server (mcp.quran.ai), tajweed data, and the official JS SDK (@quranjs/api). Use this skill whenever working with Quran verse data, Arabic text rendering, mushaf page layouts, recitation audio, Quran.com API calls, QCF font loading, verse keys (e.g. '2:255'), surah/ayah data, word-by-word translations, tajweed rules, Quran Foundation user features (streaks, bookmarks, activity tracking), or any code that imports from quran-api, fetches from qurancdn.com, or references Quran-related data structures. Also trigger when the user mentions quran.com, the Quran hackathon, Tarteel, or building Quran-related features."
---

# Quran.com Ecosystem

Comprehensive guide to the Quran.com developer ecosystem — APIs, fonts, audio, data, GitHub repos, and integration patterns. This skill exists because the Quran.com ecosystem spans multiple APIs, CDN domains, font systems, and GitHub repos that all interconnect, and getting the details right matters for rendering Quran text correctly and integrating with their platform.

## Architecture Overview

```
Quran.com Ecosystem
├── Quran Foundation API (authenticated, official)
│   ├── Production: apis.quran.foundation      — Content, User, Search APIs
│   ├── Prelive:    apis-prelive.quran.foundation — Testing environment
│   ├── Auth:       oauth2.quran.foundation    — OAuth2 (Client Credentials + PKCE)
│   └── Prelive Auth: prelive-oauth2.quran.foundation
├── Legacy Public API (unauthenticated, may be deprecated)
│   ├── api.quran.com/api/v4                   — Works without auth for now
│   └── api.qurancdn.com/api/qdc              — CDN endpoint used by quran.com frontend
├── Static CDN (static.qurancdn.com)           — Fonts, images
├── Audio CDN (audio.qurancdn.com)             — Recitation audio files
├── MCP Server (mcp.quran.ai)                 — AI-friendly Quran data access
└── GitHub (github.com/quran)                  — 30 repos: frontend, data, fonts, mobile apps
```

**Important:** The official Quran Foundation API requires OAuth2 authentication (Client Credentials flow for content, PKCE for user features). The legacy `api.quran.com/api/v4` still works without auth but may require auth in the future. For the hackathon, prefer the authenticated Foundation API.

**Demo credentials (testing only):** Client ID: `quran-demo`, Secret: `secret` — NOT for production.

## Key Concepts

### Verse Keys
All Quran.com APIs use **verse keys** in `"chapter:verse"` format (e.g., `"2:255"` = Al-Baqarah, verse 255).

### Key Constants
| Division | Count | Range |
|----------|-------|-------|
| Surahs (chapters) | 114 | 1-114 |
| Ayahs (verses) | 6,236 | — |
| Pages (Mushaf) | 604 | 1-604 |
| Juz | 30 | 1-30 |
| Hizb | 60 | 1-60 |
| Rub el Hizb | 240 | 1-240 |
| Ruku | 558 | 1-558 |
| Manzil | 7 | 1-7 |

### Text Types
The API serves Quran text in multiple scripts:
- **`text_uthmani`** — Standard Uthmani script (most common for display)
- **`text_imlaei`** — Simplified spelling (easier for search/comparison)
- **`code_v1`** / **`code_v2`** — QCF glyph codes for page-perfect Mushaf rendering
- **`text_indopak`** — IndoPak script variant
- **`qpc_uthmani_hafs`** — QPC Hafs Uthmani text

### QCF Fonts (Quran Complex Fonts)
Page-perfect Mushaf rendering uses special fonts from the King Fahd Quran Complex. Each of the 604 Quran pages has its own font file containing exact glyph shapes. The API's `code_v1`/`code_v2` fields contain characters that map to these glyphs.

- **V1**: Older, simpler glyphs
- **V2**: Higher quality, current standard
- Font URL pattern: `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p{pageNumber}.woff2`
- Font family naming: `QCF_P001`, `QCF_P002`, ..., `QCF_P604`

### Mushaf Pages
The Quran is divided into 604 pages in the standard Madani Mushaf layout. Each page has fixed line counts. Words on each page have `line_number` and `position` values for exact layout reconstruction.

---

## Content API Reference

### Official (Authenticated)
**Production:** `https://apis.quran.foundation/content/api/v4`
**Prelive:** `https://apis-prelive.quran.foundation/content/api/v4`

Requires OAuth2 Client Credentials flow. Headers: `x-auth-token` + `x-client-id`. Tokens expire after 1 hour.

### Legacy (Unauthenticated — may require auth in future)
**Base URL:** `https://api.quran.com/api/v4`
**CDN:** `https://api.qurancdn.com/api/qdc`

Currently works without auth. The project uses this endpoint for simplicity.

### Demo Credentials (testing only)
Client ID: `quran-demo` | Secret: `secret` — do NOT use in production. Get real credentials at https://api-docs.quran.foundation/request-access

For the full endpoint reference with all parameters and response shapes, read `references/api-endpoints.md`.

### Most-Used Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /chapters` | List all 114 surahs |
| `GET /chapters/{id}` | Single surah metadata |
| `GET /verses/by_chapter/{chapter}` | All verses in a chapter |
| `GET /verses/by_page/{page}` | All verses on a Mushaf page (1-604) |
| `GET /verses/by_key/{key}` | Single verse by key (e.g., `2:255`) |
| `GET /verses/by_juz/{juz}` | Verses in a juz (1-30) |
| `GET /search` | Search Quran text and translations |
| `GET /recitations/{reciter_id}/by_chapter/{chapter}` | Audio files for a chapter |
| `GET /recitations/{reciter_id}/by_ayah/{verse_key}` | Audio file for a verse |
| `GET /resources/recitations` | List available reciters |
| `GET /resources/translations` | List available translations |
| `GET /resources/languages` | List available languages |

### Common Query Parameters

These parameters work across most verse endpoints:

| Parameter | Example | Purpose |
|-----------|---------|---------|
| `language` | `en` | Response language |
| `words` | `true` | Include word-by-word data |
| `translations` | `131` | Translation IDs (comma-separated) |
| `fields` | `text_uthmani,text_imlaei` | Verse-level fields to include |
| `word_fields` | `text_uthmani,code_v2,v2_page,line_number,page_number,position` | Word-level fields |
| `per_page` | `50` | Results per page (max varies by endpoint) |
| `page` | `1` | Pagination page number |

### Key Translation IDs
- **131** — Dr. Mustafa Khattab, The Clear Quran (English, most popular)
- **20** — Sahih International (English)
- **85** — Abdul Haleem (English)

### Key Reciter IDs
- **7** — Mishari Rashid al-Afasy (default, most popular)
- **1** — Abdul Basit Abdul Samad (Murattal)
- **2** — Abdul Rahman Al-Sudais

### Response Shapes

**Verse object:**
```json
{
  "id": 1,
  "verse_number": 1,
  "verse_key": "1:1",
  "hizb_number": 1,
  "rub_el_hizb_number": 1,
  "ruku_number": 1,
  "manzil_number": 1,
  "juz_number": 1,
  "page_number": 1,
  "text_uthmani": "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
  "text_imlaei": "بسم الله الرحمن الرحيم",
  "words": [/* Word objects */],
  "translations": [/* Translation objects */]
}
```

**Word object:**
```json
{
  "id": 1,
  "position": 1,
  "text_uthmani": "بِسْمِ",
  "text_imlaei": "بسم",
  "code_v2": "",
  "v2_page": 1,
  "line_number": 2,
  "page_number": 1,
  "char_type_name": "word",
  "translation": { "text": "In (the) name", "language_name": "english" },
  "transliteration": { "text": "bis'mi", "language_name": "english" }
}
```

**Chapter object:**
```json
{
  "id": 1,
  "revelation_place": "makkah",
  "revelation_order": 5,
  "bismillah_pre": false,
  "name_simple": "Al-Fatihah",
  "name_complex": "Al-Fātiĥah",
  "name_arabic": "الفاتحة",
  "verses_count": 7,
  "pages": [1, 1],
  "translated_name": { "name": "The Opener", "language_name": "english" }
}
```

---

## Quran Foundation User API

**Production:** `https://apis.quran.foundation`
**Prelive (testing):** `https://apis-prelive.quran.foundation`

Requires OAuth2 authentication. Sends `x-auth-token` and `x-client-id` headers.

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/v1/streaks?type=QURAN&status=ACTIVE\|BROKEN&from=&to=` | GET | Reading streaks |
| `/auth/v1/activity-days?type=QURAN&from=&to=` | GET | Daily activity data |
| `/auth/v1/activity-days` | POST | Record review session |
| `/auth/v1/bookmarks` | GET | List bookmarks |
| `/auth/v1/bookmarks` | POST | Create bookmark |
| `/auth/v1/bookmarks/{id}` | DELETE | Delete bookmark |

### Activity Day POST Body
```json
{
  "date": "2026-03-21",
  "type": "QURAN",
  "mushafId": 1,
  "seconds": 120,
  "versesRead": 5,
  "ranges": ["2:1-2:5"]
}
```

---

## OAuth2 Authentication

**Auth URL (Production):** `https://oauth2.quran.foundation`
**Auth URL (Prelive):** `https://prelive-oauth2.quran.foundation`

### Client Credentials Flow (Content API — server-side)
Used for read-only access to Quran content without user context.

```bash
curl --request POST \
  --url https://prelive-oauth2.quran.foundation/oauth2/token \
  --user 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials&scope=content'
```

Returns `access_token` (expires in 3600s). No refresh tokens — re-request when expired. Cache and re-request ~30s before expiry.

### PKCE S256 Flow (User API — client-side)
Used for user-specific features (bookmarks, streaks, etc.) from SPAs/mobile apps.

1. Generate `code_verifier` (random string) and `code_challenge` (SHA-256 hash)
2. Redirect to `/oauth2/auth?response_type=code&client_id={id}&code_challenge={challenge}&code_challenge_method=S256&redirect_uri={uri}&scope=openid+offline_access+user+collection`
3. User authenticates, gets redirected back with `?code={auth_code}`
4. Exchange code at `POST /oauth2/token` for access + refresh tokens
5. Store tokens in localStorage with expiry tracking
6. Send access token as `x-auth-token` header on API calls

### Required Headers (all authenticated requests)
```
x-auth-token: YOUR_ACCESS_TOKEN
x-client-id: YOUR_CLIENT_ID
```

### Demo Credentials (testing only)
Client ID: `quran-demo` | Secret: `secret`

### Request Access
Get production credentials at: https://api-docs.quran.foundation/request-access
Contact: dev@quran.foundation

---

## Audio System

**Audio CDN:** `https://audio.qurancdn.com`

Audio files are served from the CDN. The Content API provides paths:

```
GET /recitations/7/by_ayah/1:1
→ { "audio_files": [{ "url": "AbdulBaset/Murattal/mp3/001001.mp3", ... }] }

Full URL: https://audio.qurancdn.com/AbdulBaset/Murattal/mp3/001001.mp3
```

**Word-by-word audio:** `https://audio.qurancdn.com/wbw/{chapter}_{verse}_{word}.mp3`

### Audio Timestamps
The API provides word-level timestamps for synchronized highlighting:
```json
{
  "verse_timings": [{
    "verse_key": "1:1",
    "timestamp_from": 0,
    "timestamp_to": 5200,
    "segments": [[1, 1, 1, 0, 900], [1, 1, 2, 900, 1800]]
  }]
}
```
Segments format: `[chapter, verse, word, timestamp_from, timestamp_to]`

---

## QCF Font Loading Pattern

This is the standard pattern for dynamically loading QCF V2 fonts:

```typescript
function ensureQcfFont(pageNumber: number): Promise<void> {
  const paddedPage = String(pageNumber).padStart(3, '0');
  const fontFamily = `QCF_P${paddedPage}`;

  // Check if already loaded
  if (document.fonts.check(`16px ${fontFamily}`)) return;

  // Inject @font-face
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: '${fontFamily}';
      src: url('https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2') format('woff2');
      font-display: block;
    }
  `;
  document.head.appendChild(style);

  // Preload
  return document.fonts.load(`16px ${fontFamily}`);
}
```

**Preloading strategy:** Load current page font + adjacent pages (N-1, N+1, N+2) for smooth navigation.

**Rendering:** Words are rendered using their `code_v2` value with the page-specific font family. Each word's `line_number` and `position` determine its layout position.

---

## GitHub Organization (github.com/quran)

For detailed repo information, read `references/github-repos.md`.

### Key Repos

| Repo | Purpose | Tech |
|------|---------|------|
| `quran/quran.com-frontend-next` | Main quran.com website | Next.js 14, Pages Router, Redux, XState, SCSS |
| `quran/qf-api-docs` | API documentation portal | Docusaurus, OpenAPI specs |
| `quran/api-js` | Official JS SDK (`@quranjs/api`) | TypeScript, monorepo |
| `quran/quran.com-fonts` | Font file server | Docker, font files |
| `quran/quran.com-images` | Page image generator | Perl, glyph bounding boxes |
| `quran/quran-tajweed` | Tajweed annotation data | Python, JSON output |
| `quran/audio.quran.com` | QuranicAudio website | SvelteKit |
| `quran/mcp.quran.ai` | MCP server for AI access | Skills, grounding rules |
| `quran/quran_android` | Android app | Kotlin |
| `quran/quran-ios` | iOS app (QuranEngine) | Swift |
| `quran/ayah-detection` | Verse detection in images | Python, OpenCV |

### MCP Server (mcp.quran.ai)

The Quran.com team provides an MCP server with AI-friendly tools:
- `fetch_quran` — Fetch verse text
- `fetch_translation` — Fetch translations
- `fetch_tafsir` — Fetch tafsir/commentary
- `search_quran` / `search_translation` / `search_tafsir` — Search
- `fetch_quran_metadata` — Chapter/juz/page metadata
- `show_mushaf` — Mushaf page rendering
- `fetch_word_morphology` — Word grammar analysis
- `list_editions` — Available text/translation/tafsir editions

**Grounding rules:** Never quote Quran from memory — always fetch canonical text. Translations are not tafsir. Attribution required for all fetched sources.

---

## Tajweed Data

The `quran/quran-tajweed` repo provides tajweed rule annotations as JSON:

```json
[{
  "surah": 1, "ayah": 1,
  "annotations": [
    { "rule": "ikhfa", "start": 5, "end": 7 },
    { "rule": "ghunnah", "start": 12, "end": 14 }
  ]
}]
```

Available rules: `ghunnah`, `idghaam_*`, `ikhfa`, `ikhfa_shafawi`, `iqlab`, `madd_*`, `qalqalah`, `hamzat_wasl`, `lam_shamsiyyah`, `silent`

Source file: `output/tajweed.hafs.uthmani-pause-sajdah.json`

---

## Integration Patterns for This Project (Hafiz/Murajaa)

### API Client Pattern
The project wraps all API calls in `web/src/lib/quran-api.ts` with in-memory caching:
- `getSurahs()` — Cached list of all 114 chapters
- `getVerses(surahNumber)` — All verses with words and translations
- `getVerse(verseKey)` — Single verse with word breakdown
- `getMushafPage(pageNumber)` — Page data with QCF codes and line numbers
- `getVersePageNumber(verseKey)` — Page number lookup

### Verse Identification
The backend (`backend/verse_index.py`) uses:
1. AlQuran.cloud API (`https://api.alquran.cloud/v1/quran/quran-uthmani`) to build a verse index
2. N-gram voting for fast candidate matching
3. Levenshtein distance for ranking
4. Cached locally in `.verse_cache.json`

### Arabic Text Comparison
The backend (`backend/compare.py`) uses:
- Arabic normalization (remove diacritics, normalize hamza forms)
- Needleman-Wunsch sequence alignment for word-level diff
- Returns per-word status: correct, error, missing, extra

### Audio Pipeline
1. User records audio → MediaRecorder API
2. Audio sent to backend (REST or WebSocket)
3. Backend runs Whisper ASR (`tarteel-ai/whisper-base-ar-quran`)
4. Transcription aligned against reference text
5. Word-level results sent back for highlighting

### Data Flow
```
User Recites → Audio → Whisper ASR → Arabic Normalization → Needleman-Wunsch Alignment
    ↓                                                              ↓
Review UI ← Word Status (correct/error/missing/extra) ← Reference Verse (from API)
    ↓
FSRS Algorithm → Next Review Date → IndexedDB
    ↓ (optional)
Quran Foundation API → Streaks, Activity Sync
```

---

## Common Gotchas

1. **QCF fonts are per-page** — You need a different font file for each of the 604 pages. Don't try to use one font for all pages.

2. **`code_v2` is not readable text** — It's glyph codes that only render correctly with the matching QCF font. For readable Arabic, use `text_uthmani`.

3. **Verse keys are 1-indexed** — `"1:1"` is the first verse of the first surah, not `"0:0"`.

4. **Bismillah handling** — Surah 1 (Al-Fatihah) includes Bismillah as verse 1. Surah 9 (At-Tawbah) has no Bismillah. All other surahs have Bismillah before verse 1 (with `bismillah_pre: true`).

5. **Arabic text normalization** — When comparing Arabic text (e.g., for recitation checking), you must normalize: remove diacritics (tashkeel), normalize hamza variants, handle alef forms (أ إ آ → ا).

6. **Audio URL construction** — The API returns relative paths. Prepend `https://audio.qurancdn.com/` to get the full URL.

7. **Pagination** — Default `per_page` varies by endpoint. For full surah data, set `per_page=300` (max verses in longest surah is 286, Al-Baqarah).

8. **The `char_type_name` field** — Words can be `"word"`, `"end"` (verse end marker ۝), `"pause"`, `"sajdah"`, or `"rub-el-hizb"`. Filter to `"word"` for actual Quran words.

9. **Quran Foundation vs Content API** — The Content API (api.quran.com) is public and unauthenticated. The Foundation User API (apis.quran.foundation) requires OAuth2 and is for user-specific features.

10. **Font loading race condition** — Always ensure the QCF font is loaded before rendering `code_v2` text. Use `document.fonts.load()` or `document.fonts.check()`. Set a timeout (500ms) and fall back to `text_uthmani` if font doesn't load.

---

## External References

- **API Documentation Portal**: https://api-docs.quran.foundation
- **Request API Access (OAuth2)**: https://api-docs.quran.foundation/request-access
- **JS SDK**: `npm install @quranjs/api` | https://github.com/quran/api-js
- **Community Discord**: https://discord.gg/SpEeJ5bWEQ
- **Quran.com Frontend Source**: https://github.com/quran/quran.com-frontend-next
- **Tajweed Data**: https://github.com/quran/quran-tajweed
- **MCP Server**: https://github.com/quran/mcp.quran.ai
