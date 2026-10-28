import { Component, ViewEncapsulation, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { IconFnItem, IconFnRow, IdentityAssetMeta, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { ParsedSvgIcon, parseCustomSvg } from '../../../../../core/identity/identity-ai-icon';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { iconFnKey } from '../../../../../core/identity/identity-icon-symbols';
import { InlineSvgDirective } from '../identity/inline-svg.directive';
import { Failure, actorName, bytesText, currentSummary, describeFailure } from '../identity/identity-view';
import { RealIconsService } from '../core/real-icons.service';
import { IconFnStore } from './icon-fn.store';
import { ICON_PLACES, IconPlaces } from './icon-places';

export interface IconNotice { type: 'ok' | 'warn' | 'error' | 'conflict'; text: string; detail?: string }
interface Draft { meta: IdentityAssetMeta; icon: ParsedSvgIcon | null; removedNote: string | null }
type Busy = null | 'upload' | 'apply' | 'discard' | 'restore';
const readText = (b: Blob): Promise<string> => (typeof b.text === 'function' ? b.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(b); }));

/**
 * The ONE editor of a single function icon (`icon.fn.<symbolId>`), inside the icon library page. Same flow and the same server pipeline as the identity page and the token editor:
 * upload (the server sanitises and stores a STAGED draft, the site does not change) -> preview (drawn with the site's own paint rules) -> apply (a versioned publish bound to the state you saw)
 * or cancel (the draft is discarded) -> restore (the previous version or the built-in default) -> conflict (someone else changed it first: nothing is overwritten, the current state is shown).
 * Nothing is a success until the server answered 2xx AND the public manifest shows the new version.
 */
@Component({
	selector: 'sc-icon-fn-editor',
	standalone: true,
	imports: [InlineSvgDirective],
	templateUrl: './icon-fn-editor.html',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../site-control-base.css', './icon-fn-editor.css']
})
export class IconFnEditor {
	readonly symbolId = input.required<string>();
	/** the library's own drawing of the default glyph (inner markup), when the id is a library slot */
	readonly defaultSvg = input<string | null>(null);
	/** list row of this icon (status, counters) */
	readonly row = input<IconFnRow | null>(null);
	readonly canEdit = input(false);
	readonly changed = output<void>();
	readonly closed = output<void>();

	private readonly api = inject(SiteIdentityAdminApi);
	private readonly identity = inject(SiteIdentityService);
	private readonly confirmer = inject(ConfirmModalService);
	readonly store = inject(IconFnStore);
	private readonly real = inject(RealIconsService);

	readonly phase = signal<'loading' | 'ready' | 'error'>('loading');
	readonly loadMessage = signal('');
	readonly item = signal<IconFnItem | null>(null);
	readonly busy = signal<Busy>(null);
	readonly draft = signal<Draft | null>(null);
	readonly notice = signal<IconNotice | null>(null);
	readonly published = signal<ParsedSvgIcon | null>(null);
	readonly fileName = signal('');
	/** where this icon is really seen (hand-written, guarded by icon-places.spec): followed vs NOT followed places */
	readonly places = computed<IconPlaces | null>(() => ICON_PLACES[this.symbolId()] ?? null);
	readonly key = computed(() => iconFnKey(this.symbolId()));
	readonly isCustom = computed(() => !!this.item() && !this.item()!.state.isDefault);
	readonly restorable = computed<IdentityAssetMeta[]>(() => (this.item()?.history ?? []).filter(v => (v.status === 'PUBLISHED' || v.status === 'SUPERSEDED') && v.versionId !== this.item()!.state.active?.versionId));
	readonly otherDrafts = computed<IdentityAssetMeta[]>(() => (this.item()?.staged ?? []).filter(v => v.versionId !== this.draft()?.meta.versionId));
	private seq = 0;

	constructor() {
		effect(() => { const id = this.symbolId(); untracked(() => { void this.load(id); }); });
	}

