import { HttpErrorResponse } from '@angular/common/http';
import { IdentityAssetMeta, IdentityItemInfo, IdentityKeyCurrent, SITE_IDENTITY_VERSION_CONFLICT } from '../../../../../core/identity/site-identity-admin.api';

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
export const sizeText = (w: number | null | undefined, h: number | null | undefined): string => (w && h ? `${w}×${h} بكسل` : '—');
export const shortSha = (s: string | null | undefined): string => (s ? s.slice(0, 10) : '');
export const shortId = (s: string | null | undefined): string => (s ? s.slice(0, 8) : '');

/** the stored versions that can be restored: they were live once (PUBLISHED / SUPERSEDED) and are not the active one */
export const restorable = (item: IdentityItemInfo): IdentityAssetMeta[] =>
	(item.history ?? []).filter(v => (v.status === 'PUBLISHED' || v.status === 'SUPERSEDED') && v.versionId !== item.state.active?.versionId);

/** "the previous version" = the highest-numbered SUPERSEDED version: what was live before the current one (or before the default was restored) */
export const previousVersion = (item: IdentityItemInfo): IdentityAssetMeta | null =>
	restorable(item).filter(v => v.status === 'SUPERSEDED').sort((a, b) => b.version - a.version)[0] ?? null;

export const versionName = (v: IdentityAssetMeta | null | undefined): string => (v ? `النسخة ${v.version}` : 'الأصل الافتراضي');

export type FailureKind = 'conflict' | 'rejected' | 'denied' | 'network' | 'unavailable' | 'server';
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
