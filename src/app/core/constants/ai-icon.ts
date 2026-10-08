/**
 * The ONE official "AI" mark (وسيط AI): the node-network glyph from the design system
 * (public/tools/02-الايقونات/svg/i-ai.svg — a centre node, six outer nodes, eight links).
 *
 * Every AI card / bar / badge / disclosure in the app must draw exactly this geometry (as `<symbol id="i-ai">`,
 * an inline `<svg>` or a `svg:` string built in TS). `ai-icon.static.spec.ts` fails if any AI-named symbol or inline copy
 * drifts from it, so a look-alike (plus-shaped 5-node, star, sparkle…) cannot come back. Colour / size / stroke-width stay
 * the caller's (currentColor), only the geometry is fixed.
 */
export const AI_ICON_CIRCLES =
	'<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/>' +
	'<circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/>';

export const AI_ICON_LINKS =
	'M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5';

/** Inner SVG markup of the official mark (24×24 viewBox, stroke-based, `fill:none`). */
export const AI_ICON_INNER = `${AI_ICON_CIRCLES}<path d="${AI_ICON_LINKS}"/>`;
