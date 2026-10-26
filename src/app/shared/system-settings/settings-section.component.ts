import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../forms/select.component';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { LEGAL_PREPARED_ON } from '../../core/constants/legal-meta';
import { EFFECT_TEXT, SettingEffective, SettingItem, SystemSettingsApi, SystemSettingsStore } from '../../core/services/system-settings.store';
import { firstValueFrom } from 'rxjs';

const LONG_TEXT = new Set(['termsContent', 'privacyContent']);
const LTR = new Set(['supportEmail', 'supportPhone']);
/** keys whose change is confirmed first (they change what every user experiences) */
const CONFIRM = new Set(['maintenanceMode', 'registrationOpen', 'sessionIdleMinutes', 'sessionMaxHours', 'baseCurrency']);
const STATE_WORD = (v: boolean) => (v ? 'مفعّل' : 'غير مفعّل');

/** Saves the dirty keys among `keys`; sensitive ones are confirmed first (what changes and when it takes effect). Returns true only when the server confirmed the save. */
export async function saveWithConfirm(store: SystemSettingsStore, confirmModal: ConfirmModalService, keys: string[], api?: SystemSettingsApi): Promise<boolean> {
	const dirty = store.dirtyKeys(keys); if (!dirty.length) return false;
	const rebased = dirty.filter(k => store.rebasedKeys().includes(k));
	if (rebased.length) { // continuing over a newer value: state exactly what is replaced
		const lines = rebased.map(k => `• ${store.item(k)?.label ?? k}: القيمة الحالية على الخادم «${show(store.item(k)?.value)}» ستُستبدل بقيمتك «${show(store.value(k))}»`);
		if (!(await confirmModal.confirm({ title: 'استبدال قيمة أحدث', type: 'warning', size: 'md', confirmText: 'استبدل واحفظ', message: `${lines.join('\n')}\n\nعُدّلت هذه القيم من جهة أخرى بعد فتحك للصفحة.` }))) return false;
	}
	const sensitive = dirty.filter(k => CONFIRM.has(k));
	if (sensitive.length) {
		const lines = sensitive.map(k => { const it = store.item(k)!; const v = store.value(k); const shown = typeof v === 'boolean' ? STATE_WORD(v) : String(v); return `• ${it.label} ← ${shown}${it.unit ? ' ' + it.unit : ''}${it.effect ? ` (${EFFECT_TEXT[it.effect]})` : ''}`; });
		if (sensitive.includes('sessionIdleMinutes') && api) { // say how many people this signs out right now
			try { const imp = (await firstValueFrom(api.sessionsImpact(Number(store.value('sessionIdleMinutes'))))).data; lines.push(imp.wouldEndNow ? `⚠ ستنتهي الآن ${imp.wouldEndNow} جلسة خاملة من أصل ${imp.activeSessions} جلسة نشطة.` : `لن تنتهي أي جلسة نشطة الآن (من أصل ${imp.activeSessions}).`); } catch { lines.push('تعذّر حساب عدد الجلسات التي ستنتهي؛ تأكد قبل المتابعة.'); }
		}
		if (sensitive.includes('sessionMaxHours')) lines.push('يسري على الجلسات الجديدة فقط؛ لا تنتهي الجلسات القائمة بسبب هذا التعديل.');
		const maintenanceOn = sensitive.includes('maintenanceMode') && store.value('maintenanceMode') === true;
		const ok = await confirmModal.confirm({ title: 'تأكيد تغيير إعداد مؤثر', type: maintenanceOn ? 'danger' : 'warning', size: 'md', confirmText: 'حفظ التغيير',
			message: `${lines.join('\n')}${maintenanceOn ? '\n\nسيتوقف الوصول لجميع المستخدمين عدا لوحة الإدارة والدخول والصحة واستدعاءات الدفع.' : ''}` });
		if (!ok) return false;
	}
	return store.save(dirty);
}
const show = (v: unknown) => (typeof v === 'boolean' ? STATE_WORD(v) : v === null || v === undefined || v === '' ? '—' : String(v));

/**
 * A card of settings rows driven ENTIRELY by the server's registry: each key is rendered according to what the server says it is (editable and enforced / read-only with its real value and
 * source / unavailable with the reason). The page decides only which keys go in which card.
 */
