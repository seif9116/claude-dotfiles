---
name: supabase
description: >-
  Supabase development guide covering PostgREST query patterns, RLS policy writing,
  client setup (server/browser/service), migration workflow, auth flows, edge functions,
  and type generation. Use this skill whenever working with Supabase — writing queries
  with the supabase-js client, creating or debugging RLS policies, writing database
  migrations, setting up auth, creating edge functions, or troubleshooting PostgREST
  errors. Also trigger when you see imports from @supabase/supabase-js, @supabase/ssr,
  tables with RLS, or supabase/ directories. Even for seemingly simple Supabase tasks,
  consult this skill — PostgREST has many subtle behaviors that differ from raw SQL,
  and getting them wrong causes silent data leaks or empty results.
---

# Supabase Development Guide

This skill helps you work correctly with Supabase. Supabase wraps Postgres behind PostgREST (an auto-generated REST API), which has different semantics than raw SQL. Most mistakes come from treating PostgREST like SQL — this guide teaches you the actual patterns.

## When to read reference files

This SKILL.md covers the core mental models and quick-reference patterns. For deeper guidance:

- **Writing or debugging a query?** Read `references/postgrest-queries.md`
- **Writing or debugging RLS policies?** Read `references/rls-patterns.md`
- **Working with migrations, CLI, or types?** Read `references/migration-workflow.md`
- **Setting up auth or edge functions?** Read `references/auth-and-edge.md`

## Core mental model

Supabase is not an ORM. It's a thin TypeScript client over PostgREST, which translates HTTP requests into SQL. Understanding this chain matters:

```
supabase.from("table").select("col").eq("id", 1)
  → GET /rest/v1/table?select=col&id=eq.1
  → SELECT col FROM table WHERE id = 1  (with RLS applied)
```

RLS policies run as part of every query. If a query returns empty when you expect data, the first thing to check is whether the RLS policy grants access for the current user's role and auth state.

## The three clients

Supabase has three client types. Using the wrong one is a common source of bugs.

### 1. Server client (`createServerClient` from `@supabase/ssr`)
- **Use in:** Server Components, Server Actions, Route Handlers, Middleware
- **Auth:** Reads session from cookies — the user's identity and RLS apply
- **Key detail:** Uses `cookies()` from `next/headers` for session management
- **When `setAll` is called from a Server Component**, it will throw — that's expected. The `try/catch` in the cookie handler is intentional, not a bug. Middleware handles the actual refresh.

### 2. Browser client (`createBrowserClient` from `@supabase/ssr`)
- **Use in:** Client Components (`"use client"`)
- **Auth:** Reads session from browser cookies automatically
- **Key detail:** PKCE flow is the default. Do not use implicit flow with SSR.

### 3. Service client (`createClient` with service role key)
- **Use in:** Trusted server-only contexts (webhooks, background jobs, admin operations)
- **Auth:** **Bypasses all RLS.** This is intentional — use only when you need to operate outside a user's permissions (e.g., creating profiles for child accounts, admin operations).
- **Key detail:** Set `auth: { persistSession: false }` — you don't want session management on a service client.
- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## PostgREST query essentials

### Select with joins

PostgREST auto-detects foreign key relationships. You don't write JOINs — you nest the related table name in the select string:

```typescript
// One-to-many: get programs with their teacher profile
const { data } = await supabase
  .from("programs")
  .select(`
    id, title,
    teacher:profiles!programs_teacher_profile_id_fkey (
      id, full_name, avatar_url
    )
  `)
```

When there are **multiple foreign keys** to the same table, you must disambiguate with the FK constraint name using `!constraint_name` syntax. Without it, PostgREST returns PGRST201 (ambiguous embedding).

### The `!inner` modifier

By default, PostgREST does a LEFT JOIN — parent rows appear even if the child has no matches. Use `!inner` to get INNER JOIN behavior (exclude parents with no matching children):

```typescript
// Only return programs that have at least one enrollment
const { data } = await supabase
  .from("programs")
  .select(`*, enrollments!inner(*)`)
```

### Filtering on joined tables

To filter on a joined table's columns, prefix the column with the table name:

```typescript
// Get sections where an instrument named 'flute' exists
const { data } = await supabase
  .from("orchestral_sections")
  .select(`id, name, instruments!inner(id, name)`)
  .eq("instruments.name", "flute")
```

**The `!inner` is required when filtering on joined tables if you want to exclude parent rows that don't match.** Without `!inner`, the filter applies to the nested data but parent rows still appear (with empty arrays).

### The spread operator `...`

Flattens a one-to-one or many-to-one relationship into the parent row:

```typescript
// Instead of { id, profile: { full_name } }, get { id, full_name }
const { data } = await supabase
  .from("mosque_memberships")
  .select(`id, role, ...profiles(full_name, email)`)
```

### Result methods

