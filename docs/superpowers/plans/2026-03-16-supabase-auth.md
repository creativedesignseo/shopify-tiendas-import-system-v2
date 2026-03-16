# Supabase Auth SaaS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email+password authentication via Supabase Auth so every user must log in, and each user's settings (Shopify credentials, AI keys) are stored per-user in Supabase instead of localStorage.

**Architecture:** Supabase Auth with `@supabase/ssr` for Next.js App Router. Middleware intercepts all requests and redirects unauthenticated users to `/login`. A `user_settings` table in Supabase stores per-user config with RLS policies. Client components access the session via a React context provider.

**Tech Stack:** Next.js 16 App Router, Supabase Auth, `@supabase/ssr`, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-16-supabase-auth-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/lib/supabase/client.ts` | Browser Supabase client (uses `createBrowserClient`) |
| `src/lib/supabase/server.ts` | Server Supabase client (uses `createServerClient` with cookies) |
| `src/lib/supabase/middleware.ts` | Middleware Supabase client (refreshes session tokens) |
| `src/middleware.ts` | Next.js middleware — redirects unauthenticated users to `/login` |
| `src/components/auth-provider.tsx` | React context providing user session + loading state |
| `src/components/user-menu.tsx` | Nav dropdown: user email + logout button |
| `src/app/login/page.tsx` | Login + register page (tabs) |
| `src/app/auth/callback/route.ts` | Auth callback handler for email confirmation |

### Modified files
| File | Changes |
|---|---|
| `src/lib/supabase.ts` | Keep for backward compat (backup-service), re-export from new client |
| `src/app/layout.tsx` | Wrap children in `<AuthProvider>` |
| `src/components/main-nav.tsx` | Add `<UserMenu />` on the right side |
| `src/components/settings-dialog.tsx` | Read/write settings from Supabase `user_settings` instead of localStorage |
| `src/app/page.tsx` | Read Shopify config from user_settings via context instead of localStorage |
| `src/components/products-table.tsx` | Read Shopify config from user_settings context |
| `src/components/shopify-publish-dialog.tsx` | Read Shopify config from user_settings context |

### Database
| Table | Action |
|---|---|
| `public.user_settings` | CREATE — per-user settings with RLS |

---

## Chunk 1: Foundation (Supabase clients + DB + Middleware)

### Task 1: Install @supabase/ssr

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `npm install @supabase/ssr`

- [ ] **Step 2: Verify installation**

Run: `npm ls @supabase/ssr`
Expected: `@supabase/ssr@x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @supabase/ssr for Next.js auth"
```

---

### Task 2: Create Supabase client modules

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware client**

Create `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  // Not logged in and not on auth page → redirect to login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in and on login page → redirect to dashboard
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Update legacy supabase.ts to re-export**

Modify `src/lib/supabase.ts` — keep backward compatibility for backup-service:
```typescript
import { createClient as createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn("⚠️ Supabase URL or Key missing. Backup functionality will be disabled.");
}

export const supabase = createBrowserClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder"
);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/ src/lib/supabase.ts
git commit -m "feat: add Supabase SSR client modules for auth"
```

---

### Task 3: Create Next.js middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware to protect all routes"
```

---

### Task 4: Create user_settings table in Supabase

**Files:**
- Database migration via MCP

- [ ] **Step 1: Create table with RLS policies**

Run via Supabase MCP `apply_migration`:
```sql
-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_domain TEXT,
  shopify_access_token TEXT,
  shopify_api_version TEXT DEFAULT '2025-01',
  shopify_shop_name TEXT,
  shopify_products_count INTEGER DEFAULT 0,
  ai_provider TEXT DEFAULT 'gemini',
  ai_api_key TEXT,
  ai_gemini_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_openai_model TEXT DEFAULT 'gpt-4o-mini',
  default_inventory_qty INTEGER DEFAULT 10,
  publication_mode TEXT DEFAULT 'all',
  publication_ids JSONB DEFAULT '[]'::jsonb,
  output_mode TEXT DEFAULT 'csv_only',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_settings_updated
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create user_settings row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Verify table exists**

