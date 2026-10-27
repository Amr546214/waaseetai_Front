import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { PlatformInfoService } from '../../../../../core/services/platform-info.service';
import { IdentityActor, IdentityAssetMeta, IdentityChangeResult, IdentityHistory, IdentityItemInfo, IdentityKeyCurrent, IdentityOverview, IdentityPreviewRow, IdentityPreviewSide, IdentityRestoreSetPreview, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { ParsedSvgIcon, parseCustomSvg } from '../../../../../core/identity/identity-ai-icon';
import { WsDatePipe, formatWsDate } from '../../../../../shared/ws-date/ws-date.pipe';
import { DesignTokensService } from '../core/design-tokens.service';
import { ThemeModeService } from '../core/theme-mode.service';
import { InlineSvgDirective } from './inline-svg.directive';
import { CHANGE_KIND_TEXT, Failure, GROUP_TITLES, actorName, actorOf, bytesText, currentSummary, describeFailure, mimeName, parsePreview, previousVersion, restorable, shortId, shortSha, sideText, sizeText, versionName } from './identity-view';

type Phase = 'loading' | 'ready' | 'error' | 'denied' | 'unavailable';
export type Preview = { kind: 'img'; src: string | SafeUrl } | { kind: 'svg'; icon: ParsedSvgIcon } | { kind: 'err' };
export interface Notice { type: 'ok' | 'warn' | 'error' | 'conflict'; text: string; detail?: string; current?: unknown; retry?: 'upload' | 'apply' | 'verify' | 'restore' }
interface Draft { meta: IdentityAssetMeta; sanitized?: { changed: boolean; removed: unknown } }
export interface KeyUi {
	file: File | null; busy: null | 'upload' | 'apply' | 'discard' | 'restore' | 'verify'; draft: Draft | null; notice: Notice | null;
	allVersions: IdentityAssetMeta[] | null; lastRestore: IdentityAssetMeta | 'default' | null; verifyExpect: IdentityChangeResult | null;
}
const FRESH: KeyUi = { file: null, busy: null, draft: null, notice: null, allVersions: null, lastRestore: null, verifyExpect: null };
type SetRow = IdentityHistory['manifest'][number];

/** the official AI mark as the site draws it by default (inner markup of core/constants/ai-icon.ts) */
const DEFAULT_AI_ICON: ParsedSvgIcon | null = (() => {
	try { return parseCustomSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${AI_ICON_INNER}</svg>`); } catch { return null; }
})();

const readText = (b: Blob): Promise<string> => (typeof b.text === 'function' ? b.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(b); }));

/**
 * «الهوية»: the server-backed identity manager of «التحكم بالموقع». The platform's logos, favicon and AI icon are stored (versioned) on the server and every consumer reads them through the
 * identity service. Nothing here is a success until the SERVER answered 200 (it answers only after its transaction committed and the stored bytes were read back and verified) and the public
 * manifest shows the new active version. The look of the site never changes while a file is only staged.
 */
@Component({
	selector: 'sc-identity',
	standalone: true,
	imports: [RouterLink, NgTemplateOutlet, WsDatePipe, InlineSvgDirective],
	templateUrl: './identity.html',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../site-control-base.css', './identity.css']
})
export class Identity implements OnInit, OnDestroy {
	private readonly api = inject(SiteIdentityAdminApi);
	private readonly confirmer = inject(ConfirmModalService);
	private readonly sanitizer = inject(DomSanitizer);
	private readonly platform = inject(PlatformInfoService);
	private readonly access = inject(AdminAccessService);
	private readonly tokens = inject(DesignTokensService);
	readonly theme = inject(ThemeModeService);

	readonly phase = signal<Phase>('loading');
	readonly loadMessage = signal('');
	readonly data = signal<IdentityOverview | null>(null);
	readonly pageNotice = signal<Notice | null>(null);
	readonly uiMap = signal<Record<string, KeyUi>>({});
	readonly previews = signal<Record<string, Preview>>({});
	/**
	 * editing needs BOTH the server's word (`canManage`: true for site.manage OR the older «التحكم بالموقع» grant site_control.manage, which the server maps onto the edit capability) and the same
	 * permission here. site.view alone only READS. (Round 5: the legacy grant is no longer read-only.)
	 */
	readonly canManage = computed(() => this.data()?.canManage === true && (this.access.can('site.manage') || this.access.can('site_control.manage')));
	readonly items = computed<IdentityItemInfo[]>(() => this.data()?.items ?? []);
	readonly platformName = computed(() => this.platform.brand());
	readonly canOpenSettings = computed(() => this.access.allows({ anyOf: ['settings.view', 'settings.manage'] }));
	readonly notIdentity = computed(() => (Array.isArray(this.data()?.notIdentity) ? (this.data()!.notIdentity as unknown[]).filter((x): x is string => typeof x === 'string') : []));
	readonly unregistered = computed(() => (Array.isArray(this.data()?.unregisteredAssets) ? (this.data()!.unregisteredAssets as { path?: string; reason?: string }[]).filter(x => x && typeof x.path === 'string') : []));
	readonly wiredCount = computed(() => this.items().filter(i => i.wired).length);
	readonly groups = computed(() => {
		const order = ['logo', 'favicon', 'icon', 'character'];
		const ids = [...new Set([...order, ...this.items().map(i => i.group)])];
		return ids.map(id => ({ id, ...(GROUP_TITLES[id] ?? { title: id, hint: '' }), items: this.items().filter(i => i.group === id) })).filter(g => g.items.length);
	});

	// whole-set history
	readonly setRows = signal<SetRow[]>([]);
	readonly setPhase = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
	readonly setHasMore = signal(false);
	readonly setBusy = signal(false);
	readonly setNotice = signal<Notice | null>(null);
	/** the exact diff of the whole-set restore being reviewed (Round 2): the confirmation is bound to THIS state through its digest */
	readonly setPreview = signal<{ phase: 'loading' | 'ready' | 'error'; manifestVersion: number; at?: string; data?: IdentityRestoreSetPreview; message?: string; stale?: boolean } | null>(null);
	readonly copied = signal('');

	private readonly inflight = new Set<string>();
	private readonly objectUrls: string[] = [];
	private destroyed = false;

	ngOnInit(): void { void this.load(); }
	ngOnDestroy(): void { this.destroyed = true; for (const u of this.objectUrls) { try { URL.revokeObjectURL(u); } catch { /* ignore */ } } this.objectUrls.length = 0; }

	setMode(mode: 'dark' | 'light'): void { this.tokens.setMode(mode); }

	// ---------------------------------------------------------------- loading
	async load(silent = false): Promise<void> {
		if (!silent) this.phase.set('loading');
		try {
			const r = await firstValueFrom(this.api.overview());
			if (this.destroyed) return;
			if (!r?.data || !Array.isArray(r.data.items)) throw new Error('bad shape');
			this.data.set(r.data);
			this.phase.set('ready');
			void this.loadActivePreviews();
			if (!silent || this.setPhase() === 'idle') void this.loadSetHistory();
		} catch (e) {
			if (this.destroyed) return;
			const f = describeFailure(e, 'قراءة هوية الموقع');
			if (silent && this.data()) { this.pageNotice.set({ type: 'warn', text: 'تعذّر تحديث الصفحة من الخادم. الأرقام المعروضة قد لا تكون الأحدث.', detail: f.message }); return; }
			if (f.kind === 'denied' && f.status === 403) { this.phase.set('denied'); this.loadMessage.set('ليست لديك صلاحية عرض هوية الموقع (site.view). اطلب من مدير النظام منحك الصلاحية.'); }
			else if (f.kind === 'unavailable') { this.phase.set('unavailable'); this.loadMessage.set(f.message); }
			else { this.phase.set('error'); this.loadMessage.set(f.kind === 'network' ? 'تعذّر الاتصال بالخادم لقراءة هوية الموقع. الموقع نفسه لم يتأثر.' : 'تعذّر تحميل صفحة الهوية من الخادم. الموقع نفسه لم يتأثر.'); }
		}
	}

	/** the «تحديث من الخادم» button: overview and manifest history */
	async reload(): Promise<void> { await Promise.all([this.load(true), this.loadSetHistory()]); }

	async loadSetHistory(more = false): Promise<void> {
		this.setPhase.set('loading');
		try {
			const before = more ? this.setRows().at(-1)?.manifestVersion : undefined;
			const r = await firstValueFrom(this.api.history({ limit: 30, ...(before ? { before } : {}) }));
			const rows = r.data?.manifest ?? [];
			this.setRows.set(more ? [...this.setRows(), ...rows] : rows);
			this.setHasMore.set(r.data?.hasMore === true);
			this.setPhase.set('ready');
		} catch { this.setPhase.set('error'); }
	}

	private async loadActivePreviews(): Promise<void> {
		await Promise.all(this.items().filter(i => i.state.active).map(i => this.ensurePreview(i.key, i.state.active!)));
	}

	// ---------------------------------------------------------------- previews
	/** the server's own bytes of a version, fetched with the admin token and shown from a blob URL that only this tab holds */
	async ensurePreview(key: string, meta: IdentityAssetMeta): Promise<void> {
		if (this.previews()[meta.versionId]) return;
		try {
			const blob = await firstValueFrom(this.api.previewBlob(key, meta.versionId));
			let p: Preview;
			if (meta.mime === 'image/svg+xml') {
				const icon = parseCustomSvg(await readText(blob));
				p = icon ? { kind: 'svg', icon } : { kind: 'err' };
			} else {
				const url = URL.createObjectURL(blob); this.objectUrls.push(url);
				p = { kind: 'img', src: this.sanitizer.bypassSecurityTrustUrl(url) };
			}
			if (!this.destroyed) this.previews.update(m => ({ ...m, [meta.versionId]: p }));
		} catch { if (!this.destroyed) this.previews.update(m => ({ ...m, [meta.versionId]: { kind: 'err' } })); }
	}
	/** what the site shows when no custom version is published */
	defaultPreview(it: IdentityItemInfo): Preview | null {
		const d = it.defaultAsset;
		if (d.type === 'file') return { kind: 'img', src: d.path };
		return it.kind === 'svg' && DEFAULT_AI_ICON ? { kind: 'svg', icon: DEFAULT_AI_ICON } : null;
	}
	currentPreview(it: IdentityItemInfo): Preview | null {
		const a = it.state.active;
		return a ? (this.previews()[a.versionId] ?? null) : this.defaultPreview(it);
	}
	previewOf(v: IdentityAssetMeta | null | undefined): Preview | null { return v ? (this.previews()[v.versionId] ?? null) : null; }
	/** icons and the favicon are squares at 16/24/32/64; logos are measured by height (the site fixes the height only) */
	sizeSet(it: IdentityItemInfo): { square: boolean; list: number[] } {
		if (it.group === 'icon' || it.group === 'favicon') return { square: true, list: [16, 24, 32, 64] };
		if (it.group === 'logo') return { square: false, list: [24, 34, 48] };
		return { square: false, list: [] };
	}
	bigSize(it: IdentityItemInfo): number { return it.group === 'character' ? 84 : 64; }

	// ---------------------------------------------------------------- per-key state
	ui(key: string): KeyUi { return this.uiMap()[key] ?? FRESH; }
	private patch(key: string, p: Partial<KeyUi>): void { this.uiMap.update(m => ({ ...m, [key]: { ...(m[key] ?? FRESH), ...p } })); }
	item(key: string): IdentityItemInfo | undefined { return this.items().find(i => i.key === key); }
	label(key: string): string { return this.item(key)?.label ?? key; }
	canEdit(it: IdentityItemInfo): boolean { return this.canManage() && it.wired && it.editable; }
	private claim(id: string): boolean { if (this.inflight.has(id)) return false; this.inflight.add(id); return true; }
	private release(id: string): void { this.inflight.delete(id); }
	stagedOf(it: IdentityItemInfo): IdentityAssetMeta[] { const cur = this.ui(it.key).draft?.meta.versionId; return (it.staged ?? []).filter(s => s.status === 'STAGED' && s.versionId !== cur); }
	restorable(it: IdentityItemInfo): IdentityAssetMeta[] { return restorable(it); }
	previous(it: IdentityItemInfo): IdentityAssetMeta | null { return previousVersion(it); }
	versions(it: IdentityItemInfo): IdentityAssetMeta[] { return (this.ui(it.key).allVersions ?? it.history ?? []).filter(v => v.status === 'PUBLISHED' || v.status === 'SUPERSEDED'); }
	isActive(it: IdentityItemInfo, v: IdentityAssetMeta): boolean { return it.state.active?.versionId === v.versionId; }
	acceptOf(it: IdentityItemInfo): string { return it.allowedMimes.join(','); }

	// shared display helpers for the template
	bytes = bytesText; mime = mimeName; dim = sizeText; sha = shortSha; who = shortId; vname = versionName;
	groupTitle(g: string): string { return GROUP_TITLES[g]?.title ?? g; }
	currentFacts(it: IdentityItemInfo): { source: string; mime: string; size: string; bytes: string; sha: string } {
		const a = it.state.active, f = it.defaultFingerprint;
		return a
			? { source: `مخصّص — النسخة ${a.version}`, mime: mimeName(a.mime), size: sizeText(a.width, a.height), bytes: bytesText(a.byteSize), sha: a.sha256 }
			: { source: 'الأصل الافتراضي المنشور اليوم', mime: mimeName(f.mime), size: sizeText(f.width, f.height), bytes: bytesText(f.byteSize), sha: f.sha256 };
	}
	rulesOf(it: IdentityItemInfo): string[] { return Array.isArray(it.rules) ? (it.rules as unknown[]).filter((x): x is string => typeof x === 'string') : []; }
	currentSummary = currentSummary;
	/** «by whom»: the server's `{ id, name }` (name null = «غير معروف»); never an e-mail */
	actorName = actorName; sideText = sideText; kindText = CHANGE_KIND_TEXT;
	conflictActor(c: unknown): IdentityActor | null { return actorOf((c as Partial<IdentityKeyCurrent> | null)?.updatedBy); }
	async copyId(id: string): Promise<void> {
		try { await navigator.clipboard.writeText(id); this.copied.set(id); setTimeout(() => { if (this.copied() === id) this.copied.set(''); }, 2500); } catch { this.copied.set(''); }
	}
	conflictAt(c: unknown): string | null { return ((c as Partial<IdentityKeyCurrent> | null)?.updatedAt) ?? null; }
	labelsOf(keys: string[]): string { return keys.map(k => this.label(k)).join('، '); }

	// ---------------------------------------------------------------- upload
	onFile(key: string, ev: Event): void {
		const input = ev.target as HTMLInputElement;
		const f = input.files?.[0] ?? null;
		if (this.ui(key).busy) { input.value = ''; return; }
		this.patch(key, { file: f, notice: null });
		input.value = ''; // the same file can be chosen again after a failure
	}
	clearFile(key: string): void { if (!this.ui(key).busy) this.patch(key, { file: null, notice: null }); }

	async upload(key: string): Promise<void> {
		const it = this.item(key), u = this.ui(key);
		if (!it || !this.canEdit(it) || !u.file || u.busy || !this.claim(key)) return;
		this.patch(key, { busy: 'upload', notice: null });
		try {
			const r = await firstValueFrom(this.api.upload(key, u.file));
			const meta = r.data;
			this.patch(key, { busy: null, file: null, draft: { meta, sanitized: meta.sanitized }, notice: null });
			await this.ensurePreview(key, meta);
			void this.load(true);
		} catch (e) {
			const f = describeFailure(e, 'رفع الملف');
			// a rejected file cannot succeed again: the selection is cleared; a network/server failure keeps it so the retry needs no new choice
			this.patch(key, { busy: null, file: f.kind === 'rejected' ? null : u.file, notice: this.noticeFrom(f, 'upload') });
		} finally { this.release(key); }
	}

	async openDraft(key: string, meta: IdentityAssetMeta): Promise<void> {
		if (this.ui(key).busy) return;
		this.patch(key, { draft: { meta }, notice: null });
		await this.ensurePreview(key, meta);
	}

	async discard(key: string, meta?: IdentityAssetMeta): Promise<void> {
		const u = this.ui(key), m = meta ?? u.draft?.meta;
		if (!m || u.busy || !this.claim(key)) return;
		this.patch(key, { busy: 'discard', notice: null });
		try {
			await firstValueFrom(this.api.discard(key, m.versionId));
			this.dropPreview(m.versionId);
			this.patch(key, { busy: null, draft: u.draft?.meta.versionId === m.versionId ? null : u.draft, notice: { type: 'ok', text: 'أُلغي الملف المرفوع وحُذفت مسودته من الخادم. لم يتغيّر شيء في الموقع.' } });
			void this.load(true);
		} catch (e) {
			const f = describeFailure(e, 'إلغاء المسودة');
			this.patch(key, { busy: null, notice: this.noticeFrom(f, undefined) });
		} finally { this.release(key); }
	}
	private dropPreview(versionId: string): void { this.previews.update(m => { const { [versionId]: _gone, ...rest } = m; void _gone; return rest; }); }

	// ---------------------------------------------------------------- publish / restore
	/** the text of the apply confirmation: element (label + key), from -> to version, and every place of the platform where it will change (the registry's usages) */
	applyMessage(it: IdentityItemInfo, d: Draft): string {
		const from = it.state.active, MAX = 20;
		const uses = (it.usages ?? []).map(u => u.where);
		const shown = uses.slice(0, MAX).map(u => `• ${u}`).join('\n') + (uses.length > MAX ? `\n• و${uses.length - MAX} مواضع أخرى` : '');
		return `العنصر: ${it.label} (${it.key})\nمن: ${from ? `النسخة ${from.version} (البصمة ${shortSha(from.sha256)})` : 'الأصل الافتراضي'}\nإلى: النسخة ${d.meta.version} (البصمة ${shortSha(d.meta.sha256)})\n\nستُنشر النسخة المرفوعة نفسها التي عاينتَها (لا يُعاد رفع الملف)، وسيتغيّر هذا العنصر لدى جميع الزوار في مواضع استخدامه في المنصة:\n${shown || '• (لا مواضع مسجّلة)'}\n\nتبقى النسخة الحالية محفوظة في السجل ويمكن العودة إليها.`;
	}

	/** «تطبيق»: ALWAYS behind a confirmation that names the element and the versions; confirming publishes the already staged version id (the file is never uploaded again) */
	async apply(key: string): Promise<void> {
		const it = this.item(key), u = this.ui(key), d = u.draft;
		if (!it || !this.canEdit(it) || !d || u.busy || d.meta.isMine === false || !this.claim(key)) return; // claim() also keeps a second click from opening a second dialog
		const ok = await this.confirmer.confirm({
			title: `تطبيق على الموقع — ${it.label}`,
			message: this.applyMessage(it, d),
			type: 'warning', confirmText: 'تطبيق على الموقع', cancelText: 'إلغاء', size: 'md'
		});
		if (!ok) { this.release(key); return; }
		this.patch(key, { busy: 'apply', notice: null });
		try {
			const res = await firstValueFrom(this.api.publish(key, d.meta.versionId, it.state.stateVersion));
			this.patch(key, { draft: null });
			await this.afterChange(key, res.data, `طُبِّقت ${versionName(res.data.active)} على الموقع`);
		} catch (e) {
			const f = describeFailure(e, 'تطبيق النسخة');
			this.patch(key, { busy: null, notice: this.noticeFrom(f, 'apply') });
		} finally { this.release(key); }
	}

	/** «استعادة النسخة السابقة» / «استعادة الأصل الافتراضي» / restore-to-this-version: always behind a dialog that names the key and both versions */
	async restore(key: string, target: IdentityAssetMeta | 'default'): Promise<void> {
		const it = this.item(key), u = this.ui(key);
		if (!it || !this.canEdit(it) || u.busy) return;
		const from = it.state.active;
		if (target === 'default' && !from) return;
		if (!this.claim(key)) return; // also blocks a second dialog from a double click
		const toName = target === 'default' ? 'الأصل الافتراضي (الشعار/الأيقونة المنشورة قبل أي تعديل)' : `النسخة ${target.version} (البصمة ${shortSha(target.sha256)})`;
		const ok = await this.confirmer.confirm({
			title: target === 'default' ? `استعادة الأصل الافتراضي — ${it.label}` : `استعادة نسخة سابقة — ${it.label}`,
			message: `المفتاح: ${it.label} (${it.key})\nالنسخة الحالية: ${from ? `النسخة ${from.version} (البصمة ${shortSha(from.sha256)})` : 'الأصل الافتراضي'}\nستُستعاد: ${toName}\n\nيتغيّر الموقع لدى جميع الزوار فور التأكيد، وتبقى النسخة الحالية محفوظة في السجل ويمكن العودة إليها.`,
			type: 'warning', confirmText: 'استعادة', cancelText: 'إلغاء', size: 'md'
		});
		if (!ok) { this.release(key); return; }
		this.patch(key, { busy: 'restore', notice: null, lastRestore: target });
		try {
			const res = await firstValueFrom(this.api.restore(key, target === 'default' ? 'default' : target.versionId, it.state.stateVersion));
			await this.afterChange(key, res.data, target === 'default' ? 'استُعيد الأصل الافتراضي' : `استُعيدت النسخة ${target.version}`);
		} catch (e) {
			const f = describeFailure(e, 'الاستعادة');
			this.patch(key, { busy: null, notice: this.noticeFrom(f, 'restore') });
		} finally { this.release(key); }
	}
	retryRestore(key: string): void { const t = this.ui(key).lastRestore; if (t) void this.restore(key, t); }

	/** success is declared only after the manifest of the site (read again now) shows exactly what the server said it activated */
	private async afterChange(key: string, change: IdentityChangeResult, okText: string): Promise<void> {
		let live = await this.verifyLive(key, change);
		if (!live) { await new Promise(r => setTimeout(r, 400)); live = await this.verifyLive(key, change); }
		await this.load(true);
		void this.loadSetHistory(); // every publish / restore adds a row to the manifest history
		if (live) this.patch(key, { busy: null, verifyExpect: null, notice: { type: 'ok', text: `${okText}.`, detail: 'تأكّد الخادم من حفظ الملف وتحقّق من بصمته، وبيان الموقع يعرض الآن هذه النسخة؛ هذا التبويب تحدّث فورًا والتبويبات الأخرى تلحق به خلال لحظات.' } });
		else this.patch(key, { busy: null, verifyExpect: change, notice: { type: 'warn', text: 'حُفظ التغيير على الخادم، لكن لم يظهر بعد في بيان الموقع العام.', detail: 'قد يكون الاتصال بطيئًا. لا تُعد الحفظ؛ اضغط «إعادة التحقق» ليُقرأ البيان من جديد.', retry: 'verify' } });
	}
	private async verifyLive(key: string, change: IdentityChangeResult): Promise<boolean> {
		const refreshed = await this.api.refreshPublic();
		if (!refreshed) return false;
		const it = this.api.liveManifest().items[key];
		return change.isDefault || !change.active ? !it : it?.sha256 === change.active.sha256;
	}
	async recheck(key: string): Promise<void> {
		const u = this.ui(key), ch = u.verifyExpect;
		if (!ch || u.busy || !this.claim(key)) return;
		this.patch(key, { busy: 'verify' });
		try {
			const ok = await this.verifyLive(key, ch);
			this.patch(key, ok
				? { busy: null, verifyExpect: null, notice: { type: 'ok', text: 'تأكّد الآن: بيان الموقع يعرض النسخة المحفوظة.' } }
				: { busy: null, notice: { type: 'warn', text: 'ما زال بيان الموقع لا يعرض النسخة المحفوظة.', detail: 'الحفظ على الخادم تمّ. أعد التحقق بعد قليل أو أعد تحميل الصفحة.', retry: 'verify' } });
		} finally { this.release(key); }
	}

	private noticeFrom(f: Failure, retry: Notice['retry'] | undefined): Notice {
		if (f.kind === 'conflict') return { type: 'conflict', text: f.message, current: f.current };
		return { type: 'error', text: f.message, retry: f.kind === 'rejected' || f.kind === 'denied' ? undefined : retry };
	}
	retry(key: string): void {
		const r = this.ui(key).notice?.retry;
		if (r === 'upload') void this.upload(key); else if (r === 'apply') void this.apply(key); else if (r === 'verify') void this.recheck(key); else if (r === 'restore') this.retryRestore(key);
	}
	dismissNotice(key: string): void { this.patch(key, { notice: null }); }
	/** after a conflict: read the winner's state again; the staged file stays and can be applied on purpose against the new state */
	async reloadAfterConflict(key: string): Promise<void> {
		if (this.ui(key).busy) return;
		this.patch(key, { busy: 'verify' });
		await this.load(true);
		this.patch(key, { busy: null, notice: { type: 'warn', text: 'حُمِّلت الحالة الحالية من الخادم.', detail: this.ui(key).draft ? 'ما زال الملف المرفوع جاهزًا: قارنه بالحالي ثم اضغط «تطبيق» إن كنت لا تزال تريده؛ لن يُكتب فوق عمل غيرك دون علمك.' : 'راجع الحالة الجديدة قبل أي تعديل.' } });
	}

	async loadAllVersions(key: string): Promise<void> {
		if (this.ui(key).busy || !this.claim(key)) return;
		this.patch(key, { busy: 'verify' });
		try {
			const r = await firstValueFrom(this.api.history({ key, limit: 100 }));
			this.patch(key, { busy: null, allVersions: (r.data?.versions ?? []).filter(v => v.key === key) });
		} catch (e) { this.patch(key, { busy: null, notice: { type: 'error', text: describeFailure(e, 'قراءة كل النسخ').message } }); }
		finally { this.release(key); }
	}

	// ---------------------------------------------------------------- whole-set restore
	/** the exact preview endpoint: per key CURRENT vs TARGET, built by the server from the same logic the restore uses */
	async openSetPreview(manifestVersion: number, at?: string): Promise<void> {
		if (!this.canManage() || this.setBusy() || this.setPreview()?.phase === 'loading') return;
		this.setNotice.set(null);
		this.setPreview.set({ phase: 'loading', manifestVersion, at });
		try {
			const r = await firstValueFrom(this.api.restoreSetPreview(manifestVersion));
			const data = parsePreview(r.data);
			if (!data) throw new Error('bad preview');
			this.setPreview.set({ phase: 'ready', manifestVersion, at, data });
			void this.loadPreviewSides(data);
		} catch (e) {
			const f = describeFailure(e, 'قراءة معاينة الاستعادة');
			this.setPreview.set({ phase: 'error', manifestVersion, at, message: f.message });
		}
	}
	closeSetPreview(): void { if (!this.setBusy()) this.setPreview.set(null); }
	private async loadPreviewSides(d: IdentityRestoreSetPreview): Promise<void> {
		const jobs: Promise<void>[] = [];
		for (const r of d.items) if (r.change !== 'unchanged') for (const s of [r.current, r.target]) if (s.source === 'custom' && s.versionId) jobs.push(this.ensurePreview(r.key, { versionId: s.versionId, mime: s.mime } as IdentityAssetMeta));
		await Promise.all(jobs);
	}
	/** what a preview side looks like: the stored bytes of the custom version, or the built-in default of that key */
	sidePreview(row: IdentityPreviewRow, side: IdentityPreviewSide): Preview | null {
		if (side.source === 'custom') return side.versionId ? (this.previews()[side.versionId] ?? null) : null;
		const it = this.item(row.key);
		return it ? this.defaultPreview(it) : null;
	}
	previewItem(row: IdentityPreviewRow): IdentityItemInfo { return this.item(row.key) ?? ({ key: row.key, group: row.group, kind: 'raster' } as IdentityItemInfo); }
	changedRows(d: IdentityRestoreSetPreview): IdentityPreviewRow[] { return d.items.filter(r => r.change !== 'unchanged'); }
	unchangedRows(d: IdentityRestoreSetPreview): IdentityPreviewRow[] { return d.items.filter(r => r.change === 'unchanged'); }

	/** executes ONLY the diff on screen: the digest of the preview travels with the request; the server refuses (409 stale) when the diff is no longer the same */
	async confirmSetRestore(): Promise<void> {
		const sp = this.setPreview(), d = this.data();
		if (!sp || sp.phase !== 'ready' || !sp.data || !d || !this.canManage() || this.setBusy() || !sp.data.canApply || !this.claim('set')) return;
		const pv = sp.data, mv = sp.manifestVersion, when = sp.at ? formatWsDate(sp.at, 'datetime') : '';
		const lines = this.changedRows(pv).map(r => `• ${r.label}: ${sideText(r.current)} ← ${sideText(r.target)} (${CHANGE_KIND_TEXT[r.change]})`).join('\n');
		const ok = await this.confirmer.confirm({
			title: mv === 0 ? 'استعادة الهوية الأصلية كاملة' : `استعادة نسخة هوية كاملة (#${mv})`,
			message: `${mv === 0 ? 'ستعود كل مفاتيح الهوية إلى الأصل الافتراضي المنشور اليوم.' : `ستعود هوية الموقع كلها إلى حالتها عند النسخة #${mv}${when ? ` (${when})` : ''}.`}\nالنسخة الحالية للبيان: #${pv.currentManifestVersion}\n\nالتغيير المعروض عليك بالضبط (${pv.changedCount}):\n${lines}\n\nيتغيّر الموقع لدى جميع الزوار فور التأكيد، وتبقى كل النسخ الحالية محفوظة في السجل. إن تغيّرت الهوية قبل التنفيذ فلن يُنفَّذ شيء وستُعرض عليك المعاينة المحدّثة.`,
			type: 'warning', confirmText: 'استعادة الهوية الكاملة', cancelText: 'إلغاء', size: 'lg'
		});
		if (!ok) { this.release('set'); return; }
		this.setBusy.set(true); this.setNotice.set(null);
		try {
			const res = await firstValueFrom(this.api.restoreSet(mv, pv.currentManifestVersion, pv.previewDigest));
			const refreshed = await this.api.refreshPublic();
			const liveOk = refreshed && this.api.liveManifest().version >= res.data.manifestVersion;
			this.setPreview.set(null);
			await this.load(true); await this.loadSetHistory();
			const changed = res.data.changedKeys ?? [];
			this.setNotice.set(liveOk
				? { type: 'ok', text: `استُعيدت الهوية إلى النسخة #${mv} (بيان الموقع الآن #${res.data.manifestVersion}).`, detail: changed.length ? `تغيّر: ${this.labelsOf(changed)}.` : undefined }
				: { type: 'warn', text: 'حُفظت الاستعادة على الخادم لكن لم يظهر بعد في بيان الموقع العام. أعد تحميل الصفحة بعد قليل.' });
		} catch (e) {
			const f = describeFailure(e, 'استعادة نسخة الهوية الكاملة');
			if (f.kind === 'stale') {
				// the state moved after the preview: NOTHING was executed; show the fresh diff and make the editor review it again
				const fresh = parsePreview(f.current);
				await this.load(true);
				if (fresh) { this.setPreview.set({ phase: 'ready', manifestVersion: mv, at: sp.at, data: fresh, stale: true }); void this.loadPreviewSides(fresh); }
				else void this.openSetPreview(mv, sp.at);
				this.setNotice.set({ type: 'conflict', text: f.message });
			} else if (f.kind === 'conflict') {
				this.setNotice.set({ type: 'conflict', text: f.message, current: f.current });
			} else this.setNotice.set({ type: 'error', text: f.message });
		} finally { this.setBusy.set(false); this.release('set'); }
	}
	async reloadAfterSetConflict(): Promise<void> {
		const sp = this.setPreview();
		await this.load(true); await this.loadSetHistory();
		if (sp) { this.setNotice.set({ type: 'warn', text: 'حُمِّلت الحالة الحالية. هذه معاينة محدّثة: راجعها ثم أكّد من جديد.' }); await this.openSetPreview(sp.manifestVersion, sp.at); }
		else this.setNotice.set({ type: 'warn', text: 'حُمِّلت الحالة الحالية. راجع القائمة ثم اختر النسخة من جديد إن كنت لا تزال تريدها.' });
	}
	setConflictManifest(c: unknown): number | null { const v = Number((c as { manifestVersion?: unknown } | null)?.manifestVersion); return Number.isFinite(v) ? v : null; }
}
