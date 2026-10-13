# our shelf

A private shared media journal built with Next.js 15 App Router, React, strict TypeScript, Tailwind, and Supabase. The original visual design is retained. PostgreSQL is the source of truth; there is no local content database or demo mode.

## Start locally

Requirements: Node 22+, npm, and a Supabase project. Docker Desktop or Podman is needed only for the full local Supabase stack. PostgreSQL/RLS tests also run without Docker through PGlite.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The publishable key is intentionally public; no service-role key is used. Missing configuration displays a setup screen and never falls back to browser storage.

For local Supabase:

```sh
npx supabase start
npx supabase db reset --local
npx supabase status
npm run dev
```

`db reset --local` destroys only the local development database and reapplies all migrations. Do not use it against a production database. Copy the URL/publishable key printed by the local stack into `.env.local`. Use `http://localhost:3000`; local mail is available at `http://localhost:54324`. Local email confirmation is disabled for convenient test signup. Enable confirmation and configure SMTP on hosted projects.

If using a hosted development project, apply migrations with the linked-project commands in the production section, then run `npm run dev`.

Development writes `.next-dev`; production builds write `.next`, avoiding the previous dev/build output collision.

## First account and shared spaces

Sign up at `/signup`. The auth trigger creates a profile; onboarding saves the display name and atomically creates a space, owner membership, and the default categories. A repair migration also backfills profiles for auth users created before installation.

In Space settings, an owner can create a one-use invitation link. Share it privately with your partner. The partner signs in or signs up, then accepts the link. Tokens have 256 bits of randomness, only SHA-256 hashes are stored, and they expire after seven days. Owners can revoke unused invitations. The application does not pretend to send invitation emails; delivery is by copying the link. Users can create more spaces and switch active spaces through the account menu. The active-space cookie is validated against membership on every server operation.

## Architecture and data flow

- `app/(private)/layout.tsx` verifies the server session and loads profiles, spaces, memberships, and taxonomy. Route groups preserve the original URLs.
- `middleware.ts` uses Supabase SSR cookies and verified claims to refresh sessions and redirect protected routes. The private layout and every sensitive action additionally call `getUser()`.
- `app/actions.ts` is the validated server boundary; `lib/data/server.ts` centralizes authentication, authorization, queries, and error mapping. Acting user IDs always come from Auth, never browser input.
- `lib/data/client.ts` also handles server-action transport failures. `WorkspaceProvider` is an in-memory query cache and invalidation layer, never persistent storage.
- Transactional invoker RPCs create media, taxonomy, sessions/participants, and related actions. Their database operations retain RLS. The unique `(space_id, canonical_url)` constraint handles racing duplicate submissions.
- Library/search and collection contents are paginated at 24 cards per request. Search runs in PostgreSQL across titles, descriptions, author/channel, taxonomy, and note bodies. Detail projections bound notes/replies/history, so a card never downloads all journal text.
- Home/Us metrics, category/user breakdowns, streaks, and the heatmap use SQL aggregates. Calendar queries monthly counts separately from paginated daily timelines. Timestamps are stored with timezones; grouping uses the browser’s IANA timezone.
- Safe optimistic favorites and notification acknowledgement roll back on failure. Reflection/reply drafts clear only after confirmed saves. Mutations invalidate affected queries and private Next.js paths.

## Migrations and types

Apply every migration in order. The original migration is unchanged:

1. `202610130001_initial_schema.sql`: original tables, Auth trigger, indexes, and avatar bucket.
2. `202610130002_backend_integration.sql`: repaired ownership policies, immutable scope, compound foreign keys, normalized taxonomy, invitations, transactional notification triggers, storage restrictions, rate limiting, and Realtime publication.
3. `202610130003_domain_api.sql`: atomic mutations, bounded read projections, paginated search, statistics, and calendar RPCs.
4. `20261013103201_hosted_advisor_hardening.sql`: pinned trigger-function search path and covering indexes for hosted-advisor foreign-key findings.

`types/database.ts` is a maintained representation of the schema. Generate from a running local database or linked project:

```sh
npm run db:types
npm run db:types -- --linked
npm run typecheck
```

Generation preserves the existing file if the CLI fails. New migrations should be created with `npx supabase migration new descriptive_name`. The seed intentionally contains no accounts, passwords, or personal content. Default categories are created once during space creation.

## Authentication

Email/password login, signup, logout, forgot/reset password, cookie session restoration, and refresh are implemented. `/auth/callback` exchanges PKCE codes; `/auth/confirm` supports token-hash email verification. Redirect destinations are restricted to local paths. Password reset is reachable with an authenticated recovery session and is not redirected away by middleware.

