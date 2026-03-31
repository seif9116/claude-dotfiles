# Hifz Progress Tracking: Architecture & API Plan

## Current State of the Codebase

Your project already has strong foundations to build on:

1. **OAuth2 PKCE auth with Quran Foundation** (`web/src/lib/auth.ts`) -- fully implemented with login, callback, token refresh, and logout. The OAuth scopes already request `user collection` in addition to `openid offline_access`.

2. **Quran Foundation User API client** (`web/src/lib/quran-user-api.ts`) -- already wired up with authenticated requests to `https://apis.quran.foundation`. Currently implements streaks, activity days, and bookmarks.

3. **Local IndexedDB store** (`web/src/lib/store.ts`) -- stores `AyahCard` objects with status tracking (`new | learning | review | memorized`), review sessions, daily stats, and memorization sets.

4. **FSRS engine** (`web/src/lib/fsrs-engine.ts`) -- cards transition to `memorized` status when `stability > 20 && grade >= Good`. This is your existing per-ayah memorization signal.

5. **Existing progress page** (`web/src/app/progress/page.tsx`) -- already groups cards by surah and shows memorized/total counts per surah.

---

## Architecture for Surah-Level Hifz Tracking

### Data Model

You need a concept of "this surah is memorized" that is distinct from "every ayah in this surah has reached `memorized` status in FSRS." A user should be able to manually declare a surah as memorized (they might have memorized it years ago and just want to track it), or the app can auto-suggest the status when all ayahs reach the `memorized` FSRS state.

Add a new type in `web/src/lib/types.ts`:

```typescript
export type HifzStatus = 'not_started' | 'in_progress' | 'memorized';

export interface SurahHifzRecord {
  surah_number: number;
  status: HifzStatus;
  memorized_at?: number;       // timestamp when marked memorized
  last_reviewed_at?: number;   // timestamp of most recent review session
  ayahs_memorized: number;     // count of ayahs at 'memorized' FSRS status
  ayahs_total: number;         // total ayahs in surah (from Quran API)
  source: 'manual' | 'auto';   // how it was marked
}
```

### Local Storage

Add a new object store to your IndexedDB schema in `web/src/lib/store.ts`. This requires bumping `DB_VERSION` from 1 to 2:

```typescript
surah_hifz: {
  key: number;  // surah_number (1-114)
  value: SurahHifzRecord;
  indexes: {
    'by-status': string;
  };
};
```

Add store operations:

```typescript
export async function getSurahHifz(surahNumber: number): Promise<SurahHifzRecord | undefined>;
export async function getAllSurahHifz(): Promise<SurahHifzRecord[]>;
export async function saveSurahHifz(record: SurahHifzRecord): Promise<void>;
export async function getHifzProgress(): Promise<{ memorized: number; inProgress: number; total: number }>;
```

### Auto-Detection Logic

After each review session grades a card (in `web/src/app/review/page.tsx`, inside `handleGrade`), check if all ayahs in that surah are now `memorized`:

```typescript
// After saveCard(updated) in handleGrade:
const surahCards = await getCardsBySurah(updated.surah_number);
const surahInfo = surahs.find(s => s.id === updated.surah_number);
const allMemorized = surahCards.length === surahInfo?.verses_count
  && surahCards.every(c => c.status === 'memorized');

if (allMemorized) {
  await saveSurahHifz({
    surah_number: updated.surah_number,
    status: 'memorized',
    memorized_at: Date.now(),
    last_reviewed_at: Date.now(),
    ayahs_memorized: surahCards.length,
    ayahs_total: surahInfo.verses_count,
    source: 'auto',
  });
}
```

### Manual Marking

On the memorize page or a new hifz dashboard, let users toggle a surah as "memorized" without needing to review every ayah through FSRS. This is important for users who have prior memorization.

---

## Syncing with Quran.com Account

### Available APIs (Already in Your OAuth Scopes)

Your existing OAuth flow requests the `collection` scope, which gives access to the **Collections API** -- this is the right mechanism for persisting hifz data to Quran.com.

#### Collections API (Quran Foundation User API)

