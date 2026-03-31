# PostgREST Query Patterns — Deep Reference

This file covers advanced query patterns for supabase-js, which is a TypeScript client over PostgREST.

## Table of Contents
1. [Select and filtering basics](#select-and-filtering-basics)
2. [Join patterns](#join-patterns)
3. [Disambiguating foreign keys](#disambiguating-foreign-keys)
4. [Filtering on joined tables](#filtering-on-joined-tables)
5. [Aggregation and counting](#aggregation-and-counting)
6. [Insert, update, upsert, delete](#mutations)
7. [Handling PostgREST response shapes](#response-shapes)
8. [Common errors and fixes](#common-errors)

---

## Select and filtering basics

### Basic select with filters
```typescript
const { data, error } = await supabase
  .from("programs")
  .select("id, title, is_active")
  .eq("mosque_id", mosqueId)
  .eq("is_active", true)
  .order("created_at", { ascending: false })
```

### Available filter operators
| Method | SQL equivalent | Example |
|--------|---------------|---------|
| `.eq("col", val)` | `= val` | `.eq("status", "active")` |
| `.neq("col", val)` | `!= val` | `.neq("role", "student")` |
| `.gt("col", val)` | `> val` | `.gt("age", 18)` |
| `.gte("col", val)` | `>= val` | `.gte("price", 0)` |
| `.lt("col", val)` | `< val` | `.lt("age", 65)` |
| `.lte("col", val)` | `<= val` | `.lte("count", 100)` |
| `.like("col", pat)` | `LIKE pat` | `.like("name", "%john%")` |
| `.ilike("col", pat)` | `ILIKE pat` | `.ilike("name", "%john%")` |
| `.is("col", val)` | `IS val` | `.is("deleted_at", null)` |
| `.in("col", arr)` | `IN (...)` | `.in("id", [1, 2, 3])` |
| `.contains("col", val)` | `@> val` | `.contains("tags", ["math"])` |
| `.containedBy("col", val)` | `<@ val` | `.containedBy("tags", ["math","sci"])` |
| `.overlaps("col", val)` | `&& val` | `.overlaps("tags", ["math"])` |
| `.textSearch("col", q)` | `to_tsquery` | `.textSearch("name", "john")` |
| `.not("col", "op", val)` | `NOT` | `.not("status", "eq", "deleted")` |
| `.or("filter1,filter2")` | `OR` | `.or("role.eq.admin,role.eq.teacher")` |
| `.filter("col", "op", val)` | raw operator | `.filter("id", "in", "(1,2,3)")` |

### OR conditions
```typescript
// Simple OR
const { data } = await supabase
  .from("profiles")
  .select("*")
  .or("role.eq.admin,role.eq.teacher")

// OR across different columns
const { data } = await supabase
  .from("profiles")
  .select("*")
  .or("full_name.ilike.%john%,email.ilike.%john%")
```

### Filtering JSON columns
```typescript
// Filter by a value inside a JSON column
const { data } = await supabase
  .from("programs")
  .select("*")
  .eq("schedule->0->day", "Monday")

// Use arrow notation for nested JSON paths
// -> returns JSON, ->> returns text
```

### Pagination
```typescript
const { data, count } = await supabase
  .from("programs")
  .select("*", { count: "exact" })
  .range(0, 9) // first 10 rows (0-indexed, inclusive)
  .order("created_at", { ascending: false })
```

### Limiting results
```typescript
const { data } = await supabase
  .from("programs")
  .select("*")
  .limit(5)
```

---

## Join patterns

PostgREST detects foreign key relationships automatically. You embed related tables by nesting their name in the select string.

### One-to-many (parent → children)
```typescript
// Get a mosque with all its programs
const { data } = await supabase
  .from("mosques")
  .select(`
    id, name, slug,
    programs (id, title, is_active)
  `)
  .eq("slug", mosqueSlug)
  .single()
// Result: { id, name, slug, programs: [{ id, title, is_active }, ...] }
```

### Many-to-one (child → parent)
```typescript
// Get enrollments with their program info
const { data } = await supabase
  .from("enrollments")
  .select(`
    id, created_at,
    programs (id, title, mosque_id)
  `)
  .eq("student_profile_id", studentId)
// Result: [{ id, created_at, programs: { id, title, mosque_id } }]
// Note: many-to-one returns an object, not an array
```

### Many-to-many (through a join table)
PostgREST auto-detects many-to-many through junction tables:
```typescript
// If users and teams are linked through a members junction table
const { data } = await supabase
  .from("teams")
  .select(`id, team_name, users (id, name)`)
// PostgREST skips the junction table in the response
```

### Aliasing joined tables
Use `alias:table_name` to rename the joined data in the response:
```typescript
const { data } = await supabase
  .from("programs")
  .select(`
    id, title,
    teacher:profiles!programs_teacher_profile_id_fkey (
      id, full_name, avatar_url
    )
  `)
// Result: { id, title, teacher: { id, full_name, avatar_url } }
```

---

## Disambiguating foreign keys

When a table has multiple foreign keys to the same target table, PostgREST cannot auto-detect which relationship to use. You must specify the FK constraint name with `!`:

```typescript
// shifts table has scan_id_start and scan_id_end, both referencing scans
const { data } = await supabase
  .from("shifts")
  .select(`
    *,
    start_scan:scans!scan_id_start (id, badge_scan_time),
    end_scan:scans!scan_id_end (id, badge_scan_time)
  `)
```

**How to find the constraint name:** Run this SQL:
```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND conrelid = 'your_table'::regclass;
```

Or check the generated `types/database.ts` — the `Relationships` array on each table lists the FK constraint names.

---

## Filtering on joined tables

### Basic filter on joined table
```typescript
// Get programs where the teacher's name matches
const { data } = await supabase
  .from("programs")
  .select(`*, teacher:profiles!programs_teacher_profile_id_fkey(*)`)
  .eq("profiles.full_name", "John")
```

### Using `!inner` for INNER JOIN filtering
Without `!inner`, filtering on a joined table only filters the nested data, but parent rows still appear. With `!inner`, parent rows without matching children are excluded:

```typescript
// Without !inner: returns ALL programs, some with empty enrollments array
const { data } = await supabase
  .from("programs")
  .select(`*, enrollments(*)`)
  .eq("enrollments.student_profile_id", studentId)

// With !inner: returns ONLY programs where this student is enrolled
const { data } = await supabase
  .from("programs")
  .select(`*, enrollments!inner(*)`)
  .eq("enrollments.student_profile_id", studentId)
```

### Multi-level filtering limitation
Filtering through multiple levels of joins (e.g., `table_a.table_b.column`) is unreliable in PostgREST. When you need this:

```typescript
// DON'T: try to filter through 2+ join levels
const { data } = await supabase
  .from("enrollments")
  .select("*, programs(*)")
  .eq("programs.mosque_id", mosqueId) // this may not work reliably

// DO: fetch and filter in JavaScript
const { data: enrollments } = await supabase
  .from("enrollments")
  .select("*, programs(id, title, mosque_id)")
  .eq("student_profile_id", studentId)

const filtered = enrollments?.filter(e => e.programs?.mosque_id === mosqueId)
```

---

## Aggregation and counting

### Count rows without fetching data
```typescript
const { count, error } = await supabase
  .from("enrollments")
  .select("*", { count: "exact", head: true })
  .eq("program_id", programId)
// count is a number, data is null (head: true skips data)
```

### Count options
- `exact`: exact row count (slower on large tables)
- `planned`: uses Postgres planner estimate (fast, approximate)
- `estimated`: exact for small result sets, planned for large

---

## Mutations

### Insert
```typescript
// Single insert
const { data, error } = await supabase
  .from("enrollments")
  .insert({ program_id: programId, student_profile_id: userId })
  .select() // add .select() if you want the inserted row back

// Bulk insert
const { error } = await supabase
  .from("enrollments")
  .insert([
    { program_id: id1, student_profile_id: userId },
    { program_id: id2, student_profile_id: userId },
  ])
```

### Update
```typescript
const { error } = await supabase
  .from("profiles")
  .update({ full_name: "New Name" })
  .eq("id", userId)
// IMPORTANT: Without .eq() or another filter, this updates ALL rows!
```

### Upsert
```typescript
// Insert or update based on conflict columns
const { error } = await supabase
  .from("mosque_memberships")
  .upsert(
    { mosque_id, profile_id, role: "student" },
    { onConflict: "mosque_id,profile_id" }
  )

// Skip duplicates without updating (ignoreDuplicates)
const { error } = await supabase
  .from("mosque_memberships")
  .upsert(
    { mosque_id, profile_id, role: "student" },
    { onConflict: "mosque_id,profile_id", ignoreDuplicates: true }
  )
```

### Delete
```typescript
const { error } = await supabase
  .from("enrollments")
  .delete()
  .eq("program_id", programId)
  .eq("student_profile_id", userId)
// IMPORTANT: Without filters, this deletes ALL rows!
```

---

## Response shapes

### The `data` shape depends on the query

| Query ending | `data` type | Notes |
|-------------|------------|-------|
| `.select()` | `Row[]` | Always an array |
| `.select().single()` | `Row` | Errors if 0 or 2+ rows (PGRST116) |
| `.select().maybeSingle()` | `Row \| null` | null if 0 rows, errors if 2+ |
| `.insert({}).select()` | `Row[]` | Returns inserted rows |
| `.update({}).select()` | `Row[]` | Returns updated rows |
| `.delete().select()` | `Row[]` | Returns deleted rows |
| Without `.select()` on mutations | `null` | No data returned, only error status |

### Nested relation cardinality

PostgREST returns different shapes based on the relationship:
- **One-to-many** (parent → children): nested data is an **array**
- **Many-to-one** (child → parent): nested data is an **object** (or null)
- **One-to-one**: nested data is an **object** (or null)

However, sometimes PostgREST gets cardinality wrong and returns an array where you expect an object. Defensive handling:
```typescript
const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
```

---

## Common errors

| Error code | Meaning | Fix |
|-----------|---------|-----|
| PGRST116 | `.single()` returned 0 or 2+ rows | Use `.maybeSingle()` or add stricter filters |
| PGRST200 | Stale FK / relationship not found | Run `NOTIFY pgrst, 'reload schema'` or wait for auto-reload |
| PGRST201 | Ambiguous relationship | Specify FK constraint: `table!fk_constraint_name(...)` |
| 42501 | RLS permission denied | Check policy targets correct role and conditions |
| 23505 | Unique constraint violation | Handle gracefully or use `.upsert()` with `onConflict` |
| 23503 | Foreign key violation | Referenced row doesn't exist — check parent record exists |
| PGRST108 | Filter on unembedded resource | Add the table to `.select()` before filtering on it |

### Debugging empty results
When `.select()` returns `[]` with no error:
1. **Check RLS** — the policy might not grant access. Test with service client to confirm data exists.
2. **Check filters** — a typo in `.eq()` column name won't error, just returns empty.
3. **Check the role** — are you using anon key vs authenticated session?
4. **Check `!inner`** — if using inner joins, the joined table might have no matches.
