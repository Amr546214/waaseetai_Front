import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IdentityManifest } from './site-identity.models';
import { SiteIdentityService } from './site-identity.service';

/** typed against the server contract (BE src/services/site-identity.service.ts, 2026-10-27); every success body is `{ success: true, data }` */
export type IdentityAssetStatus = 'STAGED' | 'PUBLISHED' | 'SUPERSEDED' | 'DISCARDED';
/** who did it (Round 2): the stable user id and the display name (null = the account no longer exists -> «غير معروف»). Never an e-mail. `null` = the row has no actor at all. */
export interface IdentityActor { id: string; name: string | null }
export interface IdentityAssetMeta {
	versionId: string; key: string; version: number; status: IdentityAssetStatus; mime: string; sha256: string;
	width: number | null; height: number | null; byteSize: number; note: string | null; createdBy: IdentityActor | null; createdAt: string;
	/** staged drafts only: the draft was uploaded by the caller (a draft of another admin cannot be applied by someone else) */
	isMine?: boolean;
	/** design-token sets (kind json) only: the sparse override object this version holds ({} never stored; a default side has none) */
	value?: Record<string, string>;
	/** relative to the API root; only PUBLISHED / SUPERSEDED rows have one */
	url: string | null;
	/** admin-only preview of the bytes, relative to the API root (needs the admin token: fetch it with `previewBlob`) */
	previewUrl: string | null;
}
export interface IdentityKeyState { stateVersion: number; isDefault: boolean; active: IdentityAssetMeta | null; updatedAt: string | null; updatedBy: IdentityActor | null }
export interface IdentityDimensionRule { minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number; aspectMin?: number; aspectMax?: number; exact?: { width: number; height: number } }
/** one design token of a token key (BE TOKEN_REGISTRY entry, `default` already resolved for THAT key: light key -> light value) */
export interface IdentityTokenDef { name: string; type: 'color' | 'paint' | 'shadow' | 'length' | 'font-family'; label: string; default: string; sharedWithDark?: boolean; min?: number; max?: number }
export interface IdentityItemInfo {
	key: string; group: 'logo' | 'favicon' | 'icon' | 'character' | 'token'; label: string; description: string; kind: 'raster' | 'svg' | 'ico' | 'json';
	allowedMimes: string[]; maxBytes: number; dimensions: IdentityDimensionRule; rules: unknown;
	defaultAsset: { type: 'file'; path: string } | { type: 'inline-symbol'; symbolId: string; source: string } | { type: 'tokens' };
	/** token keys only */
	tokens?: IdentityTokenDef[];
	defaultFingerprint: { mime: string; width: number | null; height: number | null; byteSize: number; sha256: string; entries?: number; note?: string };
	usages: { where: string; ref: string }[]; notes: string[];
	/** only a wired key (a real consumer reads it) can be changed; `notWiredReason` says why not otherwise */
	wired: boolean; editable: boolean; notWiredReason: string | null;
	state: IdentityKeyState; staged: IdentityAssetMeta[]; history: IdentityAssetMeta[];
}
export interface IdentityOverview {
	manifestVersion: number; canManage: boolean; groups: unknown; items: IdentityItemInfo[]; notIdentity: unknown; unregisteredAssets: unknown;
}
/** current state of one key, as returned by upload/publish/restore/discard and inside a 409 */
export interface IdentityKeyCurrent { key: string; stateVersion: number; manifestVersion: number; isDefault: boolean; active: IdentityAssetMeta | null; updatedAt: string | null; updatedBy: IdentityActor | null }
export interface IdentityUploadResult extends IdentityAssetMeta { sanitized?: { changed: boolean; removed: unknown }; current: IdentityKeyCurrent }
/** publish / restore result */
/** `label` / `usages` / `fromVersion` / `toVersion` (0 = the built-in default) are the server's own confirmation of what changed and where it shows */
export interface IdentityChangeResult extends IdentityKeyCurrent { previous: IdentityAssetMeta | null; label?: string; usages?: { where: string; ref: string }[]; fromVersion?: number; toVersion?: number }
export interface IdentityRestoreSetResult { manifestVersion: number; snapshot: Record<string, string | null>; keys: { key: string; stateVersion: number; isDefault: boolean; active: IdentityAssetMeta | null }[]; changedKeys: string[] }
/** 409 SITE_IDENTITY_VERSION_CONFLICT body of restore-set: `current` = { manifestVersion, snapshot, keys } */
export interface IdentityHistory { manifest: { manifestVersion: number; reason: string; createdAt: string; createdBy: IdentityActor | null; changedKeys: string[] }[]; hasMore: boolean; nextBefore: number | null; versions: IdentityAssetMeta[] }
/** one side (current / target) of a set-restore preview row */
export interface IdentityPreviewSide { source: 'default' | 'custom'; versionId: string | null; version: number; sha256: string; mime: string; width: number | null; height: number | null; previewUrl: string | null; /** token keys: the override object of that side ({} for the default) */ value?: Record<string, string> }
export type IdentityChangeKind = 'replace' | 'to-default' | 'unchanged';
export interface IdentityPreviewRow { key: string; label: string; group: string; current: IdentityPreviewSide; target: IdentityPreviewSide; change: IdentityChangeKind }
/** GET /restore-set/:manifestVersion/preview - the EXACT diff the restore would execute; `previewDigest` binds the confirmation to it */
export interface IdentityRestoreSetPreview { currentManifestVersion: number; targetManifestVersion: number; previewDigest: string; changedCount: number; canApply: boolean; items: IdentityPreviewRow[] }
/** one compact row of the function-icon list (BE `GET /admin/site-identity/icons`, contract IDENTITY-ICONS-CONTRACT-2026-10-28 section 4): one row per library / allow-list icon, no versions */
export type IconFnStatus = 'default' | 'custom' | 'not-wired';
export interface IconFnRow {
	id: string; key: string | null; label: string; library: string | null; status: IconFnStatus; reason: { code: string; text: string } | null; managedBy?: string;
	hasDraft: boolean; stateVersion: number; activeVersion: number | null; defs: number; variants: number; refs?: number; viewBox: string | null;
}
export interface IconFnList { total: number; counts: { default: number; custom: number; notWired: number; withDraft: number }; limits: { maxCustom: number; maxDraftsTotal: number }; rows: IconFnRow[] }
/** the full item of ONE icon (`GET /admin/site-identity/icons/:symbolId`): the shape of `items[]` of the overview plus family fields */
export type IconFnItem = IdentityItemInfo & { family?: string; symbolId?: string; status?: IconFnStatus; reason?: { code: string; text: string } | null };
interface Envelope<T> { success: boolean; data: T; message?: string }
export const SITE_IDENTITY_VERSION_CONFLICT = 'SITE_IDENTITY_VERSION_CONFLICT';
/** 409 of restore-set when the diff changed after the preview was shown: `current` is the FRESH preview, nothing was executed */
export const SITE_IDENTITY_PREVIEW_STALE = 'SITE_IDENTITY_PREVIEW_STALE';
export const SITE_IDENTITY_DRAFT_NOT_YOURS = 'SITE_IDENTITY_DRAFT_NOT_YOURS';
/** 409 body of a stale `expectedVersion`: `current` is the winner's state, to be shown instead of silently overwriting */
export const isIdentityConflict = (e: unknown): e is HttpErrorResponse & { error: { code: string; current: unknown; message: string } } =>
	e instanceof HttpErrorResponse && e.status === 409 && (e.error as { code?: string } | null)?.code === SITE_IDENTITY_VERSION_CONFLICT;

