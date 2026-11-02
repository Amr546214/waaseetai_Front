/** GET /api/public/site-identity: ONLY keys with an active custom version are listed (empty `items` = everything is the built-in default). */
export interface IdentityManifestItem {
	url: string;
	sha256: string;
	mime: string;
	width: number | null;
	height: number | null;
	version: number;
	/** token sets only (group `token`, mime application/json): the validated sparse override object */
	value?: Record<string, string>;
}
export interface IdentityManifest {
	version: number;
	items: Record<string, IdentityManifestItem>;
	/** the ready-to-inject CSS of the active design-token overrides; '' = none (nothing is injected, the site looks exactly as shipped) */
	tokensCss: string;
}
export const EMPTY_MANIFEST: IdentityManifest = Object.freeze({ version: 0, items: Object.freeze({}) as Record<string, IdentityManifestItem>, tokensCss: '' }) as IdentityManifest;

/**
 * Defence in depth for the one string that becomes a <style> element: the server validates every token, and the browser accepts ONLY this exact shape again
 * (up to three rules from the known selector list, each holding `--name:value` declarations without any character that could leave a declaration). Anything else = '' = nothing injected.
 */
const TOKEN_SELECTORS = String.raw`(?::root|:root:not\(\.theme-light\):not\(\.light-theme\)|html\.theme-light\.theme-light,html\.light-theme\.light-theme,body\.theme-light\.theme-light,body\.light-theme\.light-theme,\.theme-light\.theme-light,\.light-theme\.light-theme)`;
const TOKEN_DECL = String.raw`--[a-z0-9][a-z0-9-]{0,39}:[^;{}<>@\\/*]{1,220}`;
const TOKENS_CSS_RE = new RegExp(`^(?:${TOKEN_SELECTORS}\\{${TOKEN_DECL}(?:;${TOKEN_DECL})*;?\\}\\s*){1,3}$`);
export function safeTokensCss(raw: unknown): string {
	if (typeof raw !== 'string' || !raw.trim() || raw.length > 20_000) return '';
	if (/url\s*\(|expression|import|javascript:|<\/?style|\\/i.test(raw)) return '';
	return TOKENS_CSS_RE.test(raw.trim()) ? raw.trim() : '';
}

/** strict shape check: anything unexpected is dropped (a bad answer must never break a page) */
export function parseManifest(raw: unknown): IdentityManifest | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const body = (r['data'] && typeof r['data'] === 'object' && r['items'] === undefined ? r['data'] : r) as Record<string, unknown>;
	const version = Number(body['version']);
	if (!Number.isFinite(version) || version < 0) return null;
	const itemsRaw = body['items'];
	if (!itemsRaw || typeof itemsRaw !== 'object' || Array.isArray(itemsRaw)) return null;
	const items: Record<string, IdentityManifestItem> = {};
	for (const [k, v] of Object.entries(itemsRaw as Record<string, unknown>)) {
		if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(k) || !v || typeof v !== 'object') continue;
		const o = v as Record<string, unknown>;
		if (typeof o['url'] !== 'string' || !o['url'] || typeof o['sha256'] !== 'string' || !/^[a-f0-9]{64}$/i.test(o['sha256'])) continue;
		if (/^\s*(javascript|data|vbscript):/i.test(o['url'])) continue;
		items[k] = { url: o['url'], sha256: o['sha256'].toLowerCase(), mime: typeof o['mime'] === 'string' ? o['mime'] : '', width: Number.isFinite(Number(o['width'])) ? Number(o['width']) : null, height: Number.isFinite(Number(o['height'])) ? Number(o['height']) : null, version: Number(o['version']) || 0 };
		if (o['value'] && typeof o['value'] === 'object' && !Array.isArray(o['value'])) { const v: Record<string, string> = {}; for (const [n, x] of Object.entries(o['value'] as Record<string, unknown>)) if (/^--[a-z0-9-]{1,40}$/.test(n) && typeof x === 'string' && x.length <= 220) v[n] = x; items[k].value = v; }
	}
	return { version, items, tokensCss: safeTokensCss(body['tokensCss']) };
}

