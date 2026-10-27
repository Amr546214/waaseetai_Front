import { HttpErrorResponse } from '@angular/common/http';
import { IdentityActor, IdentityAssetMeta, IdentityChangeKind, IdentityItemInfo, IdentityKeyCurrent, IdentityPreviewRow, IdentityRestoreSetPreview, SITE_IDENTITY_PREVIEW_STALE, SITE_IDENTITY_VERSION_CONFLICT } from '../../../../../core/identity/site-identity-admin.api';

/** pure helpers of the «الهوية» page (no Angular state) so the component stays readable and every rule is unit-testable */

export const GROUP_TITLES: Record<string, { title: string; hint: string }> = {
	logo: { title: 'الشعارات', hint: 'علامة وسيط AI كما تظهر في الشريط العلوي والتذييل وصفحات الدخول.' },
	favicon: { title: 'أيقونة التبويب', hint: 'ما يظهر في تبويب المتصفح وملف favicon.' },
	icon: { title: 'الأيقونات', hint: 'علامة الذكاء الاصطناعي الرسمية الوحيدة.' },
	character: { title: 'الشخصيات (بيبو)', hint: 'لوحات الحركة (sprites) للمساعد بيبو.' }
};

export const bytesText = (n: number | null | undefined): string => {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	if (n < 1024) return `${n} بايت`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
	return `${(n / 1024 / 1024).toFixed(2)} م.ب`;
};

export const MIME_NAMES: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/svg+xml': 'SVG', 'image/x-icon': 'ICO', 'image/vnd.microsoft.icon': 'ICO', 'image/gif': 'GIF' };
export const mimeName = (m: string | null | undefined): string => (m ? MIME_NAMES[m.toLowerCase()] ?? m : '—');
export const sizeText = (w: number | null | undefined, h: number | null | undefined): string => (w && h ? `\u2066${w}×${h}\u2069 بكسل` : '—');
export const shortSha = (s: string | null | undefined): string => (s ? s.slice(0, 10) : '');
export const shortId = (s: string | null | undefined): string => (s ? s.slice(0, 8) : '');

/** «by whom» (Round 2): the server returns `{ id, name }`; a name that is null/blank means the account no longer exists. Never an e-mail. */
export const UNKNOWN_ACTOR = 'غير معروف';
export const actorOf = (v: unknown): IdentityActor | null => {
	if (!v || typeof v !== 'object') return null;
	const o = v as { id?: unknown; name?: unknown };
	return typeof o.id === 'string' && o.id ? { id: o.id, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : null } : null;
};
export const actorName = (a: IdentityActor | null | undefined): string => (a?.name?.trim() ? a.name.trim() : UNKNOWN_ACTOR);

/** the four things a set restore can do to one key (the server emits three: «إزالة التخصيص» IS «العودة للأصل») */
export const CHANGE_KIND_TEXT: Record<IdentityChangeKind, string> = { replace: 'استبدال', 'to-default': 'العودة للأصل (إزالة التخصيص)', unchanged: 'بلا تغيير' };
export const sideText = (s: { source: string; version: number }): string => (s.source === 'default' ? 'الأصل الافتراضي' : `مخصّص — النسخة ${s.version}`);
/** a strict shape check of a preview body (also of the fresh one inside a 409 PREVIEW_STALE) */
export function parsePreview(raw: unknown): IdentityRestoreSetPreview | null {
	const p = raw as Partial<IdentityRestoreSetPreview> | null;
	if (!p || typeof p !== 'object' || typeof p.previewDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(p.previewDigest) || !Array.isArray(p.items)) return null;
	const items = p.items.filter((r): r is IdentityPreviewRow => !!r && typeof r.key === 'string' && !!r.current && !!r.target && (r.change === 'replace' || r.change === 'to-default' || r.change === 'unchanged'));
	return { currentManifestVersion: Number(p.currentManifestVersion), targetManifestVersion: Number(p.targetManifestVersion), previewDigest: p.previewDigest.toLowerCase(), changedCount: items.filter(r => r.change !== 'unchanged').length, canApply: items.some(r => r.change !== 'unchanged'), items };
}

/** the stored versions that can be restored: they were live once (PUBLISHED / SUPERSEDED) and are not the active one */
export const restorable = (item: IdentityItemInfo): IdentityAssetMeta[] =>
	(item.history ?? []).filter(v => (v.status === 'PUBLISHED' || v.status === 'SUPERSEDED') && v.versionId !== item.state.active?.versionId);