For email links that work across browsers/devices, set Supabase’s confirmation template to:

```html
<a
  href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/"
  >Confirm your account</a
>
```

Recovery template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
  >Reset your password</a
>
```

The standard PKCE confirmation URL also works through `/auth/callback` when opened in the initiating browser. When a signup email is needed during invitation acceptance, reopen the invitation link after confirming the account.

## Storage

Profile settings and Space settings upload JPEG, PNG, or WebP images through `/api/assets`. Uploads are authenticated, same-origin checked, limited to 5 MB before parsing, and validated using both MIME and file signatures. Storage uses unique paths (`user_uuid/random_uuid.ext` or `space_uuid/random_uuid.ext`), private buckets, and one-hour signed URLs. Old files are cleaned up after a successful profile/cover update; failed database writes remove the new upload. Cleanup failures report a warning without claiming the upload failed.

The migrations create/configure `avatars` and `space-assets`; no dashboard-only bucket setup is needed. Avatar writes are owner-only; current space members can read each other’s avatars. Shared asset access requires membership. No base64 image content is stored in PostgreSQL.

Known provider images use Next Image optimization. Arbitrary Open Graph images and private signed storage assets deliberately use the isolated `MediaImage` unoptimized path, so the server’s image optimizer never fetches arbitrary URLs.

## Notifications and Realtime

Database triggers fan out notifications in the same transaction as media creation, notes, replies, and “watch together” intent. Actors never receive their own notifications. Replies notify the note author. Unread counts, lists, mark-one, mark-all, and navigation are database-backed. Browsers cannot insert notification rows or change their payloads.

The workspace subscribes only to the active space’s media invalidations and the signed-in user’s notifications. Personal mutations touch the parent media row, so notes, replies, ratings, favorites, progress, and watchlists refresh from authoritative queries. Subscriptions are debounced and cleaned up. Queries also refresh on browser focus. Collection/profile/space edits appear to other members on normal refresh/focus; these tables are not globally subscribed.

## Security and metadata

All public tables use RLS. Private-schema membership helpers avoid recursive membership policies. Notes/replies and personal ratings/favorites/watchlist rows enforce their authors/owners for writes and deletes. Immutable-scope triggers and compound foreign keys prevent reassignment and cross-space references. Guarded private definer functions are limited to onboarding, invitations, notification fan-out, and the distributed metadata limiter; callable public wrappers are invoker functions with explicit authenticated-only grants.

Metadata extraction requires a session and active membership, and the database limits users to 20 requests/minute. The transport resolves all DNS answers, rejects private/reserved addresses, pins the validated address to the connection, rechecks each redirect, restricts ports and credentials, and bounds elapsed time and response bytes. Failures leave manual entry available. The optional server-only `YOUTUBE_DATA_API_KEY` enables official YouTube title/channel/duration metadata. Movie/book adapters retain the existing editable manual fallback; no unused provider key is required.

Application routes are noindex and private/no-store. There are no invasive analytics. Structured logs record database error codes without tokens, passwords, or note text.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run format:check
npm audit --omit=dev
```

PGlite tests execute the real migration SQL and switch to distinct `anon`/`authenticated` roles. Fixtures provide minimal Auth/Storage schemas; only the unavailable pgcrypto extension statement is omitted (Postgres already supplies UUID generation). Tests cover isolation, author mutations, personal records, duplicates, rollback, invitation single-use rules, cross-space constraints, collection ordering, notifications, and timezone grouping. This verifies PostgreSQL behavior; it does **not** verify GoTrue, Storage HTTP, Supabase Realtime delivery, or a hosted project configuration.

Full-service checks with Docker/local Supabase:

```sh
npx supabase db lint --local
npx supabase db advisors --local
npx playwright install chromium
npm run test:e2e
```

The browser suite checks unconfigured setup only when keys are absent; with keys it checks unauthenticated redirects. The full hosted suite requires three confirmed disposable accounts in ignored `.env.local`: `E2E_EMAIL`/`E2E_PASSWORD`, `E2E_PARTNER_EMAIL`/`E2E_PARTNER_PASSWORD`, and `E2E_OUTSIDER_EMAIL`/`E2E_OUTSIDER_PASSWORD`. Run `npm run test:hosted` first, then `npm run test:e2e` sequentially, not as overlapping Auth-mutating suites. The browser tests cover restored cookie sessions, refresh-token rotation, logout, actual application avatar/cover replacement and old-object cleanup, plus two-context collaboration with live partner updates, invitations, notes/replies/ratings/favorites, sessions, collections, duplicates, search and Calendar persistence. Missing credentials or skipped cases are not evidence of hosted acceptance. Run against a test project because it creates data. `E2E_BASE_URL` targets an already-running production server; `E2E_BROWSER_CHANNEL=msedge` or `chrome` selects an installed browser.

