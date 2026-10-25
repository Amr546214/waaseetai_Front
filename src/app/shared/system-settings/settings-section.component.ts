import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../forms/select.component';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { EFFECT_TEXT, SettingItem, SystemSettingsStore } from '../../core/services/system-settings.store';

const LONG_TEXT = new Set(['termsContent', 'privacyContent']);
const LTR = new Set(['supportEmail', 'supportPhone']);
/** keys whose change is confirmed first (they change what every user experiences) */
const CONFIRM = new Set(['maintenanceMode', 'registrationOpen', 'sessionIdleMinutes', 'baseCurrency']);
const STATE_WORD = (v: boolean) => (v ? 'مفعّل' : 'غير مفعّل');

/** Saves the dirty keys among `keys`; sensitive ones are confirmed first (what changes and when it takes effect). Returns true only when the server confirmed the save. */
export async function saveWithConfirm(store: SystemSettingsStore, confirmModal: ConfirmModalService, keys: string[]): Promise<boolean> {
	const dirty = store.dirtyKeys(keys); if (!dirty.length) return false;
	const sensitive = dirty.filter(k => CONFIRM.has(k));
	if (sensitive.length) {
		const lines = sensitive.map(k => { const it = store.item(k)!; const v = store.value(k); const shown = typeof v === 'boolean' ? STATE_WORD(v) : String(v); return `• ${it.label} ← ${shown}${it.effect ? ` (${EFFECT_TEXT[it.effect]})` : ''}`; });
		const maintenanceOn = sensitive.includes('maintenanceMode') && store.value('maintenanceMode') === true;
		const ok = await confirmModal.confirm({ title: 'تأكيد تغيير إعداد مؤثر', type: maintenanceOn ? 'danger' : 'warning', size: 'md', confirmText: 'حفظ التغيير',
			message: `${lines.join('\n')}${maintenanceOn ? '\n\nسيتوقف الوصول لجميع المستخدمين عدا لوحة الإدارة والدخول والصحة واستدعاءات الدفع.' : ''}` });
		if (!ok) return false;
	}
	return store.save(dirty);
}

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
	readonly title = input<string>('');
	readonly keys = input.required<string[]>();
	/** 'ss' = P-AD-020 look, 'spa' = P-AD-021 look */
	readonly variant = input<'ss' | 'spa'>('ss');
	readonly showSave = input<boolean>(true);
	/** the keys the save button of THIS card covers (a tab with several cards has one save button, as in the design); default: this card's own keys */
	readonly saveKeys = input<string[] | null>(null);
	private scope = computed(() => this.saveKeys() ?? this.keys());
	readonly danger = input<boolean>(false);

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
	enumOptions(r: SettingItem) { return (r.allowed ?? []).map(v => ({ value: String(v), label: String(v) })); }
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

	setBool(k: string, v: boolean) { this.store.setDraft(k, v); }
	setNumber(k: string, raw: string) { this.store.setDraft(k, raw === '' ? NaN : Number(raw)); }
	setText(k: string, v: string) { this.store.setDraft(k, v); }

	save() { return saveWithConfirm(this.store, this.confirmModal, this.dirty()); }
	discard() { this.store.discard(this.dirty()); }
	reload() { return this.store.load().then(() => this.store.discard(this.scope())); }
	overwrite() { return this.store.rebase(); }
}
