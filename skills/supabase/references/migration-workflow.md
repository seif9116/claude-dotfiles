# Migration Workflow & Type Generation — Deep Reference

## Table of Contents
1. [Migration basics](#migration-basics)
2. [Creating migrations](#creating-migrations)
3. [Deploying migrations](#deploying-migrations)
4. [Type generation](#type-generation)
5. [Schema diffing](#schema-diffing)
6. [CLI reference](#cli-reference)
7. [Common issues](#common-issues)

---

## Migration basics

Migrations are SQL files in `supabase/migrations/` that track schema changes over time. Each file is named with a timestamp prefix: `<YYYYMMDDHHMMSS>_description.sql`.

Migrations run in order. Each one builds on the previous. They are **append-only** — you don't edit old migrations, you create new ones.

### Project structure
```
supabase/
├── config.toml          # Local Supabase config
├── migrations/
│   ├── 20260320000001_tags_parent_role.sql
│   ├── 20260320000002_teacher_join_requests.sql
│   └── 20260327183316_add_member_profile_policy.sql
└── seed.sql             # Optional seed data
```

---

## Creating migrations

### Method 1: Manual (recommended for most cases)
```bash
supabase migration new add_attendance_table
```
This creates `supabase/migrations/<timestamp>_add_attendance_table.sql`. Write your SQL in this file:

```sql
-- Create the table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  student_profile_id UUID NOT NULL REFERENCES profiles(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, student_profile_id, date)
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Teachers manage attendance for their programs"
ON attendance FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM programs
    WHERE programs.id = attendance.program_id
    AND programs.teacher_profile_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM programs
    WHERE programs.id = attendance.program_id
    AND programs.teacher_profile_id = (SELECT auth.uid())
  )
);

-- Add indexes for RLS performance
CREATE INDEX idx_attendance_program ON attendance(program_id);
CREATE INDEX idx_attendance_student ON attendance(student_profile_id);
```

### Method 2: Auto-diff from Dashboard changes
If you made changes through the Supabase Dashboard:
```bash
supabase db diff -f add_attendance_table
```
This generates the SQL diff between your current local schema and the Dashboard state. Review the output — it can be verbose. The `-f` flag writes to a migration file instead of stdout.

### Migration best practices

1. **One concern per migration** — don't mix unrelated schema changes
2. **Always include RLS** — enable RLS and add policies in the same migration as the table
3. **Add indexes** — especially on columns used in RLS policy conditions
4. **Use IF EXISTS / IF NOT EXISTS** — makes migrations more resilient to reruns
5. **Name constraints** — explicit names make debugging easier:
   ```sql
   ALTER TABLE programs ADD CONSTRAINT programs_mosque_id_fkey
     FOREIGN KEY (mosque_id) REFERENCES mosques(id);
   ```

---

## Deploying migrations

### Push to remote project
```bash
# Link to your project (one-time setup)
supabase link --project-ref <project-id>

# Deploy pending migrations
supabase db push
```

`db push` applies only migrations that haven't been run yet on the remote database. It tracks this via the `supabase_migrations.schema_migrations` table.

### Important: Never use MCP apply_migration
The Supabase MCP tool's `apply_migration` is for read-only inspection. For actual DDL changes, always use the Supabase CLI (`supabase db push`) or write SQL files and push through the CLI.

### Pull remote changes
If someone else made changes through the Dashboard:
```bash
supabase db pull
```
This generates a migration file capturing the remote schema changes.

### Reset local database
```bash
supabase db reset
```
Drops and recreates the local database, replaying all migrations from scratch. Useful when you need a clean slate or after rebasing migrations.

---

## Type generation

After any schema change, regenerate TypeScript types to keep type safety:

```bash
# Generate from remote project
supabase gen types typescript --project-id <project-ref> > types/database.ts

# Generate from local database (if running locally)
supabase gen types typescript --local > types/database.ts
```

### What the types look like
```typescript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          // ...
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          // ...
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          // ...
        }
        Relationships: [
          // FK constraint info
        ]
      }
      // ... more tables
    }
  }
}
```

### Using types with the client
```typescript
import { Database } from "@/types/database"
import { createBrowserClient } from "@supabase/ssr"

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Now all queries are typed:
const { data } = await supabase.from("profiles").select("id, full_name")
// data is typed as { id: string; full_name: string | null }[] | null
```

### Helper types for query results
```typescript
import { QueryData } from "@supabase/supabase-js"

const programsWithTeacher = supabase
  .from("programs")
  .select(`id, title, teacher:profiles(full_name)`)

type ProgramWithTeacher = QueryData<typeof programsWithTeacher>
// Correctly types the nested join
```

---

## Schema diffing

### Diff local changes
```bash
# See what SQL would be generated from local Dashboard changes
supabase db diff --schema public

# Write to a file
supabase db diff -f my_changes --schema public
```

### Diff against linked remote
```bash
supabase db diff --linked --schema public
```

---

## CLI reference

### Most-used commands

| Command | What it does |
|---------|-------------|
| `supabase migration new <name>` | Create empty migration file |
| `supabase db push` | Apply pending migrations to remote |
| `supabase db pull` | Pull remote changes as a migration |
| `supabase db reset` | Reset local DB (replay all migrations) |
| `supabase db diff -f <name>` | Generate diff as migration file |
| `supabase gen types typescript` | Generate TypeScript types |
| `supabase migration list` | Show migration status (local vs remote) |
| `supabase start` | Start local Supabase stack |
| `supabase stop` | Stop local Supabase stack |
| `supabase link --project-ref <id>` | Link to remote project |
| `supabase functions deploy <name>` | Deploy an edge function |
| `supabase functions serve` | Run edge functions locally |

### Checking migration status
```bash
supabase migration list
```
Shows which migrations are applied locally, remotely, or both. Useful for debugging "migration already applied" errors.

---

## Common issues

### "Migration already applied"
The remote DB already has this migration. This happens when you pull changes that were already deployed. Solution: delete the duplicate local migration file.

### "Permission denied" on `db push`
Tables created through the Dashboard are owned by `supabase_admin`, but CLI migrations run as `postgres`. Fix:
```sql
ALTER TABLE my_table OWNER TO postgres;
```

### Timestamp conflicts
If two developers create migrations at similar times, timestamps can conflict. Rename your migration file with a newer timestamp:
```bash
mv supabase/migrations/20260320000001_my_change.sql supabase/migrations/20260327200000_my_change.sql
```
Then `supabase db reset` to verify it applies cleanly.

### "Relation does not exist" in migration
Migrations run in timestamp order. If migration B references a table from migration A, ensure A's timestamp is earlier. Order matters.

### Types are stale after migration
Regenerate types every time you change the schema:
```bash
supabase gen types typescript --project-id <ref> > types/database.ts
```
This is not automatic — you must run it manually (or add it to CI).