Run via MCP `list_tables` for schema `public`.

- [ ] **Step 3: Commit a note**

No code file to commit — migration is in Supabase. Document in commit message:

```bash
git commit --allow-empty -m "db: create user_settings table with RLS and auto-create trigger"
```

---

## Chunk 2: Auth UI (Login page + Provider + Nav)

### Task 5: Create AuthProvider context

**Files:**
- Create: `src/components/auth-provider.tsx`

- [ ] **Step 1: Create the provider**

Create `src/components/auth-provider.tsx`:
```typescript
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/auth-provider.tsx
git commit -m "feat: add AuthProvider context for user session"
```

---

### Task 6: Create login page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/";
      } else {
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden");
        }
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Cuenta creada. Revisa tu email para confirmar.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F0F0F] mb-4">
            <Sparkles className="w-6 h-6 text-[#D6F45B]" />
          </div>
          <h1 className="text-xl font-semibold text-[#0F0F0F]">
            Shopify Import Architect
          </h1>
          <p className="text-sm text-[#8C8C8C] mt-1">
            Catalogación inteligente con IA
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
          {/* Tabs */}
          <div className="flex mb-6 bg-[#F5F6F7] rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(""); setMessage(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                isLogin
                  ? "bg-white text-[#0F0F0F] shadow-sm"
                  : "text-[#8C8C8C] hover:text-[#0F0F0F]"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); setMessage(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                !isLogin
                  ? "bg-white text-[#0F0F0F] shadow-sm"
                  : "text-[#8C8C8C] hover:text-[#0F0F0F]"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#6B7280]">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="h-10 border-[#E5E7EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#6B7280]">
                Contraseña
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-10 border-[#E5E7EB]"
              />
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#6B7280]">
                  Confirmar Contraseña
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 border-[#E5E7EB]"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {message && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                {message}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#0F0F0F] hover:bg-[#2A2A2A] text-white rounded-full font-medium text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Crear Cuenta"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create auth callback route**

Create `src/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(origin);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx src/app/auth/callback/route.ts
git commit -m "feat: add login/register page and auth callback"
```

---

### Task 7: Create UserMenu + update layout and nav

**Files:**
- Create: `src/components/user-menu.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/main-nav.tsx`

- [ ] **Step 1: Create UserMenu component**

Create `src/components/user-menu.tsx`:
```typescript
"use client";

import { useAuth } from "@/components/auth-provider";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-white/60">
        <User className="h-3.5 w-3.5" />
        <span className="text-[12px] hidden sm:inline truncate max-w-[150px]">
          {user.email}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="text-white/40 hover:text-white/80 hover:bg-white/10 h-8 px-2"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update layout.tsx to wrap in AuthProvider**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/main-nav";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shopify Import Architect",
  description: "Herramienta de importación inteligente para Shopify con enriquecimiento IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <MainNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update main-nav.tsx to include UserMenu**

Modify `src/components/main-nav.tsx`:
```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserMenu } from "@/components/user-menu"

export function MainNav() {
  const pathname = usePathname()

  // Don't show nav on login page
  if (pathname === "/login") return null

  const linkClass = (active: boolean) => cn(
    "flex items-center gap-2 text-[13px] font-medium h-full border-b-2 px-1 transition-colors duration-200",
    active
      ? "text-[#D6F45B] border-[#D6F45B]"
      : "text-white/50 border-transparent hover:text-white/80"
  )

  return (
    <div className="bg-[#0F0F0F]">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-center gap-8 h-full">
            <Link href="/" className={linkClass(pathname === "/")}>
              <Sparkles className="h-3.5 w-3.5" />
              Importador IA
            </Link>
            <Link href="/mayorista" className={linkClass(pathname === "/mayorista")}>
              <FileText className="h-3.5 w-3.5" />
              Catálogo Mayorista
            </Link>
          </div>
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build to verify**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/user-menu.tsx src/components/auth-provider.tsx src/app/layout.tsx src/components/main-nav.tsx
git commit -m "feat: add UserMenu, AuthProvider, and protect nav"
```

---

## Chunk 3: Settings Migration (localStorage → Supabase)

### Task 8: Create useUserSettings hook

**Files:**
- Create: `src/hooks/use-user-settings.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-user-settings.ts`:
```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";

export interface UserSettings {
  shopify_domain: string;
  shopify_access_token: string;
  shopify_api_version: string;
  shopify_shop_name: string;
  shopify_products_count: number;
  ai_provider: string;
  ai_api_key: string;
  ai_gemini_model: string;
  ai_openai_model: string;
  default_inventory_qty: number;
  publication_mode: string;
  publication_ids: string[];
  output_mode: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  shopify_domain: "",
  shopify_access_token: "",
  shopify_api_version: "2025-01",
  shopify_shop_name: "",
  shopify_products_count: 0,
  ai_provider: "gemini",
  ai_api_key: "",
  ai_gemini_model: "gemini-2.5-flash",
  ai_openai_model: "gpt-4o-mini",
  default_inventory_qty: 10,
  publication_mode: "all",
  publication_ids: [],
  output_mode: "csv_only",
};

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load settings from Supabase
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        // Try migrating from localStorage (first-time login)
        const migrated = migrateFromLocalStorage();
        if (migrated) {
          await supabase
            .from("user_settings")
            .upsert({ user_id: user.id, ...migrated });
          setSettings({ ...DEFAULT_SETTINGS, ...migrated });
        }
      } else {
        setSettings({
          shopify_domain: data.shopify_domain || "",
          shopify_access_token: data.shopify_access_token || "",
          shopify_api_version: data.shopify_api_version || "2025-01",
          shopify_shop_name: data.shopify_shop_name || "",
          shopify_products_count: data.shopify_products_count || 0,
          ai_provider: data.ai_provider || "gemini",
          ai_api_key: data.ai_api_key || "",
          ai_gemini_model: data.ai_gemini_model || "gemini-2.5-flash",
          ai_openai_model: data.ai_openai_model || "gpt-4o-mini",
          default_inventory_qty: data.default_inventory_qty || 10,
          publication_mode: data.publication_mode || "all",
          publication_ids: data.publication_ids || [],
          output_mode: data.output_mode || "csv_only",
        });
      }
      setLoading(false);
    };

    load();
  }, [user, supabase]);

  // Save a partial settings update to Supabase
  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      if (!user) return;
      setSettings((prev) => ({ ...prev, ...partial }));
      await supabase
        .from("user_settings")
        .update({ ...partial, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    },
    [user, supabase]
  );

  return { settings, loading, updateSettings };
}

