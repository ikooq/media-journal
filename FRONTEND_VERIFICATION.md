# Frontend redesign and production verification — 2026-10-13

## Scope and design

Implemented the supplied frontend specification in the existing application. Home, Library, Media Detail, Calendar, Us, Add Media, Collections, authentication, onboarding, profile/space settings, and the shared navigation/components now use one editorial design system.

Limestone backgrounds, olive actions, restrained Noto Serif headings, readable Noto Sans body text, real artwork, quieter separators and generous but responsive spacing replace the former dashboard-like presentation. There is no stock-content seed, fabricated milestone, placeholder rating, new backend feature, or browser-persistence fallback. Names and imagery in test screenshots belong to the disposable acceptance accounts/fixtures, not invented production users.

`DESIGN_SYSTEM.md` documents tokens, component behavior and integrity rules. The existing production data-access, Auth, Storage, Realtime, domain and database architecture were retained. SHA-256 comparisons of all 15 protected files (actions, middleware, provider, data/Supabase modules, domain types and four migrations) remained identical to the pre-redesign baseline. No migration or hosted policy/configuration changes were made for this frontend work. Only MediaJournal (`knqbqaucbuvghptmfazo`) was used.

## Responsive and interaction verification

Browser checks use installed Edge/Chromium and a local Next production server backed by hosted Supabase, not the development server or mocked APIs. No public frontend deployment is implied.

- Eight widths: 320, 375, 390, 430, 768, 1024, 1280 and 1440px.
- 72 private route/width combinations: Home, Library, Calendar, Us, Collections, profile settings, space settings, Media Detail and collection detail.
- A further 32 combinations cover login, signup, forgot-password and reset-password layouts.
- No horizontal page overflow. WCAG A/AA automated scans cover major screens and search/filter/add dialogs; keyboard and touch tests supplement, not replace, those scans.
- A real touch-enabled 390px context creates media with both participants, saves a long multi-paragraph reflection containing Kazakh characters, opens its Calendar activity, navigates days by keyboard, and opens Us.
- Dialog initial field focus, Tab containment, Escape/focus return, radio-style segmented arrow keys, mobile bottom navigation, mouse-only tilt, actual global search/no-results and reduced-motion behavior are checked.
- UTC+14 and UTC−12 contexts verify local-day selection and hydration without clock/timezone warnings.

## Frontend issues fixed during verification

- Preserved navigation/save waits in the media-creation flow; audits now wait for the destination URL and document title instead of sampling a page mid-navigation.
- Added explicit native-dialog focus containment/return and delayed intended-field autofocus until the dialog is open.
- Corrected non-semantic ARIA names on avatars, statistics, loading states and image previews.
- Raised secondary-text contrast and selected readable initials for existing participant colors.
- Reserved missing-artwork row width; corrected the book-form fallback's positioning.
- Removed a metadata fallback instruction from the saved subtitle presentation/input path; genuine descriptions remain unchanged.
- Corrected server/browser timezone hydration mismatches with deterministic `<time>` snapshots and browser-local Calendar/activity initialization. No hydration-warning suppression was used.
- Aligned the Home loading skeleton with its featured layout, and exposed query loading states to assistive technology.
- A layout-shift trace identified the decorative footer moving from the short loading fallback to below the full page. It remains hidden while the workspace is busy, rather than briefly appearing in the middle of a loading screen.

## Performance audit

`scripts/audit-performance.mjs` records cold-cache local production samples for Home, Library and Us at 390px (4× CPU slowdown) and 1440px (normal CPU), against real hosted Supabase. It collects LCP, session-window CLS, TTFB, resource transfer and observed click duration. No network emulation. These are single lab samples, **not field Core Web Vitals or a field INP result**.

Frontend safeguards include separately loaded Motion features, no WebGL/3D runtime, reduced-motion support, transform-based effects, self-hosted subset fonts, responsive approved-host image optimization, prioritized featured artwork, bounded existing lists and reserved image geometry. Private signed images keep the original browser-fetch access mechanism.

Final cold-cache samples:

| Route / viewport        | LCP     | CLS    | TTFB   |
| ----------------------- | ------- | ------ | ------ |
| Home / 390px, CPU ×4    | 7.904s  | 0.0046 | 3.718s |
| Library / 390px, CPU ×4 | 11.376s | 0.0002 | 3.389s |
| Us / 390px, CPU ×4      | 4.500s  | 0      | 3.525s |
| Home / 1440px           | 5.044s  | 0.0032 | 3.029s |
| Library / 1440px        | 9.464s  | 0      | 3.399s |
| Us / 1440px             | 3.612s  | 0      | 3.405s |