const base = () => `${environment.url_api}/admin/site-identity`;

/**
 * HTTP side of «التحكم بالموقع > الهوية» for the admin page. Nothing is a success until the server answered 2xx (it answers only after its transaction committed and the bytes were
 * read back and verified). After a publish / restore call `refreshPublic()` so THIS tab switches at once (other tabs follow via the BroadcastChannel; others within a few minutes / on focus).
 */
@Injectable({ providedIn: 'root' })
export class SiteIdentityAdminApi {
	private readonly http = inject(HttpClient);
	private readonly identity = inject(SiteIdentityService);

	overview(): Observable<Envelope<IdentityOverview>> { return this.http.get<Envelope<IdentityOverview>>(`${base()}/`); }
	history(opts: { key?: string; limit?: number; before?: number } = {}): Observable<Envelope<IdentityHistory>> {
		let p = new HttpParams(); for (const [k, v] of Object.entries(opts)) if (v !== undefined) p = p.set(k, String(v));
		return this.http.get<Envelope<IdentityHistory>>(`${base()}/history`, { params: p });
	}
	/** function icons (`icon.fn.<symbolId>`): the compact list and the full item of one icon */
	iconList(): Observable<Envelope<IconFnList>> { return this.http.get<Envelope<IconFnList>>(`${base()}/icons`); }
	iconItem(symbolId: string): Observable<Envelope<IconFnItem>> { return this.http.get<Envelope<IconFnItem>>(`${base()}/icons/${encodeURIComponent(symbolId)}`); }
	/** multipart, field `file`; stores a STAGED version (nothing visible on the site yet) */
	upload(key: string, file: File): Observable<Envelope<IdentityUploadResult>> { const fd = new FormData(); fd.append('file', file, file.name); return this.http.post<Envelope<IdentityUploadResult>>(`${base()}/${encodeURIComponent(key)}/upload`, fd); }
	/** design-token sets: JSON body `{ value: { '--teal': '#14b8a6' } }` (sparse overrides); stores a STAGED version after the server's strict validation */
	uploadTokens(key: string, value: Record<string, string>): Observable<Envelope<IdentityUploadResult>> { return this.http.post<Envelope<IdentityUploadResult>>(`${base()}/${encodeURIComponent(key)}/upload`, { value }); }
	publish(key: string, versionId: string, expectedVersion: number, note?: string): Observable<Envelope<IdentityChangeResult>> {
		return this.http.post<Envelope<IdentityChangeResult>>(`${base()}/${encodeURIComponent(key)}/publish`, { versionId, expectedVersion, ...(note ? { note } : {}) });
	}
	/** manifestVersion 0 = all defaults. `target` = a published/superseded versionId, or 'default' for the built-in asset */
	restore(key: string, target: string | 'default', expectedVersion: number): Observable<Envelope<IdentityChangeResult>> { return this.http.post<Envelope<IdentityChangeResult>>(`${base()}/${encodeURIComponent(key)}/restore`, { target, expectedVersion }); }
	/** the exact per-key diff of restoring the whole identity to manifest `manifestVersion` (0 = all defaults) */
	restoreSetPreview(manifestVersion: number): Observable<Envelope<IdentityRestoreSetPreview>> { return this.http.get<Envelope<IdentityRestoreSetPreview>>(`${base()}/restore-set/${encodeURIComponent(String(manifestVersion))}/preview`); }
	/** executes ONLY the diff the digest was computed for: a different current state answers 409 SITE_IDENTITY_PREVIEW_STALE with the fresh preview and changes nothing */
	restoreSet(manifestVersion: number, expectedManifestVersion: number, previewDigest: string): Observable<Envelope<IdentityRestoreSetResult>> { return this.http.post<Envelope<IdentityRestoreSetResult>>(`${base()}/restore-set`, { manifestVersion, expectedManifestVersion, previewDigest }); }
	/** STAGED only */
	discard(key: string, versionId: string): Observable<Envelope<IdentityAssetMeta & { current: IdentityKeyCurrent }>> { return this.http.delete<Envelope<IdentityAssetMeta & { current: IdentityKeyCurrent }>>(`${base()}/${encodeURIComponent(key)}/versions/${encodeURIComponent(versionId)}`); }
	/** bytes of a version for the admin preview (the endpoint needs the admin token, so an <img src> cannot call it directly: use an object URL) */
	previewBlob(key: string, versionId: string): Observable<Blob> { return this.http.get(`${base()}/${encodeURIComponent(key)}/versions/${encodeURIComponent(versionId)}/preview`, { responseType: 'blob' }); }
	/** re-read the public manifest now (after a publish / restore) and switch this tab's consumers */
	refreshPublic(): Promise<boolean> { return this.identity.refresh(true); }
	/** the live manifest object the site is showing right now (for "what visitors see") */
	liveManifest(): IdentityManifest { return this.identity.manifest(); }
}
