import { NgStyle } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input, signal, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { IdentityAssetMeta, IdentityChangeResult, IdentityItemInfo, IdentityTokenDef, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { Failure, actorName, currentSummary, describeFailure } from '../identity/identity-view';
import { PlatformTokensStore } from './platform-tokens.store';

export interface TokenNotice { type: 'ok' | 'warn' | 'error' | 'conflict'; text: string; detail?: string; failure?: Failure }
interface KeyUi { edits: Record<string, string>; busy: null | 'stage' | 'apply' | 'discard' | 'restore'; draft: IdentityAssetMeta | null; notice: TokenNotice | null; verifyExpect: IdentityChangeResult | null }
const FRESH = (): KeyUi => ({ edits: {}, busy: null, draft: null, notice: null, verifyExpect: null });

/** `#rrggbb` only: what <input type="color"> can hold (alpha / gradients / shadows are edited as text) */
export const isHex6 = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);
/** a colour-like value that can be painted as a swatch */
export const isSwatch = (t: IdentityTokenDef): boolean => t.type === 'color' || t.type === 'paint';

/**
 * The editor of the platform's design tokens (colours of both modes, global dimensions, global font). It edits ONLY what the server manages (`tokens.*` keys) through the SAME pipeline as
 * «الهوية»: check (the server validates and stores a draft, nothing changes on the site) -> preview -> apply (a versioned publish bound to the state you saw) / cancel (the draft is discarded) /
 * restore (previous version or the platform default) / conflict (someone else changed it first: nothing is overwritten). The platform default of every token is the server's, never a local number.
 */
@Component({
	selector: 'sc-token-editor',
	standalone: true,
	imports: [NgStyle],
	templateUrl: './token-editor.html',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../site-control-base.css', './token-editor.css']
})
export class TokenEditor implements OnInit {
	/** the registry keys this instance edits, in display order */
	readonly keys = input.required<string[]>();
	readonly title = input('قيم التصميم المرتبطة بالموقع');
	readonly store = inject(PlatformTokensStore);
	private readonly api = inject(SiteIdentityAdminApi);
	private readonly confirmer = inject(ConfirmModalService);

	readonly ui = signal<Record<string, KeyUi>>({});
	readonly active = signal<string>('');
	readonly shown = computed(() => this.keys().map(k => this.store.item(k)).filter((i): i is IdentityItemInfo => !!i));
	readonly current = computed(() => this.shown().find(i => i.key === this.active()) ?? this.shown()[0] ?? null);

	ngOnInit(): void { void this.store.load(); }

	state(key: string): KeyUi { return this.ui()[key] ?? FRESH(); }
	private patch(key: string, p: Partial<KeyUi>): void { this.ui.update(m => ({ ...m, [key]: { ...(m[key] ?? FRESH()), ...p } })); }

	// ------------------------------------------------------------------ values
	activeValue(it: IdentityItemInfo): Record<string, string> { return it.state.active?.value ?? {}; }
	/** what the site shows now for a token: the published override, else the platform default */
	published(it: IdentityItemInfo, t: IdentityTokenDef): string { return this.activeValue(it)[t.name] ?? t.default; }
	/** what the field shows: the pending edit, else the published value */
	shownValue(it: IdentityItemInfo, t: IdentityTokenDef): string { const e = this.state(it.key).edits[t.name]; return e !== undefined && e !== '' ? e : this.published(it, t); }
	isOverridden(it: IdentityItemInfo, t: IdentityTokenDef): boolean { return this.activeValue(it)[t.name] !== undefined; }
	isEdited(it: IdentityItemInfo, t: IdentityTokenDef): boolean { return this.state(it.key).edits[t.name] !== undefined; }
	/** the whole override object the pending edits would produce (entries equal to the default drop out, an empty edit = back to the platform value) */
	desired(it: IdentityItemInfo): Record<string, string> {
		const out: Record<string, string> = { ...this.activeValue(it) };
		const defs = new Map((it.tokens ?? []).map(t => [t.name, t]));
		for (const [n, v] of Object.entries(this.state(it.key).edits)) {
			const clean = v.trim();
			if (!clean || clean === defs.get(n)?.default) delete out[n]; else out[n] = clean;
		}
		return out;
	}
	dirty(it: IdentityItemInfo): boolean { return JSON.stringify(this.sorted(this.desired(it))) !== JSON.stringify(this.sorted(this.activeValue(it))); }
	private sorted(o: Record<string, string>): [string, string][] { return Object.entries(o).sort(([a], [b]) => a.localeCompare(b)); }
	overrideCount(it: IdentityItemInfo): number { return Object.keys(this.activeValue(it)).length; }