@Component({
	selector: 'app-settings-section',
	standalone: true,
	imports: [FormsModule, WsSelectComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './settings-section.component.html',
	styleUrl: './settings-section.component.css',
})
export class SettingsSectionComponent {
	readonly store = inject(SystemSettingsStore);
	private confirmModal = inject(ConfirmModalService);
	private api = inject(SystemSettingsApi);
	readonly title = input<string>('');
	/** the SVG path of the icon before the title (P-AD-020 «sec-ttl») */
	readonly icon = input<string>('');
	readonly keys = input.required<string[]>();
	/** 'ss' = P-AD-020 look, 'spa' = P-AD-021 look */
	readonly variant = input<'ss' | 'spa'>('ss');
	readonly showSave = input<boolean>(true);
	/** the keys the save button of THIS card covers (a tab with several cards has one save button, as in the design); default: this card's own keys */
	readonly saveKeys = input<string[] | null>(null);
	private scope = computed(() => this.saveKeys() ?? this.keys());
	readonly danger = input<boolean>(false);
	/** false when the page itself already shows the loading / failure state (the card then just stays empty meanwhile) */
	readonly showState = input<boolean>(true);
	readonly state = this.store.state;

	readonly rows = computed(() => this.keys().map(k => this.store.item(k)).filter((i): i is SettingItem => !!i));
	readonly editableKeys = computed(() => this.scope().filter(k => { const r = this.store.item(k); return r?.status === 'enforced' && r.canWrite; }));
	readonly dirty = computed(() => this.store.dirtyKeys(this.scope()));
	readonly failure = computed(() => { const f = this.store.failure(); return f && f.keys.some(k => this.scope().includes(k)) ? f : null; });
	readonly notice = computed(() => { const n = this.store.notice(); return n && n.keys.some(k => this.scope().includes(k)) ? n : null; });
	readonly conflict = computed(() => this.store.conflictKeys().some(k => this.scope().includes(k)));
	readonly effectText = EFFECT_TEXT;

	isLong(k: string) { return LONG_TEXT.has(k); }
	isLtr(k: string) { return LTR.has(k); }
	kind(r: SettingItem): 'bool' | 'number' | 'enum' | 'text' { if (typeof r.value === 'boolean') return 'bool'; if (r.allowed && r.allowed.length) return 'enum'; if (typeof r.value === 'number') return 'number'; return 'text'; }
	enumOptions(r: SettingItem) { return (r.allowed ?? []).map(v => ({ value: String(v), label: r.allowedLabels?.[String(v)] ?? (r.unit ? `${v} ${r.unit}` : String(v)) })); }
	/** a numeric enum (session hours) is stored as a number, never as the select's text */
	setEnum(r: SettingItem, v: string) { this.store.setDraft(r.key, typeof r.value === 'number' ? Number(v) : v); }
	readonly conflicts = computed(() => this.store.conflicts().filter(c => this.scope().includes(c.key)));
	showVal = show;
	val(k: string) { return this.store.value(k); }
	text(v: unknown) { return v == null ? '' : String(v); }
	/** read-only value in words (a boolean as «مفعّل», an object as name: state; never a raw secret - the server only sends yes/no for those) */
	readonlyText(r: SettingItem): string {
		const v = r.value;
		if (typeof v === 'boolean') return STATE_WORD(v);
		if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${this.nameOf(k)}: ${typeof x === 'boolean' ? (x ? 'مهيّأ' : 'غير مهيّأ') : String(x)}`).join(' · ');
		return v == null ? '—' : String(v);
	}
	private nameOf(k: string) { return ({ configured: 'الخادم', senderConfigured: 'المرسِل', paypal: 'PayPal', smsProvider: 'مزوّد SMS', billingGateway: 'بوابة الفوترة' } as Record<string, string>)[k] ?? k; }

	/** the value shown beside «غير متاح»: the currency is USD while multi-currency is deferred (the server sends no value for it); other unavailable rows show none */
	blockedValue(r: SettingItem): string { if (r.key === 'baseCurrency') return 'USD'; const v = r.value; return v === null || v === undefined || typeof v === 'boolean' || typeof v === 'object' ? '' : String(v); }
	setBool(k: string, v: boolean) { this.store.setDraft(k, v); }
	setNumber(k: string, raw: string) { this.store.setDraft(k, raw === '' ? NaN : Number(raw)); }
	setText(k: string, v: string) { this.store.setDraft(k, v); }

	save() { return saveWithConfirm(this.store, this.confirmModal, this.dirty(), this.api); }
	discard() { this.store.discard(this.dirty()); }
	retry() { return this.store.load(); }
	/** the value in use while a setting is not stored (nothing to show for a stored value, and never for read-only / blocked rows) */
	unset(r: SettingItem): SettingEffective | null { return r.status === 'enforced' && r.effective && r.effective.source !== 'setting' ? r.effective : null; }
	/** the web app knows the static legal text's date itself (the server cannot read it) */
	inUseText(r: SettingItem, e: SettingEffective): string {
		const own = r.key === 'termsVersion' || r.key === 'privacyVersion' ? `${LEGAL_PREPARED_ON} (تاريخ الإعداد المكتوب في ${r.key === 'termsVersion' ? 'صفحة الشروط' : 'صفحة الخصوصية'})` : null;
		if (own) return own;
		return this.fmt(r, e.value);
	}
	private fmt(r: SettingItem, v: unknown): string {
		if (v === null || v === undefined) return '';
		if (typeof v === 'boolean') return STATE_WORD(v);
		if (v === '') return 'فارغ (لا قيمة)';
		const lab = r.allowedLabels?.[String(v)]; if (lab) return lab;
		const t = String(v); return t.length > 160 ? `${t.slice(0, 160)}…` : t;
	}
	useText(r: SettingItem, u: { where: string; value: unknown }) { return `${u.where}: ${this.fmt(r, u.value)}`; }
	sourceText(e: SettingEffective) { return ({ 'built-in default': 'قيمة مدمجة في النظام', 'static page text': 'نص ثابت مكتوب في الصفحة', 'not consumed': 'لا يستعمله أي موضع حاليًا', setting: 'الإعداد' } as Record<string, string>)[e.source] ?? e.source; }
	reload() { return this.store.load().then(() => this.store.discard(this.scope())); }
	overwrite() { return this.store.rebase(); }
}
