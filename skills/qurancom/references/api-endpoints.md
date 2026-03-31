# Quran.com API — Full Endpoint Reference

## API Environments

### Official Quran Foundation API (Authenticated)
| Environment | API Base | Auth Base |
|-------------|----------|-----------|
| **Production** | `https://apis.quran.foundation` | `https://oauth2.quran.foundation` |
| **Prelive (testing)** | `https://apis-prelive.quran.foundation` | `https://prelive-oauth2.quran.foundation` |

Content API paths under these bases: `/content/api/v4/...`

### Legacy Public API (Unauthenticated — may require auth in future)
| Base URL | Notes |
|----------|-------|
| `https://api.quran.com/api/v4` | Legacy public endpoint, currently works without auth |
| `https://api.qurancdn.com/api/qdc` | CDN endpoint used by quran.com frontend |
| `https://staging.quran.com/api/qdc` | Staging |

**Important:** The official docs state all APIs now require OAuth2. The legacy `api.quran.com/api/v4` endpoint still works unauthenticated for now but may be deprecated. For the hackathon, use the authenticated Foundation API.

---

## Authentication

### Client Credentials Flow (for Content API)
Used for server-side access to read-only Quran content.

```bash
curl --request POST \
  --url https://prelive-oauth2.quran.foundation/oauth2/token \
  --user 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials&scope=content'
```

**Response:**
```json
{
  "access_token": "YOUR_ACCESS_TOKEN",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "content"
}
```

Tokens expire after **1 hour**. No refresh tokens — request a new token when expired. Cache tokens and re-request ~30 seconds before expiry.

### Required Headers (all authenticated requests)
```
x-auth-token: YOUR_ACCESS_TOKEN
x-client-id: YOUR_CLIENT_ID
```

### Demo Credentials (testing only)
- **Client ID:** `quran-demo`
- **Client Secret:** `secret`
- **NOT for production use**

### PKCE Flow (for User APIs)
Used for client-side apps accessing user-specific data (bookmarks, streaks, etc.):
1. Generate `code_verifier` and `code_challenge` (SHA-256)
2. Redirect to `/oauth2/auth?response_type=code&client_id={id}&code_challenge={challenge}&code_challenge_method=S256&redirect_uri={uri}&scope=openid+offline_access+user+collection`
3. Exchange code at `POST /oauth2/token`
4. Store tokens, send as `x-auth-token` header

### Request Access
Get credentials at: https://api-docs.quran.foundation/request-access
Contact: dev@quran.foundation

### Environment Variables (Server-Side)
```
QF_CLIENT_ID           (required)
QF_CLIENT_SECRET       (required — server only, NEVER in client code)
QF_ENV                 (optional: "prelive" or "production", defaults to "prelive")
```

---

## Content API v4

### Chapters (Surahs)

#### GET /chapters
List all 114 chapters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `en` | Language code |

**Response:**
```json
{
  "chapters": [{
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
  }]
}
```

#### GET /chapters/{id}
Single chapter metadata.

#### GET /chapters/{id}/info
Detailed chapter info with description text.

---

### Verses (Ayahs)

All verse endpoints share these common query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `en` | Language for word translations |
| `words` | string | `false` | Include word-by-word data (`true`/`false`) |
| `translations` | string | — | Comma-separated translation IDs (e.g., `131,20`). Use ID `57` for full-ayah transliteration |
| `audio` | integer | — | Recitation ID to include audio per verse |
| `tafsirs` | string | — | Comma-separated tafsir IDs |
| `fields` | string | — | Verse-level fields: `text_uthmani`, `text_imlaei`, `text_indopak`, `text_uthmani_simple`, `text_imlaei_simple`, `text_uthmani_tajweed`, `code_v1`, `code_v2` |
| `word_fields` | string | — | Word-level fields: `text_uthmani`, `text_imlaei`, `text_indopak`, `code_v1`, `code_v2`, `v1_page`, `v2_page`, `line_number`, `page_number`, `position`, `audio_url`, `location`, `qpc_uthmani_hafs` |
| `translation_fields` | string | — | Additional translation fields |
| `tafsir_fields` | string | — | Additional tafsir fields |
| `page` | integer | `1` | Pagination page |
| `per_page` | integer | `10` | Results per page (max **50**) |