	edit(it: IdentityItemInfo, t: IdentityTokenDef, value: string): void {
		const s = this.state(it.key);
		this.patch(it.key, { edits: { ...s.edits, [t.name]: value }, draft: null, notice: s.draft ? { type: 'warn', text: 'تغيّرت القيم بعد التحقق: أعد «تحقّق وعاين» قبل التطبيق.' } : s.notice });
	}
	resetRow(it: IdentityItemInfo, t: IdentityTokenDef): void { this.edit(it, t, ''); }
	pickColor(it: IdentityItemInfo, t: IdentityTokenDef, ev: Event): void { this.edit(it, t, (ev.target as HTMLInputElement).value.toLowerCase()); }
	onText(it: IdentityItemInfo, t: IdentityTokenDef, ev: Event): void { this.edit(it, t, (ev.target as HTMLInputElement).value); }

	/** the names that differ between the published state and `to`, with both values (for the review before applying) */
	diff(it: IdentityItemInfo, to: Record<string, string>): { name: string; label: string; from: string; to: string; type: string }[] {
		const from = this.activeValue(it);
		return (it.tokens ?? []).filter(t => (from[t.name] ?? t.default) !== (to[t.name] ?? t.default)).map(t => ({ name: t.name, label: t.label, type: t.type, from: from[t.name] ?? t.default, to: to[t.name] ?? t.default }));
	}
	/** the exact change a confirmation dialog announces: one line per token, both values (capped so the dialog stays readable; the count is always the full one) */
	diffText(it: IdentityItemInfo, to: Record<string, string>): string {
		const rows = this.diff(it, to);
		const lines = rows.slice(0, 12).map(r => `• ${r.label} (${r.name}): ${r.from} ← ${r.to}`);
		if (rows.length > 12) lines.push(`… و${rows.length - 12} قيمة أخرى`);
		return lines.length ? lines.join('\n') : 'لا فرق في القيم.';
	}
	/** the override object being reviewed: the server's canonical version of the draft */
	reviewed(it: IdentityItemInfo): Record<string, string> | null { const d = this.state(it.key).draft; return d ? (d.value ?? {}) : null; }
	/** every token of the key with the reviewed (or pending) values, as inline custom properties: the sample card renders them without touching the site */
	sampleVars(it: IdentityItemInfo): Record<string, string> {
		const o = this.reviewed(it) ?? this.desired(it);
		const vars: Record<string, string> = {};
		for (const t of it.tokens ?? []) vars[t.name] = o[t.name] ?? t.default;
		return vars;
	}
	/** the sample shows light or dark tokens depending on the key */
	sampleMode(it: IdentityItemInfo): 'light' | 'dark' | 'any' { return it.key.endsWith('.light') ? 'light' : it.key.endsWith('.dark') ? 'dark' : 'any'; }

	// ------------------------------------------------------------------ actions
	canEdit(it: IdentityItemInfo): boolean { return this.store.canManage() && it.wired; }

