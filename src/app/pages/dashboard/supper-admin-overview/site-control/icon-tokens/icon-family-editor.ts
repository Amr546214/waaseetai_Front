import { Component, ViewEncapsulation, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { IconFamilyDraft, IconFamilyInfo, IdentitySourceRef, IconFamilyPreview, IconFamilyPreviewBody, IdentityPreviewSide, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { ParsedSvgIcon, parseCustomSvg } from '../../../../../core/identity/identity-ai-icon';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { InlineSvgDirective } from '../identity/inline-svg.directive';
import { Failure, currentSummary, describeFailure } from '../identity/identity-view';
import { RealIconsService } from '../core/real-icons.service';
import { IconsService } from '../core/icons.service';
import { IconPicker, libraryDrawingSvg } from './icon-picker';
import { IconFnStore } from './icon-fn.store';

export interface FamilyNotice { type: 'ok' | 'warn' | 'error' | 'conflict'; text: string; detail?: string }
type Busy = null | 'upload' | 'preview' | 'apply' | 'discard';
type Mode = 'publish' | 'restore';
const readText = (b: Blob): Promise<string> => (typeof b.text === 'function' ? b.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(b); }));

/**
 * «العائلة»: ONE file applied to the keys of an icon family in ONE confirmed, atomic operation (all keys or none), with per-key editing left to the single-icon editor.
 * Flow (same contract as every identity change): upload (the server sanitises ONCE and stages the SAME bytes under every selected key as private drafts, the site does not change) ->
 * exact diff preview (private, publishes nothing, bound by a digest) -> explicit confirmation -> atomic publish -> success is shown only after the server answered 2xx AND the public manifest lists the new version for every changed key.
 * Restore of the whole family to the originals goes through the same preview + confirmation. A conflict or a stale preview never overwrites: the fresh state is shown and the operation must be confirmed again.
 */
@Component({
	selector: 'sc-icon-family-editor',
	standalone: true,
	imports: [InlineSvgDirective, IconPicker],
	templateUrl: './icon-family-editor.html',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../site-control-base.css', './icon-fn-editor.css', './icon-family-editor.css']
})
export class IconFamilyEditor {
	readonly familyId = input.required<string>();
	readonly canEdit = input(false);
	readonly changed = output<void>();
	readonly closed = output<void>();
	readonly openMember = output<string>();

	private readonly api = inject(SiteIdentityAdminApi);
	private readonly identity = inject(SiteIdentityService);
	private readonly confirmer = inject(ConfirmModalService);
	private readonly real = inject(RealIconsService);
	private readonly libs = inject(IconsService);
	/** the library icon chosen for the WHOLE family (not staged yet) */
	readonly pickId = signal<string | null>(null);
	readonly pickOpen = signal(false);
	readonly store = inject(IconFnStore);

	readonly phase = signal<'loading' | 'ready' | 'error'>('loading');
	readonly loadMessage = signal('');
	readonly family = signal<IconFamilyInfo | null>(null);
	readonly selected = signal<Set<string>>(new Set());
	readonly busy = signal<Busy>(null);
	readonly notice = signal<FamilyNotice | null>(null);
	readonly drafts = signal<IconFamilyDraft[]>([]);
	readonly preview = signal<IconFamilyPreview | null>(null);
	readonly mode = signal<Mode | null>(null);
	readonly fileName = signal('');
	/** drawn glyph of each side of the preview, by `key|cur` / `key|tgt` */
	readonly glyphs = signal<Record<string, ParsedSvgIcon | null>>({});
	private seq = 0;
	private lastBody: IconFamilyPreviewBody | null = null;

	readonly members = computed(() => this.family()?.members ?? []);
	readonly selectedKeys = computed(() => this.members().filter(m => this.selected().has(m.symbolId)).map(m => m.symbolId));
	readonly anyCustom = computed(() => this.members().some(m => m.status === 'custom'));
	readonly changedItems = computed(() => (this.preview()?.items ?? []).filter(i => i.change !== 'unchanged'));

	constructor() { effect(() => { const id = this.familyId(); untracked(() => { void this.load(id); }); }); }

	async load(id = this.familyId()): Promise<void> {
		const my = ++this.seq; this.phase.set('loading');
		try {
			const r = await firstValueFrom(this.api.family(id));
			if (my !== this.seq) return;
			if (!r?.data || !Array.isArray(r.data.members)) throw new Error('bad shape');
			this.family.set(r.data); this.phase.set('ready');
			this.selected.set(new Set(r.data.members.filter(m => m.status !== 'not-wired').map(m => m.symbolId)));
			void this.real.load();
		} catch (e) { if (my !== this.seq) return; this.phase.set('error'); this.loadMessage.set(describeFailure(e, 'قراءة العائلة من الخادم').message); }
	}