#### GET /verses/by_chapter/{chapter_number}
All verses in a chapter (1-114).

#### GET /verses/by_page/{page_number}
All verses on a Mushaf page (1-604). **Primary endpoint for Mushaf rendering.**

Use with: `words=true&word_fields=code_v2,v2_page,line_number,page_number,position`

#### GET /verses/by_key/{verse_key}
Single verse by key (e.g., `2:255`).

#### GET /verses/by_juz/{juz_number}
Verses in a juz (1-30).

#### GET /verses/by_hizb/{hizb_number}
Verses in a hizb (1-60).

#### GET /verses/by_rub_el_hizb/{rub_number}
Verses in a rub el hizb (1-240).

#### GET /verses/by_ruku/{ruku_number}
Verses in a ruku (thematic unit).

#### GET /verses/random
Random verse.

### Verse Response Schema

```json
{
  "verses": [{
    "id": 1,
    "chapter_id": 1,
    "verse_number": 1,
    "verse_key": "1:1",
    "verse_index": 1,
    "juz_number": 1,
    "hizb_number": 1,
    "rub_number": 1,
    "ruku_number": 1,
    "manzil_number": 1,
    "page_number": 1,
    "text_uthmani": "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    "text_uthmani_simple": "بسم الله الرحمن الرحيم",
    "text_imlaei": "بسم الله الرحمن الرحيم",
    "text_imlaei_simple": "بسم الله الرحمن الرحيم",
    "text_indopak": "...",
    "text_uthmani_tajweed": "<tajweed>...</tajweed>",
    "code_v1": "...",
    "code_v2": "...",
    "v1_page": 1,
    "v2_page": 1,
    "image_url": "...",
    "image_width": 1200,
    "words": [{
      "id": 1,
      "position": 1,
      "text_uthmani": "بِسْمِ",
      "text_imlaei": "بسم",
      "text_indopak": "...",
      "code_v1": "...",
      "code_v2": "...",
      "v1_page": 1,
      "v2_page": 1,
      "page_number": 1,
      "line_number": 2,
      "verse_key": "1:1",
      "location": "1:1:1",
      "char_type_name": "word",
      "audio_url": "wbw/001_001_001.mp3",
      "translation": { "text": "In (the) name", "language_name": "english" },
      "transliteration": { "text": "bis'mi", "language_name": "english" }
    }],
    "audio": {
      "verse_key": "1:1",
      "url": "..."
    },
    "translations": [{
      "resource_id": 131,
      "resource_name": "Dr. Mustafa Khattab, The Clear Quran",
      "id": 1,
      "text": "In the Name of Allah—the Most Compassionate, Most Merciful.",
      "verse_id": 1,
      "language_id": 38,
      "language_name": "english",
      "verse_key": "1:1",
      "chapter_id": 1,
      "verse_number": 1,
      "juz_number": 1,
      "hizb_number": 1,
      "rub_number": 1,
      "page_number": 1
    }]
  }],
  "pagination": {
    "per_page": 10,
    "current_page": 1,
    "next_page": 2,
    "total_pages": 5,
    "total_records": 50
  }
}
```

### Word `char_type_name` Values
- `"word"` — Actual Quran word
- `"end"` — Verse end marker (۝)
- `"pause"` — Pause mark
- `"sajdah"` — Sajdah mark
- `"rub-el-hizb"` — Rub el hizb marker

---

### Audio / Recitations

#### GET /resources/recitations
List all available reciters.

#### GET /resources/chapter_reciters
Reciters available for full chapter recitation.

#### GET /recitations/{id}/chapters/{chapter_number}/audio_file
Audio file for an entire chapter by a specific reciter.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Reciter ID (path) |
| `chapter_number` | integer | 1-114 (path) |
| `segments` | boolean | Include word-level timing triplets (query, default: false) |

**Response:**
```json
{
  "audio_file": {
    "id": 1,
    "chapter_id": 1,
    "file_size": 1234567.0,
    "format": "mp3",
    "audio_url": "https://audio.qurancdn.com/...",
    "timestamps": [{
      "verse_key": "1:1",
      "timestamp_from": 0,
      "timestamp_to": 5200,
      "duration": 5200,
      "segments": [[1, 0, 900], [2, 900, 1800]]
    }]
  }
}
```