	async stage(it: IdentityItemInfo): Promise<void> {
		const want = this.desired(it);
		if (!this.dirty(it)) { this.patch(it.key, { notice: { type: 'warn', text: 'لا تغيير لتتحقق منه: عدّل قيمة واحدة على الأقل.' } }); return; }
		if (!Object.keys(want).length) { this.patch(it.key, { notice: { type: 'warn', text: 'كل القيم أصبحت مساوية للقيم الافتراضية للمنصة. للعودة إلى الأصل استعمل «العودة إلى الأصل».' } }); return; }
		this.patch(it.key, { busy: 'stage', notice: null });
		try {
			const r = await firstValueFrom(this.api.uploadTokens(it.key, want));
			const draft = r.data as IdentityAssetMeta;
			this.patch(it.key, { busy: null, draft, notice: { type: 'ok', text: 'تحقّق الخادم من القيم وحفظها كمسودة. لم يتغيّر الموقع بعد.', detail: draft.note ?? undefined } });
		} catch (e) { const f = describeFailure(e, 'التحقق من القيم'); this.patch(it.key, { busy: null, notice: { type: f.kind === 'conflict' ? 'conflict' : 'error', text: f.message, failure: f } }); }
	}

	async apply(it: IdentityItemInfo): Promise<void> {
		const draft = this.state(it.key).draft; if (!draft) return;
		const changed = this.diff(it, draft.value ?? {});
		const ok = await this.confirmer.confirm({ title: 'تطبيق القيم على الموقع كله', type: 'warning', size: 'md', confirmText: 'طبّق على الموقع', cancelText: 'لا تطبّق',
			message: `ستتغيّر ${changed.length} ${changed.length === 1 ? 'قيمة' : 'قيم'} في ${it.label} لكل زوّار الموقع فور التطبيق (هي نفس القيم التي عاينتها):\n${this.diffText(it, draft.value ?? {})}\n\nتبقى النسخة الحالية محفوظة ويمكن الرجوع إليها.` });
		if (!ok) return;
		this.patch(it.key, { busy: 'apply', notice: null });
		try {
			const r = await firstValueFrom(this.api.publish(it.key, draft.versionId, it.state.stateVersion));
			await this.finish(it, r.data, `طُبّقت النسخة ${r.data.toVersion ?? ''} على الموقع.`.replace('  ', ' '), `النسخة السابقة: ${r.data.fromVersion ? 'النسخة ' + r.data.fromVersion : 'الأصل الافتراضي'}`);
		} catch (e) { await this.fail(it, e, 'تطبيق القيم'); }
	}

	/** success only when the server committed AND the public manifest (read again now) shows exactly the version it activated; otherwise a warning with a re-check, never a success */
	private async finish(it: IdentityItemInfo, change: IdentityChangeResult, okText: string, detail?: string): Promise<void> {
		let live = await this.verifyLive(it.key, change);
		if (!live) { await new Promise(r => setTimeout(r, 400)); live = await this.verifyLive(it.key, change); }
		await this.store.load(true);
		if (live) this.patch(it.key, { busy: null, edits: {}, draft: null, verifyExpect: null, notice: { type: 'ok', text: okText, detail } });
		else this.patch(it.key, { busy: null, edits: {}, draft: null, verifyExpect: change, notice: { type: 'warn', text: 'حُفظ التغيير على الخادم، لكن لم يظهر بعد في بيان الموقع العام.', detail: 'لا تُعد الحفظ؛ اضغط «إعادة التحقق» ليُقرأ البيان من جديد.' } });
	}
	private async verifyLive(key: string, change: IdentityChangeResult): Promise<boolean> {
		if (!(await this.api.refreshPublic())) return false;
		const item = this.api.liveManifest().items[key];
		return change.isDefault || !change.active ? !item : item?.sha256 === change.active.sha256;
	}
	async recheck(it: IdentityItemInfo): Promise<void> {
		const ch = this.state(it.key).verifyExpect; if (!ch) return;
		this.patch(it.key, { busy: 'stage' });
		const ok = await this.verifyLive(it.key, ch);
		this.patch(it.key, ok ? { busy: null, verifyExpect: null, notice: { type: 'ok', text: 'تأكّد الآن: بيان الموقع يعرض النسخة المحفوظة.' } }
			: { busy: null, notice: { type: 'warn', text: 'ما زال بيان الموقع لا يعرض النسخة المحفوظة.', detail: 'الحفظ على الخادم تمّ. أعد التحقق بعد قليل أو أعد تحميل الصفحة.' } });
	}

