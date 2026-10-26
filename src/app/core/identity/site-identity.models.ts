/** GET /api/public/site-identity: ONLY keys with an active custom version are listed (empty `items` = everything is the built-in default). */
export interface IdentityManifestItem {
	url: string;
	sha256: string;
	mime: string;
	width: number | null;
	height: number | null;
	version: number;
}
export interface IdentityManifest {
	version: number;
	items: Record<string, IdentityManifestItem>;
}
export const EMPTY_MANIFEST: IdentityManifest = Object.freeze({ version: 0, items: Object.freeze({}) as Record<string, IdentityManifestItem> }) as IdentityManifest;

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
	}
	return { version, items };
}
