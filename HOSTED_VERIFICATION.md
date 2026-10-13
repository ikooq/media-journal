# Hosted MediaJournal verification — 2026-10-13

Hosted Supabase acceptance flow verified. **True.**

This report supersedes the earlier Auth-blocked results. The final three-account hosted suite and production-browser suite both passed. The frontend was tested as a local production build at `http://localhost:3100`, backed by the real hosted Supabase services; this is not a claim that a public frontend deployment was tested.

The subsequent frontend-only redesign retained this backend baseline. Its production-browser regression run passed 8 cases with 1 expected unconfigured-app skip, including the original collaboration/session/Storage checks. The real hosted suite also passed all 75 checks again. See `FRONTEND_VERIFICATION.md` for the redesign verification, additional responsive/accessibility/timezone tests and the cold-load performance limitation. The original results below remain historical evidence, not a new deployment claim.

## Hosted Supabase

Only MediaJournal (`knqbqaucbuvghptmfazo`, `https://knqbqaucbuvghptmfazo.supabase.co`) was used. The unrelated project was not touched. The ignored `.env.local` provides the dedicated URL, active publishable key, and three disposable accounts. No service-role key was used.

All four hosted migrations are applied in order:

1. `202610130001_initial_schema.sql`
2. `202610130002_backend_integration.sql`
3. `202610130003_domain_api.sql`
4. `20261013103201_hosted_advisor_hardening.sql`

The original migrations were not rewritten or squashed. During earlier progress, the connector rejected the full third migration with an expired request-state error. Its unchanged SQL succeeded in two batches, after which the receipts were consolidated under its original version. Stored SQL hashes were verified against the repository files after trimming trailing whitespace.

The final schema check found 20 public tables, all with RLS enabled. The Realtime publication contains `media_items` and `notifications`.

