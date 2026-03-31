# Quran.com GitHub Organization (github.com/quran)

30 public repositories. Community Discord: https://discord.gg/SpEeJ5bWEQ

---

## Primary Repos

### quran/quran.com-frontend-next
**The main quran.com website** | Stars: 1800+ | TypeScript

- **Stack:** Next.js 14 (Pages Router), React 18, Redux Toolkit, XState, SCSS Modules, SWR, Radix UI
- **Key dirs:** `src/components/QuranReader/`, `src/pages/`, `src/redux/`, `src/xstate/`, `src/utils/`, `types/`, `data/`
- **Font system:** `useQcfFont` hook dynamically loads FontFace per page, `GlyphWord` component renders QCF glyphs
- **Reading modes:** Translation, Reading (Mushaf), ReadingTranslation
- **Audio:** XState state machine, word-level timestamp sync, word-by-word audio
- **i18n:** 21 languages via next-translate
- **API:** Uses `api.qurancdn.com/api/qdc/` with SWR fetcher, proxied through Next.js API routes
- **Data files:** `data/` contains static JSON for chapters, juz/hizb/page mappings, quranic calendar

### quran/qf-api-docs
**API documentation portal** | Docusaurus + OpenAPI specs
- Live at: https://api-docs.quran.foundation
- Covers: Content APIs, OAuth2 APIs, Search APIs, User APIs, SDK docs
- OpenAPI specs in `openAPI/` directory

### quran/api-js (@quranjs/api)
**Official JavaScript SDK** | TypeScript monorepo
- `npm install @quranjs/api`
- Modules: `audio`, `chapters`, `verses`, `juzs`, `resources`, `search`
- Works in Node.js and browser
- Docs: https://api-docs.quran.foundation/docs/sdk/javascript

---

## Font & Media Repos

### quran/quran.com-fonts
**Font file server** | Docker
- Serves QCF and other fonts at `/fonts/` path
- Font dirs: `bismillah`, `quran-common`, `surah_names`, `ttf`, `embed_ttf`
- These are the King Fahd Complex font files

### quran/quran.com-images
**Quran page image generator** | Perl | Stars: 470
- Generates page images from madani fonts
- Outputs glyph bounding box database (page, line, sura, ayah, position, min/max x/y)
- Used for word/verse highlighting in web and mobile apps
- Copyright: King Fahd Quran Complex

### quran/audio.quran.com
**QuranicAudio website** | SvelteKit
- Audio player, reciter browsing
- Supports Opus and MP3 streaming
- Audio URL handling utilities

---

## Data & AI Repos

### quran/quran-tajweed
**Tajweed annotation data** | Python | CC BY 4.0
- Output: `output/tajweed.hafs.uthmani-pause-sajdah.json`
- Schema: `[{surah, ayah, annotations: [{rule, start, end}]}]`
- Rules: ghunnah, idghaam variants, ikhfa, iqlab, madd variants, qalqalah, hamzat_wasl, lam_shamsiyyah, silent
- Start/end are Unicode codepoint offsets into Tanzil.net Uthmani text

### quran/mcp.quran.ai
**MCP server for AI** | New repo
- Tools: fetch_quran, fetch_translation, fetch_tafsir, search_*, fetch_word_morphology, show_mushaf, list_editions
- Default editions: `ar-simple-clean` (Arabic), `en-abdel-haleem` (English)
- Ayah format: `"2:255"`, `"2:255-257"`, `"2:255, 3:33"`
- Word morphology: root, lemma, stem, POS, grammar, morpheme segments
- Grounding rules: never quote from memory, always fetch canonical text

### quran/ayah-detection
**Verse detection in page images** | Python, OpenCV | Stars: 108
- Template matching for ayah markers
- Line detection
- Outputs SQLite database for mobile apps

---

## Mobile Apps

### quran/quran_android
**Official Android app** | Kotlin | Stars: 2300+
- Madani page images with highlighting
- Dagger2, RxJava 2, OkHttp, Moshi
- Multiple qira'at image sets
- GPL 3 license

### quran/quran-ios (QuranEngine)
**iOS app library** | Swift | Stars: 537
- Modular Swift Package (Core, Model, Data, Domain, UI, Features)
- SQLite + CoreData, NoorUI design system
- Apache-2.0 license

---

## Legacy / Other Repos

| Repo | Stars | Purpose |
|------|-------|---------|
| `quran.com-frontend` | 1032 | Legacy JS frontend |
| `quran.com-frontend-v2` | 483 | Legacy Ruby v2 frontend |
| `one.quran.com` | 39 | Legacy Ruby app |
| `waqt.org` | 108 | Prayer times (PHP) |
| `common-components` | 41 | Shared JS components |
| `quranicaudio-app` | 85 | QuranicAudio mobile app |
| `quran-core` | 12 | Ruby core library |
| `quran-developers` | 7 | Developer resources |
| `next-open-graph` | 6 | OG image generator |
| `mobile-sync` | 1 | Cross-platform sync (Kotlin) |
| `quran-oauth2-client-example` | 3 | OAuth2 example |
| `oauth2-react-native-client-example` | 3 | RN OAuth2 example |
| `tajweed` | 73 | Tajweed highlighting (Java, experimental) |
| `beautifulprayer` | 13 | Prayer app |
| `quran.ai` | 1 | Landing page |

---

## CDN Infrastructure

| Domain | Purpose |
|--------|---------|
| `api.qurancdn.com/api/qdc/` | Production content API |
| `staging.quran.com/api/qdc/` | Staging API |
| `static.qurancdn.com` | Static assets (fonts, images) |
| `audio.qurancdn.com` | Audio files |
| `audio.qurancdn.com/wbw/{ch}_{v}_{w}.mp3` | Word-by-word audio |
