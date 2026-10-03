# Arabic text clipping in buttons / nav / tabs

**Symptom:** Arabic labels (header "دخول" / "تسجيل حساب", CTAs such as "ابدأ مجانًا الآن", the marketplace
category strip, tabs) look cut off at the bottom, or sit low in their pill.

## Root cause (measured, not guessed)
Measured in Chromium with canvas `measureText` at 100px for the bundled font
(`public/assets/fonts`, served under the family name `Tajawal`):

| face | font box above / below baseline | real glyph extent above / below | effect |
|---|---|---|---|
| Bold (600-900, used by buttons, nav, tabs) | **1.20em** / 0.27em | 0.94em / 0.21em | box is top-heavy: text sits ~0.18em **low** in its line box, descenders hug the bottom edge |
| Regular (400) via Google Fonts `Tajawal` | 0.64em / 0.36em | **0.92em** / 0.38em | glyph tops overshoot the box by ~0.28em |

Anything with `overflow:hidden/auto` (ellipsis, `line-clamp`, horizontal scrollers) and a tight `line-height`
then cuts the marks. Different browsers/OSes take the vertical metrics from different tables, so the same CSS
looked fine on one machine and clipped on another.

## What changed (layered)
1. **Root: `@font-face` metric overrides** (`src/styles.css`): both bundled faces get
   `ascent-override: 98%; descent-override: 40%; line-gap-override: 0%`. Every platform now uses the same balanced box
   (glyphs 0.94em / 0.21em fit inside 0.98em / 0.40em), so text is centred in buttons and nothing overshoots.
   Supported by Chromium and Firefox; where a browser ignores the descriptors the layers below still apply.
2. **Shared safety net** (`src/styles.css`, zero specificity via `:where()`):
   `.truncate`, `.ws-text-safe` get `padding-block:.12em; margin-block:-.12em` (room for the glyphs, layout unchanged);
   `[class*="line-clamp-"]` gets top room only (a bottom padding would reveal the hidden next line).
3. **Components that actually clipped** (all get `line-height >= 1.4` plus layout-neutral room):
   marketplace quick-category strip (`.quick-cats-inner` is `overflow-x:auto`, which also crops vertically) and
   `.qcat-name`; marketplace clamped `.svc-title`; category-guide `.mini-name`; `.udrop-acc-name` in `navbar` and
   `nav-dashboard`; archived-projects `.pl-ttl`; business-models market `.mkt-card-title`.

## Verification
* **Clip detector** (`tools/ui-clip-check/clipdetect.mjs`, Playwright, 10 public pages x desktop + mobile, ~1,600
  Arabic text nodes): clipped texts **5 -> 0** (qcat-name x3, svc-title, mini-name).
  Dashboard (mocked empty API, 5 provider pages): 0 before and after.
* **Layout drift** (same pages, element by element): document height changes within +-6px on all pages except
  `/marketplace` (+4px desktop, +12px mobile, from `.svc-title` 1.35 -> 1.4).
* **Static regression guard:** `src/app/ui-arabic-text-clipping.static.spec.ts` (8 tests): the metric overrides stay,
  the safety-net utilities stay, the fixed components keep their room, and no NEW rule may combine
  `text-overflow:ellipsis` / `-webkit-line-clamp` with `line-height < 1.4` without padding room. Verified to fail when
  the overrides are removed or a tight clipped rule is added.
* Screenshots: `docs/images/ui-arabic-text-clipping/` (category strip and header buttons, before/after).

## Not verified / follow-ups
* Only Chromium on macOS was available. **Safari, Firefox and Windows must be checked by eye** (especially the header
  buttons and the CTA). Safari support for the `*-override` descriptors should be confirmed.
* Typography inconsistency found on the way (not changed - design decision): `index.html` loads Google Fonts
  `Tajawal` 400/500/700/800/900, which coexists with the local face under the same family name, so weight 400 text
  renders in Google's Tajawal while weights 600-900 render in DIN Next LT Arabic. Removing the Google link would make
  the UI use the bundled font everywhere (and work offline) but visibly changes body text.
* Hero headlines (`line-height:1.15`, 42-68px, inside `overflow:hidden` hero blocks) are not clipped today; 8 such
  cases are logged by the detector as "tight but not clipped".

## Follow-up: visible hero / header / CTA breathing room

The global font fix alone was hard to see in the hero, so the hero title and the buttons get explicit room too
(screenshots: `docs/images/ui-arabic-text-clipping/*-before.png` vs `*-after.png`, 3x, Chromium):

- `.hero h1 .gradient` / `.hero-main-text`: `display:inline-block; width:100%; line-height:1.35; padding-block:.14em` (gradient `background-clip:text` box now extends past the glyphs; before, the tail of «وسيط» fell 6.8px outside it at 68px).
- Hero CTA buttons: `padding-block 19px` (mobile 12px + `min-height:56px`), `line-height:1.45`.
- Header `.nav-cta-sm` / `.btn-outline-sm`: `inline-flex; align-items:center; line-height:1.45; padding-block 9px`; `.nav-link`: `line-height:1.45; padding-block 8px`.
- Trade-off: hero title block is taller (~+32px per line on desktop); header stays 64px.
