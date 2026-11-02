# WealthOS

AI-powered personal finance management for India. **WealthOS calculates. AI interprets. The user decides.**

Every figure in the app is computed from your own records with exact integer arithmetic (paise). AI features (Phase 5+) interpret results through strictly scoped, read-only tools — they never modify records and never invent numbers.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS 4 with light/dark design tokens
- Supabase: PostgreSQL + Auth (+ pgvector for the Phase 6 knowledge centre)
- Vitest for financial-accuracy unit tests · GitHub Actions CI

## Setup

```bash
npm ci
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Without Supabase credentials the app runs in **local mode** (browser storage, no auth) — everything else keeps working.

### Database

Migrations live in `supabase/migrations/` (versioned SQL, Row Level Security on every user-owned table). Apply them in the Supabase SQL editor or via `supabase db push`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (financial accuracy suite) |

## Repository map

- `src/app/(app)/` — the 15 product modules (Overview … Knowledge Centre)
- `src/app/(auth)/` — sign-in, sign-up, password reset
- `src/lib/money.ts` — exact integer-paise money primitives
- `src/lib/domain/` — pure financial calculation modules (savings rate, net worth, budget utilisation, XIRR)
- `src/lib/supabase/` — browser + server clients (setup-aware)
- `supabase/migrations/` — schema + RLS policies

## Roadmap

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation — design system, auth, DB + RLS, money math, CI | ✅ Done (RLS verified against real Postgres) |
| 2 | Financial engine — unified ledger, budgets, savings, CSV | ✅ Done |
| 3 | Wealth — investments (XIRR), assets, liabilities, net worth, goals, calendar | ✅ Done |
| 4 | Analytics — reports, needs/wants engine, forecasts with disclosed methods | ✅ Done |
| 5 | AI — read-only tools, assistant, monthly review | ✅ Done (needs `AI_API_KEY`) |
| 6 | Knowledge centre (RAG) | Planned — deliberately last (spec Part 7) |
| 7 | Production | Deployment-ready — see `DEPLOYMENT.md` |

See `docs/` for the product narrative.

## Security notes

- Secrets live only in `.env.local` / hosting env vars — never committed.
- Row Level Security is the authorisation boundary; the anon key is the only client-visible credential.
- No banking passwords, UPI PINs, OTPs or card numbers are ever requested or stored.
