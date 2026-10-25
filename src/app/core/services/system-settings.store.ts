import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mapHttpError } from '../forms/http-error';
import { UiNotificationService } from './ui-notification.service';

export type SettingStatus = 'enforced' | 'readonly' | 'blocked';
export interface SettingItem {
	key: string; tab: string; label: string; description: string; status: SettingStatus; unit: string | null; allowed: unknown[] | null; pages: string[];
	canWrite: boolean; effect: 'immediate' | 'within-5s' | 'new-sessions' | null; reason: string | null; value: unknown; version: number | null; source: string | null;
}
export interface SettingsView { storageReady: boolean; items: SettingItem[] }
export interface SettingsHistoryItem { id: string; at: string; severity: string | null; ip: string | null; actor: string | null; changes: Array<{ key: string; label: string; from: unknown; to: unknown }> }
export interface HealthItem { key: string; label: string; status: 'ok' | 'down' | 'configured' | 'unconfigured' | 'unavailable'; detail: string }
export interface Blocker { code: string; message: string }
interface Envelope<T> { success: boolean; data: T }

export const EFFECT_TEXT: Record<string, string> = { immediate: 'يسري فورًا', 'within-5s': 'يسري خلال ثوانٍ من الحفظ', 'new-sessions': 'يسري على الجلسات الجديدة' };
const base = () => `${environment.url_api}/admin/system-settings`;

/** Thin HTTP layer (kept apart so the pages and the store are easy to test). */
@Injectable({ providedIn: 'root' })
export class SystemSettingsApi {
	private http = inject(HttpClient);
	view(): Observable<Envelope<SettingsView>> { return this.http.get<Envelope<SettingsView>>(base()); }
	save(changes: Record<string, unknown>, expected: Record<string, number>): Observable<Envelope<{ changed: string[]; items: SettingItem[] }>> { return this.http.put<Envelope<{ changed: string[]; items: SettingItem[] }>>(base(), { changes, expected }); }
	history(limit = 20): Observable<Envelope<SettingsHistoryItem[]>> { return this.http.get<Envelope<SettingsHistoryItem[]>>(`${base()}/history`, { params: { limit } }); }
	health(): Observable<Envelope<{ checkedAt: string; items: HealthItem[] }>> { return this.http.get<Envelope<{ checkedAt: string; items: HealthItem[] }>>(`${base()}/health`); }
	sessionsImpact(idleMinutes: number): Observable<Envelope<{ idleMinutes: number; activeSessions: number; wouldEndNow: number }>> { return this.http.get<Envelope<{ idleMinutes: number; activeSessions: number; wouldEndNow: number }>>(`${base()}/sessions-impact`, { params: { idleMinutes } }); }
	readiness(): Observable<Envelope<{ ready: boolean; blockers: Blocker[] }>> { return this.http.get<Envelope<{ ready: boolean; blockers: Blocker[] }>>(`${base()}/currency-readiness`); }
}

/**
 * ONE store for both settings pages: the server's registry is the only source (nothing is kept in localStorage or in a page). A change is "saved" only after the server answers 200 and the
 * values shown afterwards are the ones the server returned. Drafts survive every failure so nothing the user typed is lost.
 */
@Injectable({ providedIn: 'root' })
export class SystemSettingsStore {
	private api = inject(SystemSettingsApi);
	private ui = inject(UiNotificationService);
	readonly items = signal<SettingItem[]>([]);
	readonly loading = signal(false);
	readonly loadError = signal('');
	readonly storageReady = signal(true);
	readonly drafts = signal<Record<string, unknown>>({});
	readonly errors = signal<Record<string, string>>({});
	readonly saving = signal(false);
	readonly notice = signal<{ keys: string[]; text: string } | null>(null);
	readonly failure = signal<{ keys: string[]; text: string; code: string | null; blockers: Blocker[] } | null>(null);
	/** keys whose server version moved on while the user was editing */
	readonly conflictKeys = signal<string[]>([]);
	/** the values that clashed: mine vs what the server has now (shown side by side before anything can be overwritten) */
	readonly conflicts = signal<Array<{ key: string; label: string; mine: unknown; current: unknown; currentVersion: number }>>([]);
	/** keys whose draft was kept over a NEWER server version: the next save states the replaced value and needs an explicit confirmation */
	readonly rebasedKeys = signal<string[]>([]);
	readonly byKey = computed(() => new Map(this.items().map(i => [i.key, i])));