Advisors were rerun. There are no database security findings or unindexed-FK findings. One Auth warning remains: [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance findings are nine informational unused-index notices; fresh usage statistics are not a reason to remove the covering/security-query indexes.

The CLI target reference is recorded correctly, but authenticated CLI linking still requires `npx supabase login`. Migrations and schema verification used the authorized connected Supabase tools instead.

## Two-Account Flow

A and B used separate Edge browser contexts against the production build. The final UI flow passed:

- A creates a new shared space and invitation; B accepts it through the join page.
- A creates media with both participants. The test waits for the completed save and detail URL before using that URL for B.
- A creates a reflection and rating; B sees the persisted media and reflection.
- B navigates away and back using client-side links, then creates a personal reflection and separate rating.
- Both favorite the media; “Loved by both” appears.
- A sees B's reflection and rating without reloading.
- A replies to B's reflection; B sees the resulting notification without reloading.
- A creates a collection and adds the media.
- A selects watch-together and saves another completed viewing session with both participants. Both pages show both two-participant sessions without a partner reload.
- A saves a valid YouTube link and receives the duplicate warning on repeated preview.
- Library search finds the item; the Calendar shows the persisted activity.
- Clearing localStorage and reopening the detail page leaves the hosted reflection intact.

The separate real-JWT hosted suite also passed the opposite reply/notification direction (B replies to A), collaborative collection contribution/reordering, concurrent and repeated duplicate submissions, and independent personal records.

Hosted search found title, description, tag, category, and note text. Hosted statistics returned the actual fixture counts, including shared moments and loved-by-both. A session at `2026-10-12T20:30:00Z` grouped under October 12 in UTC and October 13 in Asia/Qyzylorda.

## RLS Isolation

The latest hosted suite logged in as real Account C and used its JWT, not service credentials or UI hiding.

Known-ID reads returned zero rows across all 20 public application tables, including spaces, membership, media, notes, replies, sessions/participants, collections/items, ratings/usefulness, favorites, watchlists, notifications, profiles, invitations, categories/tags and their media joins. `media_document` returned null.

C's mutation RPC and direct inserts into media, notes, replies, sessions, ratings, favorites, collections, memberships, and notifications were rejected with PostgreSQL `42501`. Known-ID updates/deletes against media, notes, collections, and ratings affected zero rows. These are database-enforced denials.

A could not update/delete B's note, reply or rating, or delete B's favorite; B's records remained intact. B could contribute to A's collaborative collection, and A could reorder it without changing its contributor.

For both private Storage buckets, C could not download an object, create a signed URL, overwrite it, or actually remove it. Owner re-download proved that C's removal attempt did not delete the object.

Valid invitations worked. Invalid, already-used and revoked tokens failed; non-owner creation and invitation retargeting were rejected. Earlier rollback-only hosted SQL verification also passed the expired-invitation case.

## Auth

Actual hosted signup for A/B passed during earlier progress; email confirmation was completed by the user. C was provisioned and confirmed by the user. No hosted Auth users or confirmation requirements were modified to make these checks pass.

The final browser suite passed for A, B and C:

- Successful login using the configured credentials.
- Closing the original context and restoring its cookies in a new context.
- Reloading a protected route while remaining authenticated.
- Expiring only test-session client metadata, then observing a future expiry and a rotated refresh token after recovery. The signed JWT was not forged.
- Logout, removal of Auth cookies, and redirect from a subsequent private-route request to login.

The real hosted SDK suite independently passed login, refresh, verified user lookup and local-session logout for all three accounts.

Password-reset email delivery/recovery remains separately unverified under the user's permitted mail-delivery exception. No Auth setting was weakened.

## Storage

Real `avatars` and `space-assets` buckets are private, allow JPEG/PNG/WebP and enforce a 5 MB limit.

The final UI tests uploaded and replaced an avatar and a shared-space cover through the application's `/api/assets` route. Returned signed URLs downloaded successfully with the expected image bytes.

Each replacement produced a different object path. Authenticated retrieval of the old object returned 400/404; retrieval of the new object returned 200. No cleanup warning was returned.

The application route rejected SVG, false PNG signatures, oversized files and a cross-origin upload. Separate hosted SDK checks exercised upload, authenticated member download, signed retrieval, upsert replacement, MIME/size restrictions, and C's denied access to both buckets.

## Realtime

Actual authenticated browser frames were observed: **A received 27 and B received 31** media/notification frames in the final UI run. The assertions also require both table types for each account.

Partner reflections, ratings/favorites, reply notifications and the additional viewing session appeared without manual reload. Client-side navigation did not break delivery. No subscription error, unhandled page error or browser-console error occurred in the passing product run.

The final hosted SDK run observed **A: 25 events; B: 24 events; C: 0 events** while C subscribed using known Space 1 identifiers. RLS prevented outsider delivery. All SDK channels were removed successfully and each client reported zero remaining channels.

Subscriptions remain scoped by media space and notification recipient. Note/reply/personal mutations invalidate the scoped media row; those tables are not broadly published. Browser subscriptions are disposed on unmount/space changes and use the current route's refresh callback.

## Tests

All commands ran in this repository with the dedicated hosted configuration.

| Command                | Final result                         |
| ---------------------- | ------------------------------------ |
| `npm run lint`         | Passed                               |
| `npm run typecheck`    | Passed                               |
| `npm run format:check` | Passed                               |
| `npm run test`         | 47 tests passed across four files    |
| `npm run test:db`      | 20 database tests passed in PGlite   |
| `npm run test:hosted`  | 75 real hosted checks passed; exit 0 |
| `npm run test:e2e`     | 4 passed, 1 expected skip; exit 0    |
| `npm run build`        | Passed; optimized production build   |

The 20 database cases are also included in the 47-test run; the counts should not be added together.

Production browser commands:

```powershell
npm run start -- --port 3100 --hostname 127.0.0.1
$env:E2E_BROWSER_CHANNEL='msedge'
$env:E2E_BASE_URL='http://localhost:3100'
npm run test:e2e
```

The one skipped case tests missing configuration and intentionally does not run with hosted keys present. No hosted acceptance case was skipped. The temporary production test server was stopped after verification.

The latest hosted fixture is recorded in ignored `output/hosted/hosted-verification.json` (run `df1c2250-e028-4bda-8e27-1968b527841d`). Test resources remain in isolated named test spaces for inspection; direct SDK test image objects were cleaned up.

Hosted logs were inspected. The API security run produced the expected invalid-invite `22023` and denied-operation `42501` errors, with no HTTP 5xx in the checked window. In the final browser window, three permission denials for in-flight collection/notification reads occurred immediately after the successful 16:05:02 UTC logout; the protected-route and cookie-removal checks passed. These post-logout reads were denied, not granted. No further database errors were logged in the checked collaboration window. The passing product test recorded no hydration, Realtime, image-resource or unhandled-promise errors.

Source scans found no localStorage, sessionStorage, IndexedDB, demo/mock seed content or browser-only journal persistence in `app`, `components` or `lib`. Auth/preference cookies are not journal-content storage.

## Fixes Made

Hosted/browser verification identified and fixed:

- Refresh races: overlapping invalidations cancelled useful reads and left partner details stale. Refreshes now coalesce, with a trailing read and route/space guards. Four regression tests cover batching, overlap, subsequent refreshes and failure recovery.
- Serialized refresh reads: independent client Server Actions queued behind each other and delayed save completion. One authenticated server snapshot action now runs those reads concurrently while retaining the existing authorization checks.
- Realtime startup/lifecycle: restored cookie sessions could join before authorization was ready, causing a PostgreSQL subscription error. Authorization is awaited before joining; the channel stays stable across route changes, uses a unique instance name, catches subscription failures and refreshes after subscription/reconnection.
- Test navigation/wait races: save dialogs and final detail URLs are awaited before proceeding; partner checks no longer rely on reloads.
- A malformed YouTube fixture caused four thumbnail 404s. Its missing final ID character was corrected, the image returned HTTP 200, and the full suite passed with console checks still enabled.
- Hosted test logout uses local-session scope, suites run sequentially, and SDK clients disconnect cleanly.

Earlier progress also added the forward advisor-hardening migration and repaired the missing favicon. No frontend redesign, application-data fallback, or Auth/RLS/Storage policy weakening was introduced.

## Remaining Limitations

- Password-reset email delivery/recovery has not been verified. Configure appropriate SMTP capacity and complete the real email-link flow before treating recovery mail as verified.
- The Auth advisor still reports disabled leaked-password protection; review the linked remediation.
- Authenticated Supabase CLI operations require login; the target is recorded and hosted migrations are already applied.
- Testing used a local production frontend with hosted Supabase. A public frontend deployment/domain was not part of this run.