	actor = actorName;
	bytes = bytesText;
	/** the default glyph as the library draws it (inner markup wrapped in the site's outline defaults) */
	readonly defaultIcon = computed<ParsedSvgIcon | null>(() => {
		const real = this.real.fullSvg(this.symbolId()); if (real) return parseCustomSvg(real);
		const inner = this.defaultSvg(); if (!inner) return null;
		return parseCustomSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`);
	});

	async load(id: string, pickDraft = true): Promise<void> {
		const my = ++this.seq;
		this.phase.set('loading'); this.draft.set(null); this.notice.set(null); this.published.set(null); this.fileName.set('');
		try {
			const r = await firstValueFrom(this.api.iconItem(id));
			if (my !== this.seq) return;
			if (!r?.data || !r.data.state) throw new Error('bad shape');
			this.item.set(r.data); this.phase.set('ready');
			void this.loadPublished(r.data, my);
			// an earlier draft of mine is picked up, so leaving and coming back does not lose it
			const mine = (r.data.staged ?? []).filter(s => s.isMine !== false).sort((a, b) => b.version - a.version)[0];
			if (mine && pickDraft) void this.openDraft(mine, my);
		} catch (e) {
			if (my !== this.seq) return;
			const f = describeFailure(e, 'قراءة هذه الأيقونة من الخادم');
			this.phase.set('error'); this.loadMessage.set(f.message);
		}
	}

	private async textOf(v: IdentityAssetMeta): Promise<string> { return readText(await firstValueFrom(this.api.previewBlob(this.key(), v.versionId))); }

	private async loadPublished(it: IconFnItem, my: number): Promise<void> {
		const a = it.state.active; if (!a) { this.published.set(null); return; }
		try { const icon = parseCustomSvg(await this.textOf(a), a.sha256); if (my === this.seq) this.published.set(icon); } catch { if (my === this.seq) this.published.set(null); }
	}

	private async openDraft(meta: IdentityAssetMeta, my = this.seq, removedNote: string | null = null): Promise<void> {
		let icon: ParsedSvgIcon | null = null;
		try { icon = parseCustomSvg(await this.textOf(meta), meta.sha256); } catch { icon = null; }
		if (my !== this.seq) return;
		this.draft.set({ meta, icon, removedNote: removedNote ?? meta.note ?? null });
	}

	// ---------------------------------------------------------------- actions
	async onFile(ev: Event): Promise<void> {
		const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
		if (!file || !this.canEdit()) return;
		this.fileName.set(file.name);
		this.busy.set('upload'); this.notice.set(null);
		try {
			const r = await firstValueFrom(this.api.upload(this.key(), file));
			await this.openDraft(r.data, this.seq, r.data.sanitized?.changed ? 'نظّف الخادم الملف وأزال منه ما لا يسمح به (انظر الملاحظة).' : r.data.note ?? null);
			this.notice.set({ type: 'ok', text: 'تحقّق الخادم من الملف وحفظه كمسودة. لم يتغيّر الموقع بعد.', detail: r.data.note ?? undefined });
			await this.reloadItem();
		} catch (e) { this.fail(e, 'رفع الأيقونة'); }
		this.busy.set(null);
	}

	async apply(): Promise<void> {
		const d = this.draft(), it = this.item(); if (!d || !it || this.busy()) return;
		const ok = await this.confirmer.confirm({ title: 'تطبيق الأيقونة على الموقع كله', type: 'warning', size: 'md', confirmText: 'طبّق على الموقع', cancelText: 'لا تطبّق',
			message: `ستتغيّر أيقونة «${this.row()?.label ?? this.symbolId()}» في كل موضع يتبعها في الموقع${this.places() ? ` (${this.places()!.follows.length} موضعًا معروفًا)` : ''}، لكل الزوّار، فور التطبيق.${this.places()?.separate.length ? ` ${this.places()!.separate.length} أيقونات مشابهة لها مفاتيحها الخاصة ولن تتغيّر إلا إن عدّلتها (منفردة أو من «العائلة»).` : ''} تبقى النسخة الحالية محفوظة ويمكن الرجوع إلى الأصل في أي وقت.` });
		if (!ok) return;
		this.busy.set('apply'); this.notice.set(null);
		try {
			const r = await firstValueFrom(this.api.publish(this.key(), d.meta.versionId, it.state.stateVersion));
			await this.api.refreshPublic();
			const live = this.identity.item(this.key());
			await this.afterChange();
			this.notice.set(live && live.sha256 === d.meta.sha256
				? { type: 'ok', text: `طُبّقت النسخة ${r.data.toVersion ?? ''} على الموقع وظهرت في القائمة العامة.`.replace('  ', ' '), detail: `النسخة السابقة: ${r.data.fromVersion ? 'النسخة ' + r.data.fromVersion : 'الأصل الافتراضي'}` }
				: { type: 'warn', text: 'قبل الخادم التطبيق لكن القائمة العامة لم تُظهر النسخة الجديدة بعد في هذه الصفحة. حدّث الصفحة بعد لحظات للتأكد.' });
		} catch (e) { await this.failAsync(e, 'تطبيق الأيقونة'); }
		this.busy.set(null);
	}

	async cancel(): Promise<void> {
		const d = this.draft(); this.draft.set(null); this.fileName.set('');
		if (d) {
			this.busy.set('discard');
			try { await firstValueFrom(this.api.discard(this.key(), d.meta.versionId)); } catch { /* a draft that cannot be discarded harms nothing: it is never live */ }
			this.busy.set(null);
			await this.reloadItem();
		}
		this.notice.set({ type: 'ok', text: 'أُلغيت المسودة. الموقع كما هو.' });
	}

	async useDraft(v: IdentityAssetMeta): Promise<void> { this.notice.set(null); await this.openDraft(v); }

	async restoreDefault(): Promise<void> {
		const it = this.item(); if (!it || it.state.isDefault) return;
		const ok = await this.confirmer.confirm({ title: 'العودة إلى الأيقونة الأصلية', type: 'warning', size: 'md', confirmText: 'عُد إلى الأصل', cancelText: 'لا',
			message: `سيُزال التخصيص عن «${this.row()?.label ?? this.symbolId()}» ويعود الموقع إلى الأيقونة الأصلية في كل موضع. النسخ المخصّصة تبقى محفوظة في السجل.` });
		if (!ok) return;
		await this.restore('default');
	}
	async restoreVersion(v: IdentityAssetMeta): Promise<void> {
		const ok = await this.confirmer.confirm({ title: `استعادة النسخة ${v.version}`, type: 'warning', size: 'md', confirmText: 'استعد هذه النسخة', cancelText: 'لا', message: `ستُطبَّق النسخة ${v.version} على الموقع كله.` });
		if (ok) await this.restore(v.versionId);
	}
	private async restore(target: string): Promise<void> {
		const it = this.item(); if (!it) return;
		this.busy.set('restore'); this.notice.set(null);
		try {
			const r = await firstValueFrom(this.api.restore(this.key(), target, it.state.stateVersion));
			await this.api.refreshPublic();
			await this.afterChange();
			this.notice.set({ type: 'ok', text: r.data.isDefault ? 'عادت الأيقونة إلى الأصل في كل مواضعها.' : `استُعيدت النسخة ${r.data.toVersion ?? ''}.`.replace('  ', ' ') });
		} catch (e) { await this.failAsync(e, 'الاستعادة'); }
		this.busy.set(null);
	}

	async reloadFromServer(): Promise<void> { await this.afterChange(); this.notice.set({ type: 'ok', text: 'أُعيد تحميل الحالة الحالية من الخادم.' }); }

	private async reloadItem(): Promise<void> {
		try { const r = await firstValueFrom(this.api.iconItem(this.symbolId())); if (r?.data?.state) { this.item.set(r.data); void this.loadPublished(r.data, this.seq); } } catch { /* keep what is shown */ }
	}
	private async afterChange(): Promise<void> {
		this.draft.set(null); this.fileName.set('');
		await this.load(this.symbolId(), false); // after an apply / restore the editor starts clean: older drafts stay listed under «مسودات أخرى»
		await this.store.load(true);
		this.changed.emit();
	}

	private asNotice(f: Failure): IconNotice {
		return { type: f.kind === 'conflict' || f.kind === 'stale' ? 'conflict' : 'error', text: f.message, detail: f.kind === 'conflict' ? `الحالة الآن على الخادم: ${currentSummary(f.current)}` : undefined };
	}
	private fail(e: unknown, what: string): void { this.notice.set(this.asNotice(describeFailure(e, what))); }
	private async failAsync(e: unknown, what: string): Promise<void> {
		const f = describeFailure(e, what);
		this.notice.set(this.asNotice(f));
		if (f.kind === 'conflict') { await this.reloadItem(); await this.store.load(true); }
	}
}