	toggle(symbolId: string): void { const s = new Set(this.selected()); if (s.has(symbolId)) s.delete(symbolId); else s.add(symbolId); this.selected.set(s); this.clearOperation(false); }
	selectAll(on: boolean): void { this.selected.set(new Set(on ? this.members().filter(m => m.status !== 'not-wired').map(m => m.symbolId) : [])); this.clearOperation(false); }
	defaultIcon(symbolId: string): ParsedSvgIcon | null { const t = this.real.fullSvg(symbolId); return t ? parseCustomSvg(t) : null; }

	private clearOperation(clearDrafts: boolean): void { this.preview.set(null); this.mode.set(null); this.lastBody = null; this.glyphs.set({}); if (clearDrafts) { this.drafts.set([]); this.fileName.set(''); } }

	// ------------------------------------------------------------ upload -> preview
	async onFile(ev: Event): Promise<void> {
		const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
		if (!file || !this.canEdit() || !this.selectedKeys().length) return;
		await this.stage(file, { kind: 'upload' });
	}
	/** library pick for the whole family: the chosen built-in drawing is staged as ONE sanitised copy under every selected key (`sourceRef` = the library icon), then the same exact-diff preview and confirmation */
	async stagePick(): Promise<void> {
		const id = this.pickId(); if (!id || !this.canEdit() || !this.selectedKeys().length || this.busy()) return;
		const svg = libraryDrawingSvg(this.real, this.libs, id);
		if (!svg) { this.notice.set({ type: 'error', text: 'لا رسم معروف لهذه الأيقونة في المكتبة، فلا يمكن اختيارها بديلًا.' }); return; }
		await this.stage(new File([svg], `${id}.svg`, { type: 'image/svg+xml' }), { kind: 'library', symbolId: id });
	}
	private async stage(file: File, ref: IdentitySourceRef): Promise<void> {
		this.fileName.set(file.name); this.busy.set('upload'); this.notice.set(null); this.clearOperation(true);
		try {
			const r = await firstValueFrom(this.api.familyUpload(this.familyId(), file, this.selectedKeys(), ref));
			this.drafts.set(r.data.drafts.map(d => ({ key: d.key, versionId: d.versionId })));
			const skipped = r.data.skipped?.length ? ` وتُرك ${r.data.skipped.length} لأن ما فيه مطابق لهذا الملف.` : '';
			this.notice.set({ type: 'ok', text: `فحص الخادم الملف مرة واحدة وحفظ النسخة نفسها كمسودة خاصة بك لـ${r.data.drafts.length} أيقونة.${skipped} لم يتغيّر الموقع بعد.`, detail: r.data.note ?? undefined });
			await this.runPreview('publish');
		} catch (e) { this.fail(e, ref.kind === 'library' ? 'اختيار الأيقونة من المكتبة للعائلة' : 'رفع الملف للعائلة'); }
		this.busy.set(null);
	}

	private async runPreview(mode: Mode, body?: IconFamilyPreviewBody): Promise<boolean> {
		const b: IconFamilyPreviewBody = body ?? (mode === 'publish' ? { mode: 'publish', drafts: this.drafts().map(d => ({ key: d.key, versionId: d.versionId })) } : { mode: 'restore', targets: 'default' });
		if (!this.busy()) this.busy.set('preview');
		try {
			const r = await firstValueFrom(this.api.familyPreview(this.familyId(), b));
			this.lastBody = b; this.mode.set(mode); this.preview.set(r.data); void this.loadGlyphs(r.data);
			return true;
		} catch (e) { this.fail(e, 'معاينة العملية'); return false; }
	}

	async previewRestore(): Promise<void> {
		this.notice.set(null); this.clearOperation(true);
		await this.runPreview('restore');
		this.busy.set(null);
	}

	private async loadGlyphs(p: IconFamilyPreview): Promise<void> {
		const out: Record<string, ParsedSvgIcon | null> = {};
		const one = async (key: string, side: IdentityPreviewSide, tag: string, symbolId: string) => {
			if (side.source === 'default' || !side.versionId) { out[`${key}|${tag}`] = this.defaultIcon(symbolId); return; }
			try { out[`${key}|${tag}`] = parseCustomSvg(await readText(await firstValueFrom(this.api.previewBlob(key, side.versionId))), side.sha256); } catch { out[`${key}|${tag}`] = null; }
		};
		await Promise.all(p.items.flatMap(i => [one(i.key, i.current, 'cur', i.symbolId), one(i.key, i.target, 'tgt', i.symbolId)]));
		if (this.preview() === p) this.glyphs.set(out);
	}
	glyph(key: string, tag: 'cur' | 'tgt'): ParsedSvgIcon | null { return this.glyphs()[`${key}|${tag}`] ?? null; }
	sideText(s: IdentityPreviewSide): string { return s.source === 'default' || !s.version ? 'الأصل' : `النسخة ${s.version}`; }
	changeText(c: string): string { return c === 'replace' ? 'سيتغيّر' : c === 'to-default' ? 'سيعود إلى الأصل' : 'بلا تغيير'; }