| Method | Use when | Behavior |
|--------|----------|----------|
| `.select()` | Multiple rows expected | Returns `data: Row[]` |
| `.single()` | Exactly 1 row expected | Returns `data: Row`. **Errors (PGRST116) if 0 or 2+ rows.** |
| `.maybeSingle()` | 0 or 1 row expected | Returns `data: Row \| null`. Errors if 2+ rows. |

Use `.maybeSingle()` for lookups that might not exist (like checking if a user has a profile). Use `.single()` only when the query is guaranteed to return exactly one row (e.g., fetching by primary key after confirming existence).

### Upsert

```typescript
// Insert or update based on unique constraint
const { error } = await supabase
  .from("mosque_memberships")
  .upsert(
    { mosque_id, profile_id, role: "student" },
    { onConflict: "mosque_id,profile_id" }
  )
```

To silently skip duplicates without updating:
```typescript
const { error } = await supabase
  .from("mosque_memberships")
  .upsert(
    { mosque_id, profile_id, role: "student" },
    { onConflict: "mosque_id,profile_id", ignoreDuplicates: true }
  )
```

### Count without fetching rows

```typescript
const { count } = await supabase
  .from("enrollments")
  .select("*", { count: "exact", head: true })
  .eq("program_id", programId)
```

## Known PostgREST gotchas

These trip up even experienced developers:

1. **Dot-notation filters on nested relations can be unreliable across multiple FK hops.** If filtering through 2+ levels of joins (e.g., `enrollments.programs.mosque_id`), fetch the broader set and filter in JavaScript. This is a known limitation.

2. **Nested relations sometimes return arrays instead of objects** for one-to-one relationships. This happens when PostgREST can't infer cardinality. Defensive code:
   ```typescript
   const profile = Array.isArray(data.profile) ? data.profile[0] : data.profile
   ```

3. **Empty result ≠ error.** `{ data: [], error: null }` usually means RLS blocked the rows, not that the table is empty. Check the policy.

4. **RLS uses the JWT role, not the user.** The `anon` key gives the `anon` role. The user's JWT (via cookies) gives the `authenticated` role. Policies must target the right role.

## RLS policy quick reference

```sql
-- Enable RLS (required before any policy takes effect)
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- SELECT policy: USING clause filters which rows are visible
CREATE POLICY "Users see own data"
ON my_table FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- INSERT policy: WITH CHECK validates the new row
CREATE POLICY "Users insert own data"
ON my_table FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE policy: USING filters existing rows, WITH CHECK validates the new row
CREATE POLICY "Users update own data"
ON my_table FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE policy: USING filters which rows can be deleted
CREATE POLICY "Users delete own data"
ON my_table FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

**Performance tip:** Always wrap `auth.uid()` in a subselect — `(SELECT auth.uid())` — rather than bare `auth.uid()`. This lets Postgres evaluate it once instead of per-row.

**Multi-tenant pattern:** For tenant-isolated tables, check membership:
```sql
CREATE POLICY "Members see tenant data"
ON programs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.mosque_id = programs.mosque_id
    AND mosque_memberships.profile_id = (SELECT auth.uid())
  )
);
```

## Migration workflow (quick version)

```bash
# Create a new migration
supabase migration new add_some_feature

# Edit the file at supabase/migrations/<timestamp>_add_some_feature.sql

# Push to remote (NEVER use MCP apply_migration — use CLI)
supabase db push

# Regenerate TypeScript types after schema changes
supabase gen types typescript --project-id <ref> > types/database.ts
```

For the full workflow including diffing, branching, and CI/CD, read `references/migration-workflow.md`.

## Error handling pattern

Always check for errors. Supabase returns `{ data, error }` — a non-null `error` means `data` is null.

```typescript
const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

if (error) {
  // Log and handle — common errors:
  // PGRST116: .single() got 0 or 2+ rows
  // 42501: RLS permission denied
  // 23505: unique constraint violation
  // 23503: foreign key violation
  console.error("Supabase error:", error.code, error.message)
  return { error: error.message }
}
```

## Server Actions pattern

All mutations should go through Server Actions with auth checks:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createProgram(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("programs")
    .insert({
      mosque_id: formData.get("mosque_id") as string,
      teacher_profile_id: user.id,
      title: formData.get("title") as string,
    })

  if (error) return { error: error.message }

  revalidatePath("/programs")
  return { success: true }
}
```

## Checklist before shipping

- [ ] RLS is enabled on every new table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Policies exist for every operation the app performs (SELECT/INSERT/UPDATE/DELETE)
- [ ] Multi-tenant tables filter by `mosque_id` (or equivalent tenant column) in every query AND policy
- [ ] `auth.uid()` is wrapped in `(SELECT auth.uid())` in policies for performance
- [ ] Service client is only used in trusted server contexts, never exposed to browser
- [ ] Types are regenerated after schema changes
- [ ] Migration file has a valid timestamp and descriptive name
- [ ] Tested both as authenticated user AND unauthenticated to verify RLS
