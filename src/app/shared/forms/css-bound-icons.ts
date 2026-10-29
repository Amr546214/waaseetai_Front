/**
 * Icons that stylesheets draw as a CSS background (the arrow of every native `<select>`): key -> the stroke colours the stylesheets give it (lower-case hex).
 * It lives with the consumers, NOT in core/identity: the icon allow-list generator only counts a key as followed when a consumer file names it, and the stylesheets themselves are not scanned.
 * The runtime (core/identity/identity-icon-symbols.ts) publishes one custom property per colour while the key is customised; every stylesheet rule reads
 * `var(--ws-icon-<key>-<hex>, url(<its own default>))`. Guard: core/identity/identity-inline-icons.guard.spec.ts.
 */
export const CSS_BOUND_ICONS: Readonly<Record<string, readonly string[]>> = { 'pl-shared-select-arrow': ['a8b2d1', '475569', '6b7699'] };