**Segment format:** `[word_index, start_ms, end_ms]` — enables word-level audio highlighting.

#### GET /recitations/{recitation_id}/by_ayah/{verse_key}
Audio for a single verse.

#### GET /recitations/{recitation_id}/by_chapter/{chapter_number}
Audio for all verses in a chapter.

#### GET /recitations/{recitation_id}/by_juz/{juz_number}
Audio for verses in a juz.

#### GET /recitations/{recitation_id}/by_page/{page_number}
Audio for verses on a page.

#### GET /recitations/{recitation_id}/by_hizb/{hizb_number}
Audio for verses in a hizb.

#### GET /recitations/{recitation_id}/by_rub_el_hizb/{rub_number}
Audio for verses in a rub el hizb.

### All Available Reciters
| ID | Reciter | Style |
|----|---------|-------|
| 1 | AbdulBaset AbdulSamad | Mujawwad |
| 2 | AbdulBaset AbdulSamad | Murattal |
| 3 | Abdur-Rahman as-Sudais | — |
| 4 | Abu Bakr al-Shatri | — |
| 5 | Hani ar-Rifai | — |
| 6 | Mahmoud Khalil Al-Husary | — |
| 7 | Mishari Rashid al-Afasy | — (default, most popular) |
| 8 | Mohamed Siddiq al-Minshawi | Mujawwad |
| 9 | Mohamed Siddiq al-Minshawi | Murattal |
| 10 | Sa'ud ash-Shuraym | — |
| 11 | Mohamed al-Tablawi | — |
| 12 | Mahmoud Khalil Al-Husary | Muallim |

### Chapter-Level Audio

#### GET /chapter_recitations/{reciter_id}
List all chapter audio files for a reciter. Returns full chapter-level MP3s.

#### GET /chapter_recitations/{reciter_id}/{chapter_number}
Single chapter audio. Query: `segments` (boolean) for word-level timing.

Chapter audio URLs are full URLs: `https://download.quranicaudio.com/qdc/{reciter}/{style}/{chapter}.mp3`

---

### Translations

#### GET /resources/translations
List all available translations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `language` | string | Filter by language |

#### GET /quran/translations/{translation_id}
Get translation text for verses.

| Parameter | Type | Description |
|-----------|------|-------------|
| `chapter_number` | integer | Filter by chapter |
| `juz_number` | integer | Filter by juz |
| `page_number` | integer | Filter by page |
| `hizb_number` | integer | Filter by hizb |
| `verse_key` | string | Filter by verse key |

### Key Translation IDs
| ID | Name | Language |
|----|------|----------|
| 131 | Dr. Mustafa Khattab, The Clear Quran | English |
| 20 | Sahih International | English |
| 85 | Abdul Haleem | English |
| 57 | Full ayah transliteration | English |

**Warning:** Disable browser auto-translation on Quran translation text. Add `<meta name="google" content="notranslate">` and `translate="no"` on containers. Auto-translating peer-reviewed translations can distort meaning.

---

### Tafsir (Commentary)

#### GET /resources/tafsirs
List all available tafsirs.

#### GET /quran/tafsirs/{tafsir_id}
Get tafsir text.

| Parameter | Type | Description |
|-----------|------|-------------|
| `chapter_number` | integer | Filter by chapter |
| `verse_key` | string | Filter by verse key |

---

### Quran Text Scripts

All endpoints accept `chapter_number`, `juz_number`, `page_number`, `hizb_number`, `verse_key` as filters.

| Endpoint | Script |
|----------|--------|
| `GET /quran/verses/uthmani` | Standard Uthmani |
| `GET /quran/verses/uthmani_simple` | Uthmani without diacritics |
| `GET /quran/verses/imlaei` | Modern Imlaei |
| `GET /quran/verses/uthmani_tajweed` | Uthmani with tajweed HTML markup |
| `GET /quran/verses/code_v1` | QCF V1 glyph codes |
| `GET /quran/verses/code_v2` | QCF V2 glyph codes |
| `GET /quran/verses/indopak` | IndoPak script |

