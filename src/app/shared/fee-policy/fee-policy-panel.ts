import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { mapHttpError } from '../../core/forms/http-error';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { UiNotificationService } from '../../core/services/ui-notification.service';
import { FeePolicyApi, FeePolicyPayload, FeePolicyVersion, FeePolicyView } from '../../core/services/fee-policy.api';
import { platformTimeZone, instantOfWallClock, wallClockInZone } from '../../core/utils/regional';
import { WsDatePipe } from '../ws-date/ws-date.pipe';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const DEPOSIT_LABELS: Record<string, string> = { mada: 'مدى', visa_mastercard: 'فيزا / ماستركارد', paypal: 'PayPal', international_transfer: 'تحويل دولي', other: 'أخرى' };
export const WITHDRAW_LABELS: Record<string, string> = { bank_transfer: 'تحويل بنكي', paypal: 'PayPal', usdt: 'USDT' };
const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * The fee policy: provider / marketer commission and client cashback by level, deposit and marketer-withdrawal fees by method, minimum payouts. Versions are IMMUTABLE and new ones are SCHEDULED:
 * they apply to operations created from their effective time on; contracts, deposits and withdrawals that already exist keep the terms they were created under. A change is shown as a diff
 * and needs an explicit confirmation; the server re-validates everything and refuses a stale base version.
 */
