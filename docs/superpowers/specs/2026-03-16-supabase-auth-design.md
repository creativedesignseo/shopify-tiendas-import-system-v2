# Supabase Auth SaaS — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Add email+password auth, protected routes, per-user settings

---

## Overview

Add Supabase Auth to the app so that:
- Every user must log in to access the dashboard
- Each user has their own Shopify config, AI keys, and settings stored in Supabase (not localStorage)
- A user can invite collaborators to their account (future, not implemented now)

## Auth Method

- Email + password via Supabase Auth
- No OAuth, no magic links (keep it simple for now)

## Architecture

### New packages
- `@supabase/ssr` — SSR-compatible Supabase client for Next.js App Router

### Supabase clients (replacing current single client)
- **Browser client** (`src/lib/supabase/client.ts`) — for client components
- **Server client** (`src/lib/supabase/server.ts`) — for API routes and server components
- **Middleware client** (`src/lib/supabase/middleware.ts`) — for Next.js middleware

### New files
- `src/middleware.ts` — intercepts all requests, redirects unauthenticated users to `/login`
- `src/app/login/page.tsx` — login + register form (tabs)
- `src/app/auth/callback/route.ts` — handles Supabase auth callback
- `src/components/auth-provider.tsx` — React context providing user session to all components
- `src/components/user-menu.tsx` — dropdown in nav showing user email + logout

### Modified files
- `src/lib/supabase.ts` — replaced by `src/lib/supabase/client.ts` and `server.ts`
- `src/app/layout.tsx` — wrap app in AuthProvider
- `src/components/main-nav.tsx` — add UserMenu component
- Settings panel — read/write from Supabase `user_settings` instead of localStorage

## Database Schema

### Table: `user_settings` (new)

```sql
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_domain TEXT,
  shopify_access_token TEXT,
  shopify_api_version TEXT DEFAULT '2025-01',
  ai_provider TEXT DEFAULT 'gemini',
  ai_api_key TEXT,
  ai_model TEXT,
  default_inventory_qty INTEGER DEFAULT 10,
  publication_mode TEXT DEFAULT 'all',
  publication_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS: users can only see/edit their own settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);
```

### Update existing tables

- `backups.user_id` — already references `auth.users`, RLS already enabled
- `import_sessions` — add `user_id` column with FK to `auth.users`

## Middleware Logic

```
Request → middleware.ts
  → Check Supabase session cookie
  → If path is /login or /auth/callback → allow through
  → If no session → redirect to /login
  → If session valid → allow through, refresh token if needed
```

## Login Page

Single page with two tabs:
- **Iniciar Sesion** — email + password → `supabase.auth.signInWithPassword()`
- **Crear Cuenta** — email + password + confirm → `supabase.auth.signUp()`

After successful login/register → redirect to `/`

Design: matches existing Uber-style design system (black/white, pill buttons, clean).

## Settings Migration

Currently settings are in localStorage. After auth:
1. On first login, if `user_settings` row doesn't exist, create one
2. If localStorage has existing values, migrate them to Supabase on first login, then clear localStorage
3. All settings reads/writes go through Supabase from that point on
4. API routes read settings from Supabase using the authenticated user's session

## API Route Protection

All API routes (`/api/*`) will:
1. Extract user session from request cookies via server Supabase client
2. If no session → return 401
3. Use user_id to fetch their settings from `user_settings`
4. Use those settings (Shopify token, AI key) for the operation

## What Does NOT Change

- CSV import/export flow
- AI generation logic
- Shopify publish logic
- Product review dialog
- All existing UI components

Only the auth layer wraps around what exists. Settings move from localStorage to Supabase.

## Future (not now)

- Team/collaborator invitations
- Role-based permissions (admin, operator)
- Stripe billing integration
- Niche selector on registration (perfumery, jewelry, cosmetics)