/** "the previous version" = the highest-numbered SUPERSEDED version: what was live before the current one (or before the default was restored) */
export const previousVersion = (item: IdentityItemInfo): IdentityAssetMeta | null =>
	restorable(item).filter(v => v.status === 'SUPERSEDED').sort((a, b) => b.version - a.version)[0] ?? null;

export const versionName = (v: IdentityAssetMeta | null | undefined): string => (v ? `النسخة ${v.version}` : 'الأصل الافتراضي');

export type FailureKind = 'conflict' | 'stale' | 'rejected' | 'denied' | 'network' | 'unavailable' | 'server';
export interface Failure { kind: FailureKind; message: string; reason?: string; current?: unknown; status?: number; code?: string }

const SAFE_ARABIC = (m: unknown): string | null => (typeof m === 'string' && /[؀-ۿ]/.test(m) && m.length < 400 ? m : null);

/** a clear Arabic answer for every way a request can fail; nothing technical leaks, the current identity is never touched by a failure */
export function describeFailure(e: unknown, what: string): Failure {
	if (e instanceof HttpErrorResponse) {
		const b = (e.error ?? {}) as { code?: string; message?: unknown; errors?: { message?: unknown; reason?: string }[]; current?: unknown };
		const server = SAFE_ARABIC(b.message);
		if (e.status === 0) return { kind: 'network', status: 0, message: `تعذّر الاتصال بالخادم أثناء ${what}. لم يتغيّر شيء في هوية الموقع. تحقّق من الاتصال ثم أعد المحاولة.` };
		if (e.status === 409 && b.code === SITE_IDENTITY_VERSION_CONFLICT) return { kind: 'conflict', status: 409, code: b.code, current: b.current, message: server ?? 'عدّل شخصٌ آخر هذه الهوية قبل أن تُنفّذ طلبك، ولم يُطبَّق شيء.' };
		if (b.code === 'SITE_IDENTITY_FILE_REJECTED' || (e.status === 413) || (e.status === 400 && Array.isArray(b.errors) && b.errors.some(x => x.reason))) {
			const first = Array.isArray(b.errors) ? SAFE_ARABIC(b.errors[0]?.message) : null;
			return { kind: 'rejected', status: e.status, code: b.code, reason: b.errors?.[0]?.reason, message: `رفض الخادم الملف: ${first ?? server ?? 'الملف غير مطابق لشروط هذا المفتاح.'} اختر ملفًا آخر؛ هوية الموقع لم تتغيّر.` };
		}
		if (e.status === 409 && b.code === SITE_IDENTITY_PREVIEW_STALE) return { kind: 'stale', status: 409, code: b.code, current: b.current, message: server ?? 'تغيّرت هوية الموقع بعد أن عُرضت عليك المعاينة، فلم يُنفَّذ شيء. هذه هي المعاينة المحدّثة: راجعها ثم أكّد من جديد.' };
		if (e.status === 403) return { kind: 'denied', status: 403, code: b.code, message: server ?? 'ليست لديك صلاحية إدارة هوية الموقع (site.manage).' };
		if (e.status === 401) return { kind: 'denied', status: 401, message: 'انتهت جلستك. سجّل الدخول من جديد ثم أعد المحاولة.' };
		if (e.status === 503 && b.code === 'SITE_IDENTITY_UNAVAILABLE') return { kind: 'unavailable', status: 503, code: b.code, message: server ?? 'خدمة الهوية غير جاهزة على هذا الخادم بعد.' };
		return { kind: 'server', status: e.status, code: b.code, message: `تعذّر ${what}${server ? `: ${server}` : ''}. لم تتغيّر هوية الموقع. يمكنك إعادة المحاولة.` };
	}
	return { kind: 'network', message: `تعذّر ${what}. لم تتغيّر هوية الموقع. يمكنك إعادة المحاولة.` };
}

/** short text for the winner of a conflict (`current` of a key route) */
export function currentSummary(c: unknown, unknownText = 'غير معروف'): string {
	const k = c as Partial<IdentityKeyCurrent> | null;
	if (!k || typeof k !== 'object') return unknownText;
	const what = k.isDefault || !k.active ? 'الأصل الافتراضي' : `النسخة ${k.active.version} (${shortSha(k.active.sha256)})`;
	return what;
}
