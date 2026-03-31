# Hifz Progress Tracking: Architecture & API Guide

## What You Already Have

Your codebase already has strong foundations for this feature:

1. **OAuth2 PKCE auth** (`web/src/lib/auth.ts`) -- full login/callback/token-refresh flow against `oauth2.quran.foundation`
2. **Quran Foundation User API client** (`web/src/lib/quran-user-api.ts`) -- streaks, activity days, bookmarks, with `syncReviewSession()` helper
3. **IndexedDB store** (`web/src/lib/store.ts`) -- `cards` table with `AyahCard` objects that already track per-verse `status: 'new' | 'learning' | 'review' | 'memorized'`
4. **FSRS engine** (`web/src/lib/fsrs-engine.ts`) -- already computes `status: 'memorized'` when `stability > 20 && grade >= Good`
5. **Auth UI** (`web/src/components/auth/auth-status.tsx`) -- "Sync with Quran.com" button in the sidebar

The missing piece is a **surah-level "mark as memorized"** concept that aggregates verse-level FSRS status into a high-level hifz tracker, and syncs that to the Quran Foundation backend for cross-device persistence.

---

## APIs You Need

### 1. Content API (already integrated) -- No changes needed

`GET /chapters` at `https://api.quran.com/api/v4/chapters` gives you the full list of 114 surahs with `verses_count`. You already call this via `getSurahs()` in `web/src/lib/quran-api.ts`.

### 2. Quran Foundation User API -- Goals Endpoint (NEW)

The Goals API is the right fit for tracking hifz progress. It is part of the authenticated User API at `https://apis.quran.foundation`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/v1/goals` | GET | List user's goals (e.g., "memorize Surah Al-Baqarah") |
| `/auth/v1/goals` | POST | Create a new memorization goal |
| `/auth/v1/goals/{id}` | GET | Get specific goal details |
| `/auth/v1/goals/{id}` | PUT | Update goal progress |
| `/auth/v1/goals/{id}` | DELETE | Remove a goal |

These endpoints require the same `x-auth-token` + `x-client-id` headers your `quran-user-api.ts` already sends.

**Suggested goal payload for "memorize surah X":**
```json
{
  "type": "QURAN",
  "target": "SURAH",
  "targetValue": 2,
  "progress": 0.75,
  "status": "IN_PROGRESS",
  "metadata": {
    "memorizedVerses": 214,
    "totalVerses": 286
  }
}
```

### 3. Activity Days API (already integrated)

You already call `POST /auth/v1/activity-days` via `syncReviewSession()`. Each review session you sync automatically contributes to the user's reading streak and activity heatmap on Quran.com. No changes needed here -- it already fires after reviews.

### 4. Bookmarks API (already integrated)

You could optionally use bookmarks to mark "last memorized position" per surah, giving users a quick-resume point. Already wired up in `quran-user-api.ts`.

---

## Architecture

### Data Model

Add a new type and extend the IndexedDB schema:

```typescript
// In web/src/lib/types.ts

export interface SurahHifzStatus {
  surah_number: number;
  total_verses: number;
  memorized_verses: number;     // count of AyahCards with status === 'memorized'
  is_fully_memorized: boolean;  // memorized_verses === total_verses
  marked_memorized_at?: number; // timestamp when user explicitly marked it
  last_reviewed_at?: number;    // timestamp of most recent review for any verse
  goal_id?: string;             // Quran Foundation goal ID (for sync)
}
```

This is a **computed view** -- you derive it from the existing `AyahCard` data in IndexedDB, not a separate store. The `goal_id` field links to the remote Quran Foundation goal for sync.

### Computation Layer

Add a function to `web/src/lib/fsrs-engine.ts`:

```typescript
export function getSurahHifzStatus(
  cards: AyahCard[],
  surahs: Surah[]
): SurahHifzStatus[] {
  const result: SurahHifzStatus[] = [];

  for (const surah of surahs) {
    const surahCards = cards.filter(c => c.surah_number === surah.id);
    const memorizedCount = surahCards.filter(c => c.status === 'memorized').length;
    const lastReview = surahCards
      .filter(c => c.last_review)
      .sort((a, b) => (b.last_review || 0) - (a.last_review || 0))[0];

    // Only include surahs the user has started tracking
    if (surahCards.length > 0) {
      result.push({
        surah_number: surah.id,
        total_verses: surah.verses_count,
        memorized_verses: memorizedCount,
        is_fully_memorized: memorizedCount === surah.verses_count,
        last_reviewed_at: lastReview?.last_review,
      });
    }
  }

  return result;
}
```

### "Mark Surah as Memorized" Action

When a user explicitly marks a surah as memorized (as opposed to it being computed from FSRS), you need to:

1. Create `AyahCard` entries for all verses in the surah (if they don't exist)
2. Set each card's `status` to `'memorized'` with a high FSRS stability value
3. Sync to Quran Foundation via the Goals API

```typescript
// In web/src/lib/store.ts or a new web/src/lib/hifz.ts

