# Vionix — Agent Control Rules

## Workflow control (owner: Ar Kar Moe Myint)

1. **NEVER push to GitHub without explicit approval.** The owner decides when to push.
2. **Test locally before every push.** Run `npx next build`, `npm run test`, AND verify pages work in the local dev server before asking the owner to approve a push.
3. **Ask before destructive actions**: deleting files/tables, changing auth, touching `.env`.
4. When the owner says "push to github" / "commit", that is the only approval moment.
5. After implementing features, summarize what changed and WAIT for the owner's test confirmation.

## Project facts

- Next.js 16.3.1 (App Router, Turbopack), React 19, Tailwind v4
- Database: Neon PostgreSQL (US East) via `postgres.js`, pooled URL, `prepare: false`
- Storage: Cloudflare R2 bucket `vionix-videos` (videos + subtitles)
- Auth: two separate systems
  - Customers: Google OAuth + email/password → cookie `user_session`
  - Admin: password (env `ADMIN_PASSWORD`) → cookie `admin_session`
- Brand name: **Vionix** (not MovieApp)
- Owner: Ar Kar Moe Myint

## Architecture map

- `app/(user)/` — customer site (layout requires user session)
- `app/(auth)/login/` — public login page
- `app/(admin)/admin/login/` — admin login; `app/(admin)/admin/(panel)/` — protected panel
- `app/api/auth/*` — customer auth; `app/api/admin/*` — admin APIs (requireAdmin)
- `lib/db.ts` — all Postgres access (sql.begin for transactions)
- `lib/r2.ts` — R2 storage helpers
- `lib/crypto.ts` — HMAC hashing, AES-256-GCM encryption, timing-safe compare
- API response contract: `{ success: boolean, data?: ..., error?: string }`

## Conventions

- All API routes: try/catch, 401 on unauthorized, generic 500 messages (no internals leaked)
- User data in responses must be `SafeUser` shape only (no hashes/passwords)
- PowerShell note: `[id]` paths need `-LiteralPath`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