Earlier sampling recorded CLS 0.1257 on Us; a subsequent trace identified the loading footer moving out of the viewport. The final samples contain no individual shift larger than 0.005 after the loading-footer fix. This is lab evidence, not a field percentile guarantee.

Cold-load LCP remains above the 2.5s target. Hosted/server wait and subsequent existing authenticated client-data loading both contribute; this work did not replace the stable data-access architecture to hide that limitation. Cold JS transfer was 288–289 kB and loaded font transfer 71 kB. Observed single-click durations were 112–264ms under ×4 CPU and 40–72ms on desktop; the 264ms Home sample is another reason not to claim field INP passed. These samples are not a multi-user/public-deployment performance study.

## Remaining verification boundaries

- Real-device iOS Safari/Android soft-keyboard, browser chrome and safe-area behavior require device testing; touch/viewport emulation is not equivalent. Automated accessibility scans are not a full screen-reader audit.
- A public deployment and field Core Web Vitals have not been tested. Cold LCP is a real outstanding performance limitation.
- Matching artwork framing/layout IDs provide continuity; guaranteed cross-route shared-element animation is not claimed with the existing Next navigation lifecycle.
- The existing password-reset email-delivery exception, disabled leaked-password protection warning and documented backend pagination limits are unchanged; see `HOSTED_VERIFICATION.md`.

## Final commands and evidence

| Command                                                                                                      | Actual result                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                               | Passed, no errors                                                                                                                |
| `npm run typecheck`                                                                                          | Passed                                                                                                                           |
| `npm run format:check`                                                                                       | Passed                                                                                                                           |
| `npm run test`                                                                                               | 51 passed, 5 files                                                                                                               |
| `npm run test:db`                                                                                            | 20 passed                                                                                                                        |
| `npm run test:hosted`                                                                                        | 75 passed, real A/B/C JWTs; A 25 events, B 24, C 0                                                                               |
| `npm run build`                                                                                              | Passed; first-load JS 230–246 kB on the redesigned major routes                                                                  |
| `npm run test:e2e`                                                                                           | 8 passed, 1 expected unconfigured-app skip, 9.2 minutes                                                                          |
| `npm run test:e2e -- tests/e2e/auth-storage.spec.ts --grep 'application avatar' --output=output/upload-a11y` | 1 passed after the final semantic preview-role adjustment; four successful-upload accessibility scans                            |
| `npm run test:e2e -- tests/e2e/frontend.spec.ts --grep 'frontend routes' --output=output/frontend-final`     | 1 passed after the loading-footer rule; 72 route/width combinations, accessibility, actual hover tilt and keyboard/hosted search |
| `npm audit --omit=dev`                                                                                       | 0 production vulnerabilities                                                                                                     |

Browser commands used PowerShell environment variables `E2E_BROWSER_CHANNEL=msedge` and `E2E_BASE_URL=http://localhost:3100`, with `npm run start -- --port 3100 --hostname 127.0.0.1` serving the production build. The full suite passed before the final image-preview ARIA role adjustment, unused-import removal and loading-footer visibility rule. The affected Storage/accessibility case passed after the preview adjustment; subsequent focused responsive/performance checks cover the footer rule. No later domain, query, authentication or subscription behavior changed.

The original two-account product flow passed unchanged: real space/invite onboarding, media creation/detail navigation, independent notes/ratings/favorites, loved-by-both, reply notifications, collaborative collections, watch-together/session participants, duplicate preview, hosted Library search and Calendar persistence. A received 27 and B received 31 actual browser media/notification frames. Partner updates appeared without reload; no page, console or subscription errors occurred. The three-account cookie restoration, refresh-token rotation, logout and protected-route tests passed. Avatar and cover replacements still deleted the prior hosted objects; invalid file/signature/size/origin rejection remained intact.

The hosted suite again rejected outsider known-ID reads/writes across all 20 public tables and private Storage, rejected attempts to modify another member's personal records, and observed no outsider Space 1 Realtime events. No weakened policy or administrative JWT was used.

Evidence:

- `output/hosted/hosted-verification.json`: 75 actual hosted results and scoped Realtime observations.
- `test-results/`: desktop/mobile responsive screenshots from the passing full suite.
- `output/playwright/after/`: final production screenshots; `scripts/capture-ui.mjs` reproduces them.
- `output/playwright/performance.json`: lab samples; `scripts/audit-performance.mjs` reproduces them.

**Hosted Supabase acceptance flow verified. True.** This is functional hosted acceptance, not a claim that the cold-load performance target or every physical-device/browser combination passed.