export async function markSurahMemorized(surahNumber: number, versesCount: number): Promise<void> {
  const existingCards = await getCardsBySurah(surahNumber);
  const existingKeys = new Set(existingCards.map(c => c.verse_key));

  const cardsToSave: AyahCard[] = [];

  for (let ayah = 1; ayah <= versesCount; ayah++) {
    const verseKey = `${surahNumber}:${ayah}`;
    const existing = existingCards.find(c => c.verse_key === verseKey);

    if (existing && existing.status === 'memorized') {
      continue; // already memorized, skip
    }

    if (existing) {
      // Upgrade existing card to memorized
      cardsToSave.push({
        ...existing,
        status: 'memorized',
        // Keep FSRS card data as-is -- stability will be validated on next review
      });
    } else {
      // Create new card pre-set to memorized
      const card = createNewAyahCard(surahNumber, ayah);
      card.status = 'memorized';
      cardsToSave.push(card);
    }
  }

  await saveCards(cardsToSave);
}

export async function unmarkSurahMemorized(surahNumber: number): Promise<void> {
  const cards = await getCardsBySurah(surahNumber);
  const cardsToSave = cards.map(c => ({
    ...c,
    status: 'new' as const, // reset to new so FSRS can schedule them
  }));
  await saveCards(cardsToSave);
}
```

### Sync Layer

Extend `web/src/lib/quran-user-api.ts` with Goals API support:

```typescript
// ============================================================
// Goals API (Hifz Progress Tracking)
// ============================================================