---

### Structural Divisions

| Endpoint | Division | Range |
|----------|----------|-------|
| `GET /juzs` | Juz (30 equal parts) | 1-30 |
| `GET /hizbs` | Hizb (60 half-juz) | 1-60 |
| `GET /rub_el_hizbs` | Rub el hizb (240 quarter-hizb) | 1-240 |
| `GET /rukus` | Ruku (thematic units) | 1-558 |
| `GET /manzils` | Manzil (7-day reading plan) | 1-7 |

**Juz response:**
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

---

### Resources

| Endpoint | Purpose |
|----------|---------|
| `GET /resources/languages` | All available languages |
| `GET /resources/recitations` | All reciters |
| `GET /resources/chapter_reciters` | Chapter-level reciters |
| `GET /resources/translations` | All translations |
| `GET /resources/tafsirs` | All tafsirs |
| `GET /resources/verse_media` | Verse media resources |

---

### Foot Notes

#### GET /foot_notes/{id}
Get a specific footnote by ID (referenced from translation text).

---

## User-Related API v1

Base: `https://apis.quran.foundation/auth/v1/...` (or prelive equivalent)
Requires PKCE OAuth2 with `user` scope.

### Streaks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/streaks` | GET | Get reading streaks |

Query: `type=QURAN&status=ACTIVE|BROKEN&from=ISO8601&to=ISO8601`

### Activity Days
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/activity-days` | GET | Get daily activity data |
| `/auth/v1/activity-days` | POST | Record review session |

GET query: `type=QURAN&from=ISO8601&to=ISO8601`

POST body:
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

### Bookmarks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/bookmarks` | GET | List bookmarks |
| `/auth/v1/bookmarks` | POST | Create bookmark |
| `/auth/v1/bookmarks/{id}` | DELETE | Delete bookmark |

### Reading Sessions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/reading-sessions` | GET | Get reading sessions |
| `/auth/v1/reading-sessions` | POST | Create reading session |

### Goals
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/v1/goals` | GET/POST | List or create goals |
| `/auth/v1/goals/{id}` | GET/PUT/DELETE | Manage specific goal |

### Collections, Notes, Rooms, Posts
See https://api-docs.quran.foundation/docs/category/user-related-apis for full documentation on social and collection features.

---

## Search API v1

Base: `https://apis.quran.foundation` (with search scope)

### GET /search
Search Quran text and translations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `size` | integer | Results per page (default: 20) |
| `page` | integer | Page number |
| `language` | string | Language code |
| `translations` | string | Translation IDs to search in |

---

## Error Responses

All errors follow this structure:
```json
{
  "message": "Error description",
  "type": "error_type",
  "success": false
}
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid request (missing headers, bad params) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (expired token, insufficient scope) |
| 404 | Resource not found |
| 422 | Validation error |
| 429 | Rate limit exceeded |
| 500-504 | Server errors |

---

## CDN URLs

| Domain | Purpose | Example |
|--------|---------|---------|
| `static.qurancdn.com` | Fonts, images | `/fonts/quran/hafs/v2/woff2/p1.woff2` |
| `audio.qurancdn.com` | Recitation audio | `/AbdulBaset/Murattal/mp3/001001.mp3` |
| `audio.qurancdn.com/wbw/` | Word-by-word audio | `001_001_001.mp3` |

---

## AlQuran.cloud API (Alternative — Separate Service)

Used for bulk verse indexing. Simpler, no auth required.

**Base:** `https://api.alquran.cloud/v1`

**Get full Quran text:** `GET /quran/quran-uthmani`

```json
{
  "data": {
    "surahs": [{
      "number": 1,
      "ayahs": [{
        "number": 1,
        "text": "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
        "numberInSurah": 1
      }]
    }]
  }
}
```

---

## JavaScript SDK (@quranjs/api)

```bash
npm install @quranjs/api
```

The official SDK handles token caching, expiry, retry, and header injection automatically. Modules: `audio`, `chapters`, `verses`, `juzs`, `resources`, `search`.

Docs: https://api-docs.quran.foundation/docs/sdk/javascript