@Component({
	selector: 'app-fee-policy-panel',
	standalone: true,
	imports: [DatePipe, WsDatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './fee-policy-panel.html',
	styleUrl: './fee-policy-panel.css',
})
export class FeePolicyPanel implements OnInit {
	private api = inject(FeePolicyApi); private confirmModal = inject(ConfirmModalService); private ui = inject(UiNotificationService); readonly access = inject(AdminAccessService);
	readonly loading = signal(true); readonly loadError = signal(''); readonly forbidden = signal(false); readonly view = signal<FeePolicyView | null>(null);
	readonly draft = signal<FeePolicyPayload | null>(null); readonly effectiveFrom = signal(''); readonly note = signal('');
	readonly saving = signal(false); readonly formError = signal(''); readonly fieldErrors = signal<string[]>([]); readonly notice = signal('');
	readonly levels = Array.from({ length: 15 }, (_, i) => i + 1);
	readonly depositKeys = Object.keys(DEPOSIT_LABELS); readonly withdrawKeys = Object.keys(WITHDRAW_LABELS); readonly depositLabels = DEPOSIT_LABELS; readonly withdrawLabels = WITHDRAW_LABELS;
	/** the zone the effective time is typed in: the platform zone, else this browser's own */
	readonly zoneLabel = computed(() => platformTimeZone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
	readonly canManage = computed(() => this.access.can('fees.manage'));
	readonly pending = computed(() => (this.view()?.upcoming ?? []).filter(u => u.state === 'SCHEDULED'));
	readonly editable = computed(() => this.canManage() && !this.pending().length);
	/** what the draft changes against the version it is based on */
	readonly diff = computed(() => { const v = this.view(), d = this.draft(); return v && d ? diffPayload(v.active.payload, d) : []; });

	ngOnInit() { void this.load(); }
	async load() {
		this.loading.set(true);
		try { const r = (await firstValueFrom(this.api.view())).data; this.loadError.set(''); this.forbidden.set(false); this.view.set(r); this.draft.set(clone(r.active.payload)); const d = new Date(Date.now() + 65 * 60_000); d.setSeconds(0, 0); const z = platformTimeZone(); this.effectiveFrom.set(z ? wallClockInZone(d, z) : localInput(d)); }
		catch (e) { const f = (e as HttpErrorResponse)?.status === 403; this.forbidden.set(f); this.loadError.set(f ? 'ليست لديك صلاحية عرض سياسة الرسوم.' : 'تعذّر تحميل سياسة الرسوم. لم يتغيّر شيء، ويمكنك إعادة المحاولة.'); }
		finally { this.loading.set(false); }
	}
	setLadder(key: 'providerCommissionByLevel' | 'clientCashbackByLevel' | 'marketerCommissionByLevel', i: number, raw: string) { this.draft.update(d => d && ({ ...d, [key]: d[key].map((v, k) => (k === i ? num(raw) : v)) })); this.clearMessages(); }
	setTable(key: 'depositFeePercent' | 'marketerWithdrawalFeePercent', k: string, raw: string) { this.draft.update(d => d && ({ ...d, [key]: { ...d[key], [k]: num(raw) } })); this.clearMessages(); }
	setMin(key: 'minMarketerPayout' | 'minProviderPayout', raw: string) { this.draft.update(d => d && ({ ...d, [key]: num(raw) })); this.clearMessages(); }
	private clearMessages() { this.formError.set(''); this.fieldErrors.set([]); this.notice.set(''); }
	reset() { const v = this.view(); if (v) this.draft.set(clone(v.active.payload)); this.clearMessages(); }

	async submit() {
		const v = this.view(), d = this.draft(); if (!v || !d || !this.diff().length || this.saving()) return;
		const z = platformTimeZone(); const eff = z ? instantOfWallClock(this.effectiveFrom(), z) : new Date(this.effectiveFrom());
		if (!this.note().trim()) { this.formError.set('اكتب سبب التعديل.'); return; }
		if (Number.isNaN(eff.getTime())) { this.formError.set('اختر وقت السريان.'); return; }
		const lines = this.diff().slice(0, 14).map(x => `• ${describePath(x.path)}: ${x.from} ← ${x.to}`); if (this.diff().length > 14) lines.push(`… و${this.diff().length - 14} تغييرات أخرى`);
		const ok = await this.confirmModal.confirm({ title: 'جدولة تعديل الرسوم والعمولات', type: 'warning', size: 'md', confirmText: 'جدولة النسخة', message: `${lines.join('\n')}\n\nتسري من ${eff.toLocaleString('ar-SA-u-nu-latn', { timeZone: z })} على العمليات التي تُنشأ بعدها فقط.\nالعقود وطلبات الإيداع والسحب القائمة تحتفظ بشروطها وقت إنشائها ولا يُعاد حسابها.` });
		if (!ok) return;
		this.saving.set(true); this.clearMessages();
		try {
			const changes = changedKeys(v.active.payload, d);
			const r = (await firstValueFrom(this.api.schedule({ changes, effectiveFrom: eff.toISOString(), note: this.note().trim(), baseVersion: Math.max(...[v.active, ...v.upcoming].map(x => x.version)), confirmSensitive: true }))).data;
			this.ui.success('جُدولت النسخة الجديدة'); this.notice.set(`جُدولت النسخة ${r.version}: تسري على العمليات الجديدة من ${eff.toLocaleString('ar-SA-u-nu-latn', { timeZone: z })}.`); this.note.set(''); await this.load();
		} catch (e) {
			const he = e as HttpErrorResponse; const m = mapHttpError(e, { fallback: 'تعذّرت الجدولة. لم يتغيّر شيء.' });
			this.formError.set(he?.error?.code === 'FEE_POLICY_VERSION_CONFLICT' ? 'تغيّرت سياسة الرسوم من جهة أخرى. حمّل الأحدث وراجع تعديلك.' : m.message);
			const errs = (he?.error?.errors ?? []) as Array<{ field?: string; message?: string }>; this.fieldErrors.set(errs.map(x => x.message ?? '').filter(Boolean));
		} finally { this.saving.set(false); }
	}
	async cancel(u: FeePolicyVersion) {
		if (!(await this.confirmModal.confirm({ title: 'إلغاء نسخة مجدولة', type: 'warning', size: 'sm', confirmText: 'إلغاء النسخة', message: `ستُلغى النسخة ${u.version} قبل سريانها وتبقى السياسة الحالية كما هي.` }))) return;
		this.saving.set(true); this.clearMessages();
		try { await firstValueFrom(this.api.cancel(u.id)); this.ui.success('أُلغيت النسخة المجدولة'); await this.load(); }
		catch (e) { this.formError.set(mapHttpError(e, { fallback: 'تعذّر الإلغاء. لم يتغيّر شيء.' }).message); }
		finally { this.saving.set(false); }
	}
	stateLabel(s: string) { return s === 'EFFECTIVE' ? 'ساريه' : s === 'SCHEDULED' ? 'مجدولة' : 'ملغاة'; }
}

const num = (raw: string) => (raw.trim() === '' ? NaN : Number(raw));
function changedKeys(a: FeePolicyPayload, b: FeePolicyPayload): Partial<FeePolicyPayload> { const out: Record<string, unknown> = {}; for (const k of Object.keys(a) as Array<keyof FeePolicyPayload>) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = b[k]; return out as Partial<FeePolicyPayload>; }
export function diffPayload(a: FeePolicyPayload, b: FeePolicyPayload): Array<{ path: string; from: unknown; to: unknown }> {
	const out: Array<{ path: string; from: unknown; to: unknown }> = [];
	const walk = (x: unknown, y: unknown, p: string) => { if (Array.isArray(x) && Array.isArray(y)) x.forEach((v, i) => walk(v, y[i], `${p}[${i + 1}]`)); else if (x && y && typeof x === 'object' && typeof y === 'object') for (const k of Object.keys(x)) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], p ? `${p}.${k}` : k); else if (x !== y && !(Number.isNaN(x) && Number.isNaN(y))) out.push({ path: p, from: x, to: y }); };
	walk(a, b, ''); return out;
}
const NAMES: Record<string, string> = { providerCommissionByLevel: 'عمولة مقدم الخدمة', clientCashbackByLevel: 'كاش باك طالب الخدمة', marketerCommissionByLevel: 'عمولة الوسيط', depositFeePercent: 'رسوم الإيداع', marketerWithdrawalFeePercent: 'رسوم سحب الوسيط', minMarketerPayout: 'الحد الأدنى لسحب الوسيط', minProviderPayout: 'الحد الأدنى لسحب مقدم الخدمة' };
export function describePath(p: string): string {
	const m = /^(\w+)(?:\[(\d+)\]|\.(\w+))?$/.exec(p); if (!m) return p; const base = NAMES[m[1]] ?? m[1];
	return m[2] ? `${base} - المستوى ${m[2]}` : m[3] ? `${base} - ${DEPOSIT_LABELS[m[3]] ?? WITHDRAW_LABELS[m[3]] ?? m[3]}` : base;
}