	// ------------------------------------------------------------ apply (atomic)
	async apply(): Promise<void> {
		const p = this.preview(), mode = this.mode(); if (!p || !mode || !p.canApply || this.busy()) return;
		const n = p.changedCount;
		const names = this.changedItems().map(i => `«${i.label}»`).join('، ');
		const ok = await this.confirmer.confirm({
			title: mode === 'publish' ? 'تطبيق الملف على كل أيقونات العائلة' : 'إرجاع أيقونات العائلة إلى الأصل', type: 'warning', size: 'md', confirmText: mode === 'publish' ? 'طبّق على الموقع' : 'عُد إلى الأصل', cancelText: 'لا',
			message: `هذا تعديل للعائلة كلها وليس لأيقونة واحدة (لتعديل أيقونة واحدة افتح «تعديل منفرد»). ${mode === 'publish' ? 'سيُطبَّق الرسم نفسه' : 'ستعود الأيقونات'} على ${n} أيقونة دفعة واحدة (كلها أو لا شيء): ${names}. يتغيّر الموقع لكل الزوّار فور التأكيد، وتبقى النسخ السابقة محفوظة للاستعادة. هذا هو الفرق الذي عاينته (بصمة ${p.previewDigest.slice(0, 8)}).`
		});
		if (!ok) return;
		this.busy.set('apply'); this.notice.set(null);
		const expected = Object.fromEntries(p.items.map(i => [i.key, i.stateVersion]));
		try {
			const body = this.lastBody!;
			const r = mode === 'publish'
				? await firstValueFrom(this.api.familyPublish(this.familyId(), (body as { drafts: { key: string; versionId: string }[] }).drafts, expected, p.previewDigest))
				: await firstValueFrom(this.api.familyRestore(this.familyId(), (body as { targets: { key: string; target: string }[] | 'default' }).targets, expected, p.previewDigest));
			await this.api.refreshPublic();
			// success only when the public manifest agrees for every changed key
			const wanted = new Map(p.items.filter(i => i.change !== 'unchanged').map(i => [i.key, i.target] as const));
			const wrong = [...wanted].filter(([k, t]) => { const live = this.identity.item(k); return t.source === 'default' ? !!live : live?.sha256 !== t.sha256; }).map(([k]) => k);
			this.clearOperation(true);
			await this.load(); await this.store.load(true); this.changed.emit();
			this.notice.set(wrong.length
				? { type: 'warn', text: `قبل الخادم العملية لكن القائمة العامة لم تُظهر كل التغييرات بعد في هذه الصفحة (${wrong.length}). حدّث الصفحة بعد لحظات للتأكد.` }
				: { type: 'ok', text: mode === 'publish' ? `طُبّق الملف على ${r.data.changedKeys.length} أيقونة معًا وظهر في القائمة العامة (نسخة القائمة ${r.data.manifestVersion}).` : `عادت ${r.data.changedKeys.length} أيقونة إلى الأصل معًا.` });
		} catch (e) { await this.failAsync(e, mode === 'publish' ? 'تطبيق الملف على العائلة' : 'إرجاع العائلة إلى الأصل'); }
		this.busy.set(null);
	}

	async discard(): Promise<void> {
		const d = this.drafts(); if (!d.length || this.busy()) return;
		this.busy.set('discard');
		try { await firstValueFrom(this.api.familyDiscard(this.familyId(), d.map(x => ({ key: x.key, versionId: x.versionId })))); this.notice.set({ type: 'ok', text: 'أُلغيت المسودات. الموقع كما هو.' }); }
		catch { this.notice.set({ type: 'warn', text: 'تعذّر حذف المسودات الآن؛ لا ضرر منها لأنها لا تظهر على الموقع، وتجدها في «مسودات» كل أيقونة.' }); }
		this.clearOperation(true); await this.load(); await this.store.load(true);
		this.busy.set(null);
	}

	private asNotice(f: Failure): FamilyNotice {
		return { type: f.kind === 'conflict' || f.kind === 'stale' ? 'conflict' : 'error', text: f.message, detail: f.kind === 'conflict' ? `الحالة الآن على الخادم: ${this.conflictSummary(f.current)}` : undefined };
	}
	private conflictSummary(c: unknown): string {
		const ks = (c as { keys?: unknown[] } | null)?.keys;
		return Array.isArray(ks) ? ks.map(k => `${(k as { key?: string }).key?.replace('icon.fn.', '') ?? ''}: ${currentSummary(k)}`).join('، ') : currentSummary(c);
	}
	private fail(e: unknown, what: string): void { this.notice.set(this.asNotice(describeFailure(e, what))); }
	private async failAsync(e: unknown, what: string): Promise<void> {
		const f = describeFailure(e, what);
		this.notice.set(this.asNotice(f));
		if (f.kind === 'stale' && f.current && typeof f.current === 'object' && Array.isArray((f.current as IconFamilyPreview).items)) {
			// the diff moved: the fresh one is shown and must be confirmed again (nothing was applied)
			const fresh = f.current as IconFamilyPreview; this.preview.set(fresh); void this.loadGlyphs(fresh);
		} else if (f.kind === 'conflict') { this.clearOperation(false); await this.load(); await this.store.load(true); }
	}
}