	item(key: string): SettingItem | undefined { return this.byKey().get(key); }
	/** the value to show: the draft when there is one, else what the server has */
	value(key: string): unknown { const d = this.drafts(); return key in d ? d[key] : this.item(key)?.value; }
	isDirty(key: string): boolean { const d = this.drafts(); return key in d && JSON.stringify(d[key]) !== JSON.stringify(this.item(key)?.value); }
	dirtyKeys(keys: string[]): string[] { return keys.filter(k => this.item(k)?.status === 'enforced' && this.item(k)?.canWrite && this.isDirty(k)); }

	setDraft(key: string, value: unknown) {
		this.drafts.update(d => ({ ...d, [key]: value }));
		if (this.errors()[key]) this.errors.update(e => { const { [key]: _x, ...rest } = e; return rest; });
		this.notice.set(null);
	}
	discard(keys: string[]) { this.rebasedKeys.update(r => r.filter(k => !keys.includes(k))); this.conflicts.set([]); this.drafts.update(d => { const n = { ...d }; for (const k of keys) delete n[k]; return n; }); this.errors.update(e => { const n = { ...e }; for (const k of keys) delete n[k]; return n; }); this.failure.set(null); this.conflictKeys.set([]); }

	async load(): Promise<void> {
		this.loading.set(true); this.loadError.set('');
		try { const r = await firstValueFrom(this.api.view()); this.items.set(r.data.items); this.storageReady.set(r.data.storageReady !== false); }
		catch (e) { this.loadError.set((e as HttpErrorResponse)?.status === 403 ? 'ليست لديك صلاحية عرض إعدادات النظام.' : 'تعذّر تحميل الإعدادات. لم يتغيّر شيء، ويمكنك إعادة المحاولة.'); }
		finally { this.loading.set(false); }
	}

	/**
	 * "Continue on top of the newest": re-read the server (newest values AND versions) and keep my drafts - NOTHING is written here. The keys are marked `rebased`, so the next save names the value it
	 * replaces and needs an explicit confirmation; the server still checks the new version on that write.
	 */
	async rebase(): Promise<void> {
		const keep = this.drafts(), clash = this.conflicts().map(c => c.key); await this.load(); this.drafts.set(keep); this.conflictKeys.set([]); this.conflicts.set([]); this.failure.set(null);
		this.rebasedKeys.set(clash.filter(k => k in keep && this.isDirty(k)));
	}

	async save(keys: string[]): Promise<boolean> {
		const dirty = this.dirtyKeys(keys); if (!dirty.length || this.saving()) return false;
		const changes: Record<string, unknown> = {}, expected: Record<string, number> = {};
		for (const k of dirty) { changes[k] = this.drafts()[k]; expected[k] = this.item(k)?.version ?? 0; }
		this.saving.set(true); this.failure.set(null); this.notice.set(null); this.errors.set({}); this.conflictKeys.set([]); this.conflicts.set([]);
		try {
			const r = await firstValueFrom(this.api.save(changes, expected));
			this.items.set(r.data.items); this.discard(dirty); this.rebasedKeys.update(r => r.filter(k => !dirty.includes(k)));
			this.notice.set({ keys: dirty, text: r.data.changed.length ? 'تم الحفظ' : 'لا توجد تغييرات للحفظ' });
			if (r.data.changed.length) this.ui.success('تم حفظ الإعدادات'); // after the server's 200 only
			return true;
		} catch (e) {
			const he = e as HttpErrorResponse; const m = mapHttpError(e, { fallback: 'تعذّر حفظ الإعدادات. لم يتغيّر شيء.' }); const body = he?.error ?? {};
			const code: string | null = body.code ?? m.code ?? null;
			if (m.fieldErrors && Object.keys(m.fieldErrors).length) this.errors.set(m.fieldErrors);
			if (code === 'SETTINGS_VERSION_CONFLICT') {
				const rows = (body.errors ?? []) as Array<{ key: string; current?: { value: unknown; version: number } }>;
				this.conflictKeys.set(rows.map(x => x.key).filter(Boolean));
				this.conflicts.set(rows.filter(x => x.key && x.current).map(x => ({ key: x.key, label: this.item(x.key)?.label ?? x.key, mine: this.drafts()[x.key], current: x.current!.value, currentVersion: x.current!.version })));
			}
			this.failure.set({ keys: dirty, code, blockers: code === 'CURRENCY_CHANGE_NOT_READY' ? (body.errors ?? []) : [], text: m.message });
			return false;
		} finally { this.saving.set(false); }
	}
}
