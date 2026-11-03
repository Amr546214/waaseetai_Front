# Full site-control implementation — active work

User goal: every tab performs its actual site-control job with shared server state. User constraint: preserve the original platform and leave all deployment to Claude.

## Source and safety boundary

Started this working copy from FE PR #323 (`7fa634fd`, stacked on #322) and BE main (`033c4d2`). Earlier unpublished workspace experiments were not available after the environment resumed; the GitHub PRs are intact. Do not claim earlier local test counts verify this working tree.

No main merge, migration, dev/production/ARB write, identity publish, account change or financial operation. Work remains on `feat/site-control-complete` branches.

A production baseline build of PR #323 is copied to `../site-control-baseline-dist` outside the git repository. Chromium 153 is available locally through the QA-only @sparticuz/chromium package, extracted under the workspace without changing project dependencies. This enables actual browser comparisons.

Broad automatic source-colour rewrites are deliberately not included. New presentation rules must do nothing when no override is published; restored styles must match their captured defaults. Colour binding will be isolated and reversible rather than blindly replacing hundreds of source files.

## Required tab outcomes

- Identity: logos/icons/assets versioning already works; original document plus live/current preview and real editing entry points.
- Colours/values: server-backed canonical values and actual literal-colour consumers; no local Save that changes only this browser.
- Typography: global family plus real text roles, bounded values, actual consumers; selected/hosted fonts must load for visitors.
- Templates: real component presentation, no fictional data/count changes.
- Levels/badges: real ladder data and visual identity. Financial percentages, thresholds, balances and points are domain policy, not visual samples to publish accidentally.
- Preview/style guide: read the same published identity and clearly label sample data.
- Health: actual server manifest/registry/assets, honest errors and contrast limits.
- Export: actual published snapshot and assets/CSS, not local storage.

## Verification gate

Build/type checks, meaningful permission/version/restore tests, actual browser default/custom/restore checks at 1440 and 390 in both themes. Authentication/API mocks must be labelled; they are not a real dev login. Record unresolved items rather than calling the system complete.

## Checkpoint 2026-11-03

Implemented sparse presentation schema (71 groups / 251 fields), reversible literal-colour binding with a source-generated palette (1188 fields; zero source files rewritten), and server editors for colours, typography roles, component templates and level-badge identity. Levels read the real ladder API; no fee/threshold/points policy is editable here. Health and export now read the public server manifest and admin registry rather than local saved samples.

Verified at this checkpoint: backend token tests 8/8, including original effective defaults and injection/bounds checks; frontend tsc; standalone real Chromium CSSOM proof (default untouched, publish, !important, theme isolation and exact restore). JSDOM drops !important when setting var() even outside our runtime; the priority assertion therefore lives in the committed real-browser proof rather than relying on that adapter. No project dependency was added for Chromium.

Still active work: full production app browser comparisons, reader previews and original-guide integration, hosted font bytes, full tab regressions, and meaningful layout controls. Current work is a draft, not a delivery or deployment candidate. The current shared control permissions/version/audit pipeline remains the mutation boundary.

## Restored checkpoint, second environment

Recovered the frontend files byte-for-byte: the staged tree before subsequent improvements matched remote tree `1666eb5ccfc95fd69e8030f43393154197a69ad3`. Working copies now live under `site-control-work/`, leaving the older attachment worktrees unchanged.

Reconstructed the backend on main `033c4d2` with mirrored schema and palette. Fresh token/default/injection/presentation tests pass 11/11. Frontend's initial recovered binding/editor tests pass 29/29. Reader/font additions came afterwards and need their own completed test run.

Subsequent changes: design readers no longer silently load saved browser experiments; isolated preview styles read the public manifest; the original guide exposes a component editor; approved font choices can load via fixed Google Fonts resources after publication (and privately during checked draft preview). Arbitrary font names still need an available font file; no arbitrary font-upload feature has been claimed. Health reports observed stylesheet errors, not guaranteed delivery of every glyph/font file.

External commit creation still cannot run: the automatic review service reports capacity, so no remote branch/PR exists for this checkpoint. Do not bypass review with another write mechanism. Local development continues. Full production build and visual regression are still outstanding; do not call the draft complete or deploy it.

## Verified local tree after restoration

- Production frontend build: exit 0 (CSR and SSR outputs produced).
- Frontend combined targeted suite: 8 files / 43 tests passed. After the final detached-colour cleanup, its own file passed 5/5; these overlap the combined suite, so do not add the totals.
- Backend identity suite with both `SITE_IDENTITY_FE_ROOT` and the effective golden set: 68/68 passed, no skipped tests. Includes allow-list generation versus this frontend, real default fingerprints, upload security, tokens and presentation validators.
- The allow-list update changes only two obsolete local-page glyphs to NO_CONSUMER. All 794 symbol ids and drawing bytes are retained.
- Frontend/backend TypeScript checks emitted no diagnostics. Full repository suites and default/custom/restore production-browser screenshots are not completed for this tree.
- Browser dependency setup and GitHub commit creation encountered automatic-review service capacity/timeout errors. No alternative write/deployment bypass was used. The production output is not a visual proof.
- No shared migration, deployment, main merge, identity customization, account or financial mutation.

This remains a local draft. Remaining acceptance work: real browser comparisons in both themes and widths; review every preview against the published consumers (especially isolated icon samples); validate the original-guide/live-edit experience and layout coverage; assess arbitrary hosted font upload separately from the working approved-font choices. Do not claim universal visual coverage or a complete delivery yet.
