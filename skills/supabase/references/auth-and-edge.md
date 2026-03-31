# Auth Flows & Edge Functions — Deep Reference

## Table of Contents
1. [Auth architecture](#auth-architecture)
2. [Next.js SSR auth setup](#nextjs-ssr-auth-setup)
3. [OAuth callback flow](#oauth-callback-flow)
4. [Session management](#session-management)
5. [Edge functions](#edge-functions)
6. [Supabase Storage basics](#storage-basics)

---

## Auth architecture

Supabase Auth is built on GoTrue (Netlify's auth server, extended by Supabase). It manages users in the `auth.users` table and issues JWTs.

### Key concepts
- **JWT**: issued on login, contains the user's UUID, role, and metadata
- **PKCE flow**: the default for SSR — exchanges an auth code for a session (more secure than implicit flow)
- **Session**: stored in cookies via `@supabase/ssr` — consists of access_token + refresh_token
- **Middleware**: refreshes expired sessions on every request by calling `getUser()`

### Roles
| Role | Who | When |
|------|-----|------|
| `anon` | Unauthenticated visitors | Using the anon/publishable key without a session |
| `authenticated` | Logged-in users | Using the anon key with a valid session cookie |
| `service_role` | Server-side admin | Using the service role key (bypasses RLS) |

---

## Next.js SSR auth setup

### Server client (Server Components, Server Actions, Route Handlers)
```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore.
            // Middleware handles the actual token refresh.
          }
        },
      },
    }
  )
}
```

The `try/catch` in `setAll` is intentional, not a bug. Server Components can't set cookies, but that's fine because middleware handles session refresh.

### Browser client (Client Components)
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Middleware (session refresh)
```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Calling getUser() refreshes the session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user && !request.nextUrl.pathname.startsWith("/login")
      && !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

**Critical:** The middleware must return `supabaseResponse`, not `NextResponse.next()`. The response carries updated session cookies from `setAll`.

### Service client (admin/bypass RLS)
```typescript
// lib/supabase/service.ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```
Use only for operations that intentionally bypass RLS (e.g., creating child profiles, admin batch operations).

---

## OAuth callback flow

### The callback route handler
```typescript
// app/auth/callback/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed — redirect to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### Initiating OAuth login
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${origin}/auth/callback`,
  },
})

if (data.url) {
  redirect(data.url) // redirect to Google
}
```

### Getting the user
```typescript
// In Server Components / Server Actions:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
// user.id is the UUID, user.email is the email
// user.user_metadata contains OAuth metadata (name, avatar, etc.)
```

Always use `getUser()` over `getSession()` for auth checks. `getUser()` validates the JWT with the server; `getSession()` only reads the local JWT (which could be expired or tampered with).

---

## Session management

### Sign out
```typescript
await supabase.auth.signOut()
```

### Listen to auth state changes (Client Components)
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/login")
      }
    }
  )

  return () => subscription.unsubscribe()
}, [])
```

### Auth events
- `SIGNED_IN`: user signed in
- `SIGNED_OUT`: user signed out
- `TOKEN_REFRESHED`: session was refreshed
- `USER_UPDATED`: user metadata changed
- `PASSWORD_RECOVERY`: password reset flow initiated

---

## Edge functions

Edge Functions are server-side TypeScript functions running on Deno, deployed globally at the edge.

### Creating an edge function
```bash
supabase functions new my-function
```
Creates `supabase/functions/my-function/index.ts`.

### Basic edge function structure
```typescript
// supabase/functions/my-function/index.ts
import { createClient } from "npm:@supabase/supabase-js@2"

Deno.serve(async (req) => {
  try {
    // Create a client that inherits the caller's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    )

    // Query with the caller's RLS context
    const { data, error } = await supabase.from("profiles").select("*")

    if (error) throw error

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
```

### When to use edge functions
- Webhook receivers (Stripe, GitHub, etc.)
- Background processing that can't run in Next.js API routes
- Operations requiring the Deno runtime
- Cron jobs via `pg_cron` or external schedulers

### Deploying
```bash
supabase functions deploy my-function
```

### Invoking from client
```typescript
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { key: "value" },
})
```

### CORS for browser invocation
```typescript
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  // Your function logic...
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
})
```

### Environment variables / secrets
```bash
# Set a secret
supabase secrets set STRIPE_SECRET_KEY=sk_live_...

# Access in function
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
```

Built-in env vars available in every function:
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — publishable anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (use carefully)
- `SUPABASE_DB_URL` — direct database connection string

---

## Storage basics

### Upload a file
```typescript
const { data, error } = await supabase.storage
  .from("avatars")
  .upload(`${userId}/avatar.png`, file, {
    contentType: "image/png",
    upsert: true, // overwrite if exists
  })
```

### Get a public URL
```typescript
const { data } = supabase.storage
  .from("avatars")
  .getPublicUrl(`${userId}/avatar.png`)
// data.publicUrl is the CDN URL
```

### Create a signed URL (private files)
```typescript
const { data, error } = await supabase.storage
  .from("documents")
  .createSignedUrl("path/to/file.pdf", 3600) // expires in 1 hour
```

### Storage RLS
Storage uses the same RLS system. Policies on the `storage.objects` table control access:
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```