	async cancel(it: IdentityItemInfo): Promise<void> {
		const draft = this.state(it.key).draft;
		this.patch(it.key, { busy: draft ? 'discard' : null });
		if (draft) { try { await firstValueFrom(this.api.discard(it.key, draft.versionId)); } catch { /* a draft that cannot be discarded harms nothing: it is never live */ } }
		this.patch(it.key, { busy: null, edits: {}, draft: null, notice: { type: 'ok', text: 'أُلغيت التعديلات والمسودة. الموقع كما هو.' } });
	}

	async restoreDefault(it: IdentityItemInfo): Promise<void> {
		if (it.state.isDefault) return;
		const ok = await this.confirmer.confirm({ title: 'العودة إلى قيم المنصة الأصلية', type: 'warning', size: 'md', confirmText: 'عُد إلى الأصل', cancelText: 'لا',
			message: `سيُزال كل تخصيص في «${it.label}» ويعود الموقع إلى قيمه الأصلية. التغيير بالتحديد:\n${this.diffText(it, {})}\n\nالنسخ المخصّصة تبقى محفوظة في السجل.` });
		if (!ok) return;
		await this.restore(it, 'default');
	}
	async restoreVersion(it: IdentityItemInfo, v: IdentityAssetMeta): Promise<void> {
		const ok = await this.confirmer.confirm({ title: `استعادة النسخة ${v.version}`, type: 'warning', size: 'md', confirmText: 'استعد هذه النسخة', cancelText: 'لا',
			message: `ستُطبَّق قيم النسخة ${v.version} (${Object.keys(v.value ?? {}).length} قيمة) على الموقع كله. التغيير بالتحديد عن المنشور الآن:\n${this.diffText(it, v.value ?? {})}\n\nتبقى النسخة الحالية في السجل.` });
		if (!ok) return;
		await this.restore(it, v.versionId);
	}
	private async restore(it: IdentityItemInfo, target: string): Promise<void> {
		this.patch(it.key, { busy: 'restore', notice: null });
		try {
			const r = await firstValueFrom(this.api.restore(it.key, target, it.state.stateVersion));
			await this.finish(it, r.data, r.data.isDefault ? 'عاد الموقع إلى القيم الأصلية.' : `استُعيدت النسخة ${r.data.toVersion ?? ''}.`.replace('  ', ' '));
		} catch (e) { await this.fail(it, e, 'الاستعادة'); }
	}
	private async fail(it: IdentityItemInfo, e: unknown, what: string): Promise<void> {
		const f = describeFailure(e, what);
		this.patch(it.key, { busy: null, notice: { type: f.kind === 'conflict' || f.kind === 'stale' ? 'conflict' : 'error', text: f.message, detail: f.kind === 'conflict' ? `الحالة الآن على الخادم: ${currentSummary(f.current)}` : undefined, failure: f } });
		if (f.kind === 'conflict') await this.store.load(true);
	}
	async reloadFromServer(it: IdentityItemInfo): Promise<void> { await this.store.load(true); this.patch(it.key, { edits: {}, draft: null, notice: { type: 'ok', text: 'أُعيد تحميل الحالة الحالية من الخادم.' } }); }

	/** versions that were live once and can be restored */
	restorable(it: IdentityItemInfo): IdentityAssetMeta[] { return (it.history ?? []).filter(v => (v.status === 'PUBLISHED' || v.status === 'SUPERSEDED') && v.versionId !== it.state.active?.versionId); }
	actor = actorName;
	keysOf(v: Record<string, string> | undefined): number { return v ? Object.keys(v).length : 0; }
	readonly isHex6 = isHex6;
	setActive(key: string): void { this.active.set(key); }
}