These endpoints live under `https://apis.quran.foundation/auth/v1/` and use the same `x-auth-token` + `x-client-id` auth pattern you already use for streaks/bookmarks:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/v1/collections` | GET | List user's collections |
| `/auth/v1/collections` | POST | Create a new collection |
| `/auth/v1/collections/:id` | GET | Get collection details |
| `/auth/v1/collections/:id` | PUT | Update collection |
| `/auth/v1/collections/:id` | DELETE | Delete collection |
| `/auth/v1/collections/:id/items` | POST | Add items (verse keys) to collection |
| `/auth/v1/collections/:id/items/:itemId` | DELETE | Remove item from collection |

#### Sync Strategy

Create a dedicated collection named something like `"Murajaa Hifz Tracker"` to store memorized surahs. Each item in the collection represents a memorized surah, stored as verse ranges.

Add to `web/src/lib/quran-user-api.ts`:

```typescript
// ============================================================
// Collections API (Hifz Tracking)
// ============================================================

export interface QFCollection {
  id: string;
  name: string;
  description?: string;
  items?: QFCollectionItem[];
}

export interface QFCollectionItem {
  id: string;
  key: string;   // verse key or range
  type: string;
  createdAt: string;
}

const HIFZ_COLLECTION_NAME = 'Murajaa Hifz Tracker';

export async function getCollections(): Promise<QFCollection[] | null> {
  const data = await apiRequest('/auth/v1/collections');
  return data?.data || null;
}

