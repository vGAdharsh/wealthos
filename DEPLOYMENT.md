# Deploying WealthOS to production

Target: **Vercel (free Hobby) + Supabase (free tier)** — no paid services required.

## 1. Supabase (database + auth)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. SQL Editor → run each file in `supabase/migrations/` in order
   (`0001_foundation.sql`, `0002_ledger_budgets_savings.sql`, `0003_wealth_goals_calendar.sql`).
   Every user-owned table gets Row Level Security — verified by test (see `docs/`).
3. Authentication → Providers → Email: enable. For personal use, you can disable
   "Confirm email" to skip SMTP setup, or keep confirmation on.
4. Project Settings → API → copy **Project URL** and **anon public** key.

## 2. Vercel (hosting)

1. Push this branch to GitHub and merge or select it on import.
2. [vercel.com](https://vercel.com) → Add New → Project → import the GitHub repo
   (framework auto-detected: Next.js).
3. Environment Variables (Production + Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase step 4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase step 4 |
   | `AI_API_KEY` | your OpenAI-compatible key (optional; enables the AI assistant) |
   | `AI_MODEL` | optional (defaults to `gpt-4o`) |
   | `AI_BASE_URL` | optional, for alternative providers |

   The anon key is public-by-design (RLS is the security boundary). **The AI key
   is server-side only** — it is read in route handlers, never prefixed
   `NEXT_PUBLIC_`, so Vercel never ships it to the browser.
4. Deploy. Vercel runs `npm run build` (lint + typecheck + tests run in CI first).

## 3. Verify after first deploy

- Sign up → confirmation email (if enabled) → sign in.
- Add an income and an expense → check the Overview updates.
- Import a small CSV → check duplicates are skipped.
- Create a budget, add spending → check the utilisation bar.
- Open two browsers with different accounts → confirm neither sees the other's data (RLS).
- If `AI_API_KEY` is set: ask the assistant "How much did I spend this month?"

## 4. Backups & rollback

- **Database:** Supabase → Database → Backups (daily on free tier). Also export
  all transactions as CSV from Settings → Your data before major changes.
- **Code:** every deploy is immutable on Vercel; roll back from
  Vercel → Deployments → … → Promote to Production, or `git revert` + redeploy.

## 5. Custom domain (optional)

Vercel → Settings → Domains → add your domain and follow the DNS instructions.
No code changes needed.