/** One-time migration from localStorage to Supabase */
function migrateFromLocalStorage(): Partial<UserSettings> | null {
  if (typeof window === "undefined") return null;

  const domain = localStorage.getItem("shopify_shop_domain");
  if (!domain) return null; // Nothing to migrate

  const migrated: Partial<UserSettings> = {
    shopify_domain: domain || "",
    shopify_access_token: localStorage.getItem("shopify_access_token") || "",
    shopify_api_version: localStorage.getItem("shopify_api_version") || "2025-01",
    shopify_shop_name: localStorage.getItem("shopify_shop_name") || "",
    ai_provider: localStorage.getItem("ai_provider") || "gemini",
    ai_api_key: localStorage.getItem("ai_api_key") || "",
    ai_gemini_model: localStorage.getItem("ai_gemini_model_version") || "gemini-2.5-flash",
    ai_openai_model: localStorage.getItem("ai_openai_model_version") || "gpt-4o-mini",
    default_inventory_qty: Number(localStorage.getItem("shopify_default_inventory_qty") || "10"),
    publication_mode: localStorage.getItem("shopify_publication_mode") || "all",
    output_mode: localStorage.getItem("shopify_output_mode") || "csv_only",
  };

  // Clear localStorage after migration
  const keysToRemove = [
    "shopify_shop_domain", "shopify_access_token", "shopify_api_version",
    "shopify_shop_name", "shopify_products_count", "shopify_connected",
    "shopify_profile_name", "shopify_output_mode", "shopify_default_inventory_qty",
    "shopify_publication_mode", "shopify_publication_ids", "shopify_publications_cache",
    "ai_provider", "ai_api_key", "ai_model_version",
    "ai_gemini_model_version", "ai_openai_model_version",
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  return migrated;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-user-settings.ts
git commit -m "feat: add useUserSettings hook with localStorage migration"
```

---

### Task 9: Update settings-dialog to use Supabase

**Files:**
- Modify: `src/components/settings-dialog.tsx`

This task replaces ALL `localStorage.getItem`/`setItem` calls in settings-dialog with the `useUserSettings` hook. The component will receive settings and updateSettings as props or use the hook directly.

- [ ] **Step 1: Refactor settings-dialog to use useUserSettings**

At the top of the component, replace the localStorage reads with:
```typescript
const { settings, updateSettings } = useUserSettings();
```

Initialize state from `settings` instead of `localStorage`. On save, call `updateSettings({...})` instead of multiple `localStorage.setItem(...)` calls.

Key changes:
- Replace `localStorage.getItem("shopify_shop_domain")` → `settings.shopify_domain`
- Replace `localStorage.getItem("shopify_access_token")` → `settings.shopify_access_token`
- Replace `localStorage.getItem("ai_provider")` → `settings.ai_provider`
- Replace `localStorage.setItem(...)` → `updateSettings({...})`
- Remove all direct localStorage access

- [ ] **Step 2: Build to verify**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/settings-dialog.tsx
git commit -m "refactor: migrate settings-dialog from localStorage to Supabase"
```

---

### Task 10: Update page.tsx and components to use settings hook

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/products-table.tsx`
- Modify: `src/components/shopify-publish-dialog.tsx`

- [ ] **Step 1: Update page.tsx**

Replace localStorage reads for Shopify config with `useUserSettings()`. The hook provides `settings.shopify_domain`, `settings.shopify_access_token`, etc.

- [ ] **Step 2: Update products-table.tsx**

Replace `localStorage.getItem("shopify_connected")` and related reads with settings from hook or props.

- [ ] **Step 3: Update shopify-publish-dialog.tsx**

Replace localStorage reads for `shopify_shop_domain`, `shopify_access_token`, `shopify_api_version`, `shopify_publication_mode`, `shopify_publication_ids`, `shopify_default_inventory_qty` with settings from hook or props passed from parent.

- [ ] **Step 4: Build to verify**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/products-table.tsx src/components/shopify-publish-dialog.tsx
git commit -m "refactor: migrate remaining components from localStorage to Supabase settings"
```

---

## Chunk 4: Final integration + deploy

### Task 11: Verify full flow and push

- [ ] **Step 1: Build the project**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Create first user in Supabase**

Via Supabase dashboard or MCP, create the owner's account so they can log in immediately after deploy.

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete Supabase Auth SaaS integration (v2.0.0)

- Email+password auth via Supabase
- Protected routes via Next.js middleware
- Per-user settings stored in Supabase (replaces localStorage)
- Login/register page with Uber-style design
- UserMenu in nav with email + logout
- Auto-migration from localStorage on first login
- user_settings table with RLS policies"
```

- [ ] **Step 4: Update version.json to 2.0.0**

This is a major version bump — the app goes from public to authenticated.

- [ ] **Step 5: Push to deploy**

Run: `git push origin main`
Expected: Netlify auto-deploys with auth enabled

---

## Summary

| Chunk | Tasks | What it delivers |
|---|---|---|
| 1: Foundation | Tasks 1-4 | Supabase clients, middleware, database table |
| 2: Auth UI | Tasks 5-7 | Login page, AuthProvider, UserMenu in nav |
| 3: Settings Migration | Tasks 8-10 | useUserSettings hook, all components migrated from localStorage |
| 4: Integration | Task 11 | Build verification, first user, deploy |