export async function createCollection(name: string, description?: string): Promise<QFCollection | null> {
  const data = await apiRequest('/auth/v1/collections', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return data?.data || null;
}

export async function getCollection(id: string): Promise<QFCollection | null> {
  const data = await apiRequest(`/auth/v1/collections/${id}`);
  return data?.data || null;
}

export async function addCollectionItem(
  collectionId: string,
  key: string,
  type: string = 'surah'
): Promise<boolean> {
  const data = await apiRequest(`/auth/v1/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify({ key, type }),
  });
  return data?.success === true;
}

export async function removeCollectionItem(
  collectionId: string,
  itemId: string
): Promise<boolean> {
  const data = await apiRequest(`/auth/v1/collections/${collectionId}/items/${itemId}`, {
    method: 'DELETE',
  });
  return data?.success === true;
}
```

#### Hifz Sync Helper

```typescript
/**
 * Sync local hifz records to QF Collections API.
 * Creates a "Murajaa Hifz Tracker" collection if one doesn't exist,
 * then reconciles local memorized surahs with the collection items.
 */
export async function syncHifzProgress(
  localRecords: SurahHifzRecord[]
): Promise<void> {
  if (!isAuthenticated()) return;

  // Find or create the hifz collection
  const collections = await getCollections();
  let hifzCollection = collections?.find(c => c.name === HIFZ_COLLECTION_NAME);

  if (!hifzCollection) {
    hifzCollection = await createCollection(
      HIFZ_COLLECTION_NAME,
      'Surahs memorized, tracked by Murajaa app'
    );
    if (!hifzCollection) return;
  }

  // Get full collection with items
  const full = await getCollection(hifzCollection.id);
  const remoteItems = full?.items || [];
  const remoteKeys = new Set(remoteItems.map(i => i.key));

  // Sync memorized surahs: add locally memorized ones not yet remote
  const memorized = localRecords.filter(r => r.status === 'memorized');
  for (const record of memorized) {
    const key = `${record.surah_number}:1-${record.ayahs_total}`;
    if (!remoteKeys.has(key)) {
      await addCollectionItem(hifzCollection.id, key);
    }
  }

  // Import remote items not in local store (from another device)
  // Return these so the caller can merge into IndexedDB
}
```

### Alternative: Bookmarks API for Lightweight Tracking

If the Collections API turns out to be unavailable or overly complex for the hackathon timeline, you can repurpose the **Bookmarks API** you already have implemented. Create bookmarks with type `'page'` using the surah number as the key, with a naming convention that indicates hifz status. This is hacky but functional for a hackathon demo.

### Activity Days API (Already Implemented)

You already have `syncReviewSession()` in `quran-user-api.ts`. Continue using this to record daily review activity. When a surah is marked memorized, you can record a special activity entry to timestamp the achievement.

---

## Overall Hifz Progress Dashboard

### New UI: Hifz Overview

Either enhance the existing `/progress` page or create a new route. The dashboard should show:

1. **Overall progress ring**: X/114 surahs memorized, with juz breakdown (X/30 juz)
2. **Surah grid**: All 114 surahs in a visual grid, color-coded by status (not started / in progress / memorized)
3. **Quick-mark buttons**: Tap a surah to toggle its memorized status
4. **Sync indicator**: Show whether data is synced with Quran.com (reuse your existing `AuthStatus` component pattern)

### Progress Calculation

```typescript
export function calculateHifzProgress(records: SurahHifzRecord[], surahs: Surah[]) {
  const memorizedSurahs = records.filter(r => r.status === 'memorized');
  const totalAyahsMemorized = memorizedSurahs.reduce((sum, r) => sum + r.ayahs_total, 0);
  const totalAyahs = 6236; // total ayahs in Quran

  // Juz calculation requires mapping surahs to juz
  // A juz is memorized if all its constituent surahs/portions are memorized

  return {
    surahsMemorized: memorizedSurahs.length,
    surahsTotal: 114,
    ayahsMemorized: totalAyahsMemorized,
    ayahsTotal: totalAyahs,
    percentage: (totalAyahsMemorized / totalAyahs) * 100,
  };
}
```

---

## Implementation Plan (Hackathon Priority Order)

### Phase 1: Local-Only Hifz Tracking (Core Feature)

1. Add `SurahHifzRecord` type to `types.ts`
2. Bump IndexedDB version, add `surah_hifz` store to `store.ts`
3. Add manual "Mark as Memorized" toggle to the memorize page (surah list view)
4. Add auto-detection in review flow when all ayahs in a surah reach memorized
5. Enhance progress page with surah grid showing hifz status and overall progress percentage

**Estimated effort**: 2-3 hours

### Phase 2: Quran.com Sync (Differentiator)

1. Add Collections API functions to `quran-user-api.ts`
2. Implement `syncHifzProgress()` -- push local memorized surahs to QF collection
3. Implement import from remote -- pull memorized surahs from QF collection on login
4. Call sync after each status change and on app load when authenticated

**Estimated effort**: 2-3 hours

### Phase 3: Polish (If Time Permits)

1. Visual surah grid with color coding (114 cells, responsive layout)
2. Juz-level progress tracking
3. Hifz statistics over time (when was each surah memorized)
4. Export/share progress image

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `web/src/lib/types.ts` | Add `HifzStatus`, `SurahHifzRecord` |
| `web/src/lib/store.ts` | Bump DB version, add `surah_hifz` store + CRUD operations |
| `web/src/lib/quran-user-api.ts` | Add Collections API client + `syncHifzProgress()` |
| `web/src/app/progress/page.tsx` | Add hifz overview section with surah grid |
| `web/src/app/memorize/page.tsx` | Add "Mark as Memorized" toggle per surah in list view |
| `web/src/app/review/page.tsx` | Add auto-detection of surah completion after grading |
| `web/src/components/dashboard/stats-cards.tsx` | Add hifz progress stat card |
| `web/src/components/auth/auth-status.tsx` | Trigger hifz sync on login |

## API Summary

| API | Base URL | Auth | Already Implemented? | Use Case |
|-----|----------|------|---------------------|----------|
| Quran.com Content API v4 | `https://api.quran.com/api/v4` | None | Yes | Surah metadata, ayah content |
| QF OAuth2 | `https://oauth2.quran.foundation` | PKCE | Yes | User authentication |
| QF User API - Streaks | `https://apis.quran.foundation/auth/v1/streaks` | Token | Yes | Reading streaks |
| QF User API - Activity Days | `https://apis.quran.foundation/auth/v1/activity-days` | Token | Yes | Daily review logging |
| QF User API - Bookmarks | `https://apis.quran.foundation/auth/v1/bookmarks` | Token | Yes | Verse bookmarks |
| QF User API - Collections | `https://apis.quran.foundation/auth/v1/collections` | Token | **No -- add this** | Hifz progress persistence |

The Collections API is the key addition. Everything else is either already built or is client-side logic using your existing IndexedDB store and FSRS engine.