## Production: Vercel + Supabase

1. Create a Supabase project and keep anonymous sign-in disabled.
2. Copy its URL and publishable key into local/Vercel environment variables. Only these two variables are required by the app.
3. Apply migrations from this checkout:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --dry-run
   npx supabase db push
   ```

4. Confirm private `avatars`/`space-assets` buckets, MIME restrictions, and 5 MB limits created by the migrations.
5. Enable email confirmation and configure an SMTP provider in Supabase for production mail delivery.
6. Set Auth’s Site URL to the final HTTPS application domain.
7. Allow the exact production `/auth/callback`, `/auth/confirm`, and `/reset-password` URLs (and your local URLs on a separate development project). Use the templates above for token-hash recovery/confirmation.
8. Optionally set `YOUTUBE_DATA_API_KEY` in Vercel; it must never use a `NEXT_PUBLIC_` prefix.
9. Import this Git repository into Vercel as Next.js with `npm ci` and `npm run build`; configure the required variables for each environment. Deploy only after migrations have succeeded.
10. Add the production domain in Vercel and complete its DNS setup.
11. Update Supabase Site URL/allowed redirect URLs to the exact final domain. Add preview-domain redirects only for previews you intend to support; avoid broad production wildcards.
12. Run `npx supabase db advisors --linked`, the database tests, and the two-account browser suite against a disposable project with the same migrations. Verify an unrelated account cannot read the shared space before adding private journal data.

No deployment or hosted RLS verification is implied by a successful local build. Back up existing hosted databases before applying new migrations. Existing taxonomy duplicates are merged without deleting media; existing conflicting watchlist intents prefer “together.”

## Remaining operational limits

- The dedicated hosted project is `MediaJournal` (`knqbqaucbuvghptmfazo`). Local configuration targets it exclusively. The unrelated `ilpkqnrhrflnolxyklja` project is off-limits.
- Hosted Supabase acceptance passed on 2026-10-13: 75 real three-account hosted checks, plus production-browser collaboration, cookie persistence/refresh/logout, Storage replacement/cleanup and live Realtime updates. Final E2E results were 4 passed and 1 expected missing-configuration skip. See `HOSTED_VERIFICATION.md` for scope, exact results and evidence. Password-reset email delivery remains unverified, and the Auth advisor still warns that leaked-password protection is disabled. No application-data fallback or weakened policy was introduced.
- The CLI target reference is recorded, but authenticated CLI operations require `npx supabase login`. The connected Supabase tools were used to apply migrations; their stored SQL hashes match the repository files after trimming trailing whitespace.
- Detail history is bounded to the latest 100 sessions, 200 notes, and 100 replies per note. The full records remain in PostgreSQL. Library, collection-content, and calendar queries are paginated.
- The collection overview is capped at 100 collections. This is independent of the paginated media library.
- Invitation links are delivered manually; no external email invitation service is configured.
- The pinned Next 15 lint toolchain currently has upstream development-only `braces`/`micromatch` advisories without a compatible patched release. Production PostCSS is pinned through an override; verify with `npm audit --omit=dev`. Do not run development lint servers on untrusted content.

## Browser storage inventory

The application contains **zero** `localStorage`/IndexedDB usages. Supabase SSR stores session tokens in cookies. The active-space cookie stores a preference, and PostgreSQL membership is still checked. Unsaved editor text lives only in component memory. An E2E test clears localStorage solely to prove it is not authoritative.

## Frontend design and verification

The editorial redesign retains the verified backend. See `DESIGN_SYSTEM.md` for the limestone/olive palette, Noto typography, responsive components, accessible dialogs and reduced-motion behavior. `FRONTEND_VERIFICATION.md` records the frontend fixes, production-browser matrix, regression commands and the measured cold-load LCP limitation.

With the production server running and disposable hosted accounts configured:

```sh
E2E_BASE_URL=http://localhost:3100 E2E_BROWSER_CHANNEL=msedge npm run test:e2e
E2E_BASE_URL=http://localhost:3100 node scripts/capture-ui.mjs
E2E_BASE_URL=http://localhost:3100 node scripts/audit-performance.mjs
```

In PowerShell set `$env:E2E_BASE_URL` and `$env:E2E_BROWSER_CHANNEL` before running those commands. Browser tests create real labelled acceptance fixtures; screenshots and performance JSON remain ignored under `output/`. Run performance sampling separately from Auth-mutating suites. Local browser lab measurements do not establish field Core Web Vitals or physical-device Safari behavior.
