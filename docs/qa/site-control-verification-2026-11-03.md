# Site control verification — 2026-11-03

This review starts from `main` at `fada0283`. The identity changes from FE #318 (`134e59f4`) are already ancestors of this branch. The reported dev heads remain BE `e2d49c4` / FE `134e59f4`; this review did not deploy or read/write the dev database.

## Current source inventory

`node tools/icon-usage-report.cjs --write` reports 774 bound identifiers, 104 unused library identifiers (20 symbols + 84 library-only slots), and 15 excluded places. These are source counts, not a live-dev inventory. Unused identifiers remain available as drawings and are not deleted.

The excluded places preserve runtime data (charts, ratios, ratings, data-selected paint), specialty-owned artwork, or existing empty defaults. Specialty icons belong to specialty management; replacing a functional chart with a static image would remove its meaning. The generated inventory lists each file and reason.

## Changes in this review

- Remove obsolete UI claims that CSS select arrows and external login marks are unbound. The select arrow follows `pl-shared-select-arrow`, Google and Apple have their own keys, and the AI mark is edited under Identity.
- Explain unused library entries separately from excluded functional drawings.
- Replace the generic “breaks Angular” explanation with a description of the data that a static replacement could hide.
- Exercise the actual SVG markup from all four marketplace card variants and the marketer-profile background through the icon runtime. Check custom drawing, viewBox, preserved placement and exact DOM restoration.
- Exercise all three registered select-arrow colours, including `6b7699`, and removal of their CSS overrides on restore.
- Map a real AI notification payload, insert its trusted SVG, apply the AI identity runtime, and verify exact restoration without altering its title.

## Proof boundaries

The new tests exercise the runtime with real source SVG and notification markup in the Angular test DOM. They do not render full marketplace/profile pages with real data, prove browser pixels, or perform admin upload/publish/restore against a server. Source markup extraction is deliberately not described as a full-page end-to-end test.

Chromium installation failed in this environment. No browser screenshots, dev admin session, real mail delivery, or cross-session live-dev update are claimed by this review. No identity asset, account, permission, financial setting, or migration was changed.

## Live checks still needed

Using an authorized admin session on dev, preview and publish a temporary drawing, verify it from a separate ordinary session, reload, then restore. Cover a marketplace card for each variant, a marketer profile with its background, an AI notification, and a rendered select using the third colour. Record the original identity version and restore only the tested key; do not overwrite a concurrent administrator's change.

## Validation results

- Identity, site-control and notification-engine selection: 329 tests, 318 passed, 9 skipped, 2 initially failed in the newly added DOM assertion and the edited explanatory copy.
- Both affected files after correction: 23/23 passed. The DOM assertion compares identical elements, attributes and children with `isEqualNode`; it ignores attribute serialization order, which changes when `preserveAspectRatio` is restored and has no rendering effect. No monetary or permission assertion was changed.
- Generated usage report matches the sources (`--check`). No backend or complete frontend suite was rerun for this explanation-and-test-only change.