export interface QFGoal {
  id: string;
  type: string;
  target: string;
  targetValue: number;
  progress: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getGoals(): Promise<QFGoal[] | null> {
  const data = await apiRequest('/auth/v1/goals');
  return data?.data || null;
}

export async function createGoal(params: {
  type: string;
  target: string;
  targetValue: number;
  progress?: number;
}): Promise<QFGoal | null> {
  const data = await apiRequest('/auth/v1/goals', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data?.data || null;
}

export async function updateGoalProgress(
  goalId: string,
  progress: number
): Promise<boolean> {
  const data = await apiRequest(`/auth/v1/goals/${goalId}`, {
    method: 'PUT',
    body: JSON.stringify({ progress }),
  });
  return data?.success === true;
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const data = await apiRequest(`/auth/v1/goals/${goalId}`, {
    method: 'DELETE',
  });
  return data?.success === true;
}

// ============================================================
// Hifz Sync Helper
// ============================================================

/**
 * Sync local hifz progress to Quran Foundation Goals API.
 * Call after marking/unmarking a surah or after review sessions.
 */
export async function syncHifzProgress(
  surahNumber: number,
  memorizedVerses: number,
  totalVerses: number,
  goalId?: string
): Promise<string | null> {
  if (!isAuthenticated()) return null;

  const progress = totalVerses > 0 ? memorizedVerses / totalVerses : 0;

  if (goalId) {
    // Update existing goal
    await updateGoalProgress(goalId, progress);
    return goalId;
  } else {
    // Create new goal
    const goal = await createGoal({
      type: 'QURAN',
      target: 'SURAH',
      targetValue: surahNumber,
      progress,
    });
    return goal?.id || null;
  }
}
```

### Bidirectional Sync Strategy

Since the hackathon deadline is April 20, keep sync simple:

```
Local IndexedDB (source of truth for FSRS state)
         |
         v
    [On review complete] --> POST /auth/v1/activity-days  (already done)
    [On mark memorized]  --> POST/PUT /auth/v1/goals
    [On app load]        --> GET /auth/v1/goals --> merge into local state
```

**On app load (pull from cloud):**
1. Fetch goals from Quran Foundation
2. For each goal where `progress === 1.0` (fully memorized), check if local state matches
3. If a surah is marked memorized remotely but not locally, call `markSurahMemorized()`
4. Store the `goal_id` mapping in the IndexedDB `settings` store

**On mark memorized (push to cloud):**
1. Update local IndexedDB cards
2. Call `syncHifzProgress()` to create/update the remote goal
3. Store returned `goal_id` for future updates

**On review complete (incremental push):**
1. After each review session, recompute surah progress
2. If the surah has an associated `goal_id`, update the remote goal progress
3. Activity days sync already happens via `syncReviewSession()`

---

## UI Components

### 1. Hifz Dashboard Widget

Add to the main dashboard (`web/src/app/page.tsx`):

```
+------------------------------------------+
|  Hifz Progress                    12/114 |
|  [=======>                        ] 10%  |
|                                          |
|  Recently memorized:                     |
|  - Al-Fatihah (7/7)          [checkmark] |
|  - Al-Ikhlas (4/4)           [checkmark] |
|  - Al-Falaq (5/5)            [checkmark] |
|                                          |
|  In progress:                            |
|  - Al-Baqarah (142/286)      [bar: 49%] |
+------------------------------------------+
```

### 2. Surah List Enhancement

Modify the Memorize page (`web/src/app/memorize/page.tsx`) to add a "Mark as Memorized" toggle per surah:

- Show a checkmark icon on surahs where all verses have `status === 'memorized'`
- Add a long-press or dedicated button: "I already know this surah"
- This creates all verse cards with `status: 'memorized'` and syncs to Goals API

### 3. Progress Page Enhancement

The existing Progress page (`web/src/app/progress/page.tsx`) already shows surah-level progress bars. Enhance it with:

- Overall hifz fraction: `X / 6,236 verses memorized`
- Juz-level breakdown (group surahs by juz using the Juz API: `GET /juzs`)
- A visual grid of all 114 surahs color-coded by completion percentage

---

## Data Flow Diagram

```
User marks surah as memorized
    |
    v
markSurahMemorized(surahNum, versesCount)
    |
    +--> Creates/updates AyahCards in IndexedDB (status: 'memorized')
    |
    +--> syncHifzProgress(surahNum, versesCount, versesCount)
              |
              +--> [if authenticated] POST /auth/v1/goals (create)
              |    or PUT /auth/v1/goals/{id} (update progress to 1.0)
              |
              +--> Returns goal_id --> stored in IndexedDB settings

User completes a review session
    |
    v
reviewCard() updates AyahCard status via FSRS
    |
    +--> saveCard() to IndexedDB
    |
    +--> Recompute surahHifzStatus
    |    (some verse may have flipped to 'memorized' or away from it)
    |
    +--> syncHifzProgress(surahNum, newMemorizedCount, totalVerses, goalId)
    |
    +--> syncReviewSession() --> POST /auth/v1/activity-days (already wired)

App loads on new device (user logs in)
    |
    v
AuthStatus component detects login
    |
    +--> GET /auth/v1/goals
    |
    +--> For each goal with progress=1.0:
    |      markSurahMemorized(targetValue, versesCount)
    |
    +--> Store goal_id mappings locally
```

---

## Implementation Priority (Hackathon Timeline)

Given the April 20 deadline, here is the recommended build order:

### Phase 1 (Day 1): Local hifz tracking -- no API calls
1. Add `getSurahHifzStatus()` to `fsrs-engine.ts`
2. Add `markSurahMemorized()` and `unmarkSurahMemorized()` to `store.ts`
3. Add "Mark as Memorized" button to the Memorize page surah list
4. Add hifz summary widget to Dashboard
5. Enhance Progress page with overall hifz stats

### Phase 2 (Day 2): Cloud sync via Goals API
1. Add Goals CRUD functions to `quran-user-api.ts`
2. Add `syncHifzProgress()` helper
3. Wire sync into mark/unmark actions
4. Wire incremental sync into review completion flow
5. Add pull-from-cloud on app load

### Phase 3 (Day 3): Polish
1. Surah grid visualization (114-cell grid, color-coded)
2. Juz-level progress grouping
3. Handle edge cases: partial memorization, conflicting local/remote state
4. Test with prelive credentials (`quran-demo` / `secret`)

---

## Key Files to Modify

| File | Change |
|------|--------|
| `web/src/lib/types.ts` | Add `SurahHifzStatus` interface |
| `web/src/lib/fsrs-engine.ts` | Add `getSurahHifzStatus()` |
| `web/src/lib/store.ts` | Add `markSurahMemorized()`, `unmarkSurahMemorized()`, goal_id settings helpers |
| `web/src/lib/quran-user-api.ts` | Add Goals API functions + `syncHifzProgress()` |
| `web/src/app/memorize/page.tsx` | Add "Mark as Memorized" toggle per surah |
| `web/src/app/page.tsx` | Add hifz progress summary card |
| `web/src/app/progress/page.tsx` | Enhance with overall hifz stats, juz breakdown |
| `web/src/app/review/page.tsx` | After `handleGrade`, recompute + sync surah progress |

---

## Important Notes

1. **The Goals API requires OAuth2 PKCE authentication** -- same flow you already have. The `user` scope in your PKCE request (`scope: 'openid offline_access user collection'`) should cover goals. If not, you may need to add a `goals` scope.

2. **For the hackathon demo, local-only is fine.** The memory file states "No auth for demo -- local storage." Cloud sync is a bonus that shows Quran Foundation API integration, which the hackathon explicitly values.

3. **Don't sync FSRS card state to the cloud.** FSRS parameters are device-local scheduling data. Only sync the high-level "surah X is Y% memorized" status. The Goals API is the right abstraction for this.

4. **Verse count validation:** Always get `verses_count` from the chapters API (`getSurahs()`), never hardcode it. Your `quran-api.ts` already caches this.

5. **Conflict resolution:** If remote says a surah is memorized but local FSRS says individual verses have decayed (stability dropped), trust the FSRS state and update the remote goal progress downward. FSRS is the source of truth for actual memorization quality.

6. **Demo credentials for testing:** Client ID `quran-demo`, Secret `secret` against `apis-prelive.quran.foundation`. Set `NEXT_PUBLIC_QF_USE_PRELIVE=true` in your `.env.local`.
