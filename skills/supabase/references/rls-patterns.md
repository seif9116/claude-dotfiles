# RLS Policy Patterns — Deep Reference

Row Level Security (RLS) is Postgres's built-in mechanism for restricting which rows a user can access. In Supabase, RLS is the primary security layer — it runs on every query made through the PostgREST API.

## Table of Contents
1. [RLS fundamentals](#rls-fundamentals)
2. [Policy clause reference](#policy-clause-reference)
3. [Auth helper functions](#auth-helper-functions)
4. [Common policy patterns](#common-policy-patterns)
5. [Multi-tenant patterns](#multi-tenant-patterns)
6. [Performance considerations](#performance-considerations)
7. [Debugging RLS issues](#debugging-rls-issues)
8. [Security checklist](#security-checklist)

---

## RLS fundamentals

### Enabling RLS
```sql
-- RLS must be explicitly enabled per table
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (postgres role)
-- Usually not needed for Supabase, but useful for extra safety
ALTER TABLE my_table FORCE ROW LEVEL SECURITY;
```

When RLS is enabled but no policies exist, **all access is denied** (except for the table owner). This is the safe default.

### How policies combine
- Multiple SELECT policies on the same table are combined with **OR** (any policy granting access is sufficient)
- Policies of different types (SELECT, INSERT, UPDATE, DELETE) are independent
- A RESTRICTIVE policy (rare) combines with AND instead of OR — use when you need to narrow access

### The two clause types
- **USING**: Filters which existing rows are visible (used by SELECT, UPDATE, DELETE)
- **WITH CHECK**: Validates new/modified row data (used by INSERT, UPDATE)

| Operation | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | Yes | No |
| INSERT | No | Yes |
| UPDATE | Yes (existing row) | Yes (new row) |
| DELETE | Yes | No |

---

## Policy clause reference

### SELECT policy
```sql
CREATE POLICY "name" ON table_name
FOR SELECT
TO role_name        -- authenticated, anon, or specific role
USING (condition);  -- which rows are visible
```

### INSERT policy
```sql
CREATE POLICY "name" ON table_name
FOR INSERT
TO role_name
WITH CHECK (condition);  -- validates the new row
```

### UPDATE policy
```sql
CREATE POLICY "name" ON table_name
FOR UPDATE
TO role_name
USING (condition)         -- which existing rows can be updated
WITH CHECK (condition);   -- validates the updated row
```

### DELETE policy
```sql
CREATE POLICY "name" ON table_name
FOR DELETE
TO role_name
USING (condition);  -- which rows can be deleted
```

### ALL (shorthand for all operations)
```sql
CREATE POLICY "name" ON table_name
FOR ALL
TO role_name
USING (condition)
WITH CHECK (condition);
```

---

## Auth helper functions

Supabase provides these functions in the `auth` schema:

| Function | Returns | Use in |
|----------|---------|--------|
| `auth.uid()` | The authenticated user's UUID | Policy conditions |
| `auth.jwt()` | The full JWT as JSON | Accessing custom claims |
| `auth.role()` | The current role (e.g., 'authenticated') | Rarely needed directly |

### Performance: always use subselect
```sql
-- GOOD: evaluated once per query
(SELECT auth.uid()) = user_id

-- BAD: evaluated per row (slow on large tables)
auth.uid() = user_id
```

The subselect `(SELECT auth.uid())` lets Postgres treat the value as a constant for the entire query, dramatically improving performance on tables with many rows.

### Accessing JWT claims
```sql
-- Access a custom claim from the JWT
(auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'

-- Check if email is verified
(auth.jwt() ->> 'email_confirmed_at') IS NOT NULL
```

---

## Common policy patterns

### Owner-only access
The most basic pattern — users can only access their own data:
```sql
CREATE POLICY "Users manage own profile"
ON profiles FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);
```

### Public read, authenticated write
```sql
-- Anyone can read
CREATE POLICY "Public read"
ON posts FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated users can create
CREATE POLICY "Authenticated insert"
ON posts FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = author_id);
```

### Role-based access within a membership
Check the user's role in a related table:
```sql
-- Admins can manage all data in their mosque
CREATE POLICY "Admins manage mosque data"
ON programs FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.mosque_id = programs.mosque_id
    AND mosque_memberships.profile_id = (SELECT auth.uid())
    AND mosque_memberships.role IN ('mosque_admin', 'lead_teacher')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.mosque_id = programs.mosque_id
    AND mosque_memberships.profile_id = (SELECT auth.uid())
    AND mosque_memberships.role IN ('mosque_admin', 'lead_teacher')
  )
);
```

### Teachers access their own programs
```sql
CREATE POLICY "Teachers manage own programs"
ON programs FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = teacher_profile_id)
WITH CHECK ((SELECT auth.uid()) = teacher_profile_id);
```

### Parent access through a link table
When parents need to access data for their children:
```sql
CREATE POLICY "Parents see child enrollments"
ON enrollments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM parent_child_links
    WHERE parent_child_links.parent_profile_id = (SELECT auth.uid())
    AND parent_child_links.child_profile_id = enrollments.student_profile_id
  )
);
```

### Conditional visibility (active/published items)
```sql
-- Everyone sees active programs, admins see all
CREATE POLICY "View active programs"
ON programs FOR SELECT
TO authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.mosque_id = programs.mosque_id
    AND mosque_memberships.profile_id = (SELECT auth.uid())
    AND mosque_memberships.role = 'mosque_admin'
  )
);
```

---

## Multi-tenant patterns

Multi-tenant apps need to ensure data isolation between tenants (e.g., mosques). Every table that belongs to a tenant should have a `mosque_id` (or equivalent) column, and every policy should filter by it.

### Base pattern: member access
```sql
CREATE POLICY "Members access tenant data"
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

### Insert with tenant validation
Ensure users can only create data in tenants they belong to:
```sql
CREATE POLICY "Members create in own tenant"
ON programs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.mosque_id = programs.mosque_id
    AND mosque_memberships.profile_id = (SELECT auth.uid())
    AND mosque_memberships.role IN ('mosque_admin', 'lead_teacher', 'teacher')
  )
);
```

### Platform admin override
For global admins who can access all tenants:
```sql
CREATE POLICY "Platform admins see everything"
ON programs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.global_role = 'platform_admin'
  )
);
```

---

## Performance considerations

### Use EXISTS instead of IN for subqueries
```sql
-- GOOD: EXISTS stops at the first match
USING (
  EXISTS (
    SELECT 1 FROM mosque_memberships
    WHERE mosque_memberships.profile_id = (SELECT auth.uid())
    AND mosque_memberships.mosque_id = programs.mosque_id
  )
)

-- LESS EFFICIENT: IN fetches all matching rows
USING (
  mosque_id IN (
    SELECT mosque_id FROM mosque_memberships
    WHERE profile_id = (SELECT auth.uid())
  )
)
```

### Index the columns used in policies
Ensure foreign key columns and frequently filtered columns have indexes:
```sql
-- These indexes speed up RLS policy evaluation
CREATE INDEX idx_memberships_profile ON mosque_memberships(profile_id);
CREATE INDEX idx_memberships_mosque_profile ON mosque_memberships(mosque_id, profile_id);
CREATE INDEX idx_programs_mosque ON programs(mosque_id);
CREATE INDEX idx_programs_teacher ON programs(teacher_profile_id);
```

### Avoid function calls in policies
Functions that aren't marked as IMMUTABLE or STABLE are re-evaluated per row. Stick to simple column comparisons and EXISTS checks.

---

## Debugging RLS issues

### Symptom: query returns empty but data exists
1. **Test with service client** — if data comes back, it's an RLS issue
2. **Check the role** — `anon` vs `authenticated`
3. **Check `auth.uid()`** — does the user have a valid session?
4. **Check policy conditions** — manually run the EXISTS subquery

### Viewing current policies
```sql
SELECT
  schemaname, tablename, policyname,
  permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Testing a policy manually
```sql
-- Simulate what RLS sees for a specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SET role TO authenticated;

SELECT * FROM programs WHERE mosque_id = 'some-mosque-id';

-- Reset
RESET role;
RESET request.jwt.claim.sub;
```

### Common mistakes
1. **Forgetting to enable RLS** — table is wide open
2. **No policy for the operation** — all access denied
3. **Using `auth.uid()` without subselect** — works but slow
4. **Policies on wrong role** — policy for `authenticated` when user is `anon`
5. **Missing INSERT policy** — can SELECT but can't create
6. **UPDATE without both USING and WITH CHECK** — can see rows but can't save changes

---

## Security checklist

Before shipping any new table or migration:

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is in the migration
- [ ] SELECT policy exists and scopes to the correct tenant/owner
- [ ] INSERT policy WITH CHECK validates the user can create in this scope
- [ ] UPDATE policy has both USING (what they can edit) and WITH CHECK (what values are valid)
- [ ] DELETE policy exists if deletion is allowed (if not, no policy = no deletion)
- [ ] `auth.uid()` is in `(SELECT auth.uid())` form
- [ ] EXISTS subqueries reference the correct FK columns
- [ ] Indexes exist on columns used in policy conditions
- [ ] Tested with an actual authenticated user (not just service client)
- [ ] Tested that unauthenticated users get denied
- [ ] Tested cross-tenant access is denied
