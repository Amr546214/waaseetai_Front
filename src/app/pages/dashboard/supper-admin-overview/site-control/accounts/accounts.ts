import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TokenEditor } from '../platform-tokens/token-editor';
import { LevelsService, LevelRow } from '../../../../../core/levels/levels.service';
import { LevelBadgeComponent } from '../../../../../shared/levels/level-badge.component';
import { levelDisplayFromInfo } from '../../../../../core/levels/level-display';
import { LevelIdentityAdminApi, LevelIdentityChange, LevelIdentityRow, LevelIdentityView } from '../../../../../core/levels/level-identity-admin.api';
type Role = 'PROVIDER' | 'CLIENT' | 'MARKETER';
interface Draft { name: string; dark: string; light: string }
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * «هوية المستويات والشارات»: pick an account type and a level, then change its NAME and its COLOUR (dark / light). A save is written on the server (versioned, audited) and the new name and colour
 * show on the whole site for every user: dashboards, level pages, public profiles, badges. Percentages, thresholds and who is on which level are not edited here.
 * The raw badge tokens (text / background / border) stay available below as an advanced section.
 */
@Component({ selector: 'sc-accounts', standalone: true, imports: [TokenEditor, LevelBadgeComponent], encapsulation: ViewEncapsulation.ShadowDom, templateUrl: './accounts.html', styleUrls: ['../site-control-base.css', './accounts.css'] })
export class Accounts implements OnInit {
	readonly levels = inject(LevelsService);
	private readonly api = inject(LevelIdentityAdminApi);
	readonly role = signal<Role>('PROVIDER');
	readonly index = signal(1);
	readonly error = signal('');
	readonly busy = signal(false);
	readonly roles: { id: Role; label: string }[] = [{ id: 'PROVIDER', label: 'مقدّم الخدمة' }, { id: 'CLIENT', label: 'طالب الخدمة' }, { id: 'MARKETER', label: 'المسوّق' }];
	readonly themes: ('dark' | 'light')[] = ['dark', 'light'];
	readonly rows = computed(() => this.levels.payload()?.roles[this.role()]?.levels ?? []);
	readonly prefix = computed(() => '--comp-level-' + this.role().toLowerCase() + '-' + this.index() + '-');

	// ---- the identity editor (name + colours), backed by the server
	readonly view = signal<LevelIdentityView | null>(null);
	readonly draft = signal<Draft | null>(null);
	readonly saving = signal(false);
	readonly notice = signal<{ type: 'ok' | 'error' | 'conflict'; text: string } | null>(null);
	readonly current = computed<LevelIdentityRow | null>(() => this.view()?.rows.find(r => r.role === this.role() && r.level === this.index()) ?? null);
	readonly nameMax = computed(() => this.view()?.nameMax ?? 24);
	readonly nameProblem = computed(() => {
		const d = this.draft(), c = this.current(); if (!d || !c) return null;
		const n = d.name.trim().replace(/\s+/g, ' ');
		if (!n) return 'الاسم مطلوب (أو استعمل «إرجاع الاسم الأصلي»).';
		if (n.length > this.nameMax()) return `الاسم أطول من ${this.nameMax()} حرفًا.`;
		if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _\-.]*$/u.test(n)) return 'الاسم يقبل حروفًا وأرقامًا ومسافات وشرطات فقط.';
		const clash = this.view()!.rows.find(r => r.role === c.role && r.level !== c.level && r.name === n);
		return clash ? `الاسم مستعمل في المستوى ${clash.level} من القائمة نفسها.` : null;
	});
	readonly darkProblem = computed(() => { const d = this.draft(); return d && !HEX.test(d.dark) ? 'اللون بصيغة #rrggbb.' : null; });
	readonly lightProblem = computed(() => { const d = this.draft(); return d && !HEX.test(d.light) ? 'اللون بصيغة #rrggbb.' : null; });
	readonly changes = computed<LevelIdentityChange | null>(() => {
		const d = this.draft(), c = this.current(); if (!d || !c) return null;
		const name = d.name.trim().replace(/\s+/g, ' ');
		const out: LevelIdentityChange = { role: c.role, level: c.level };
		// a value equal to the default is sent as null (= default), anything else as the value
		if (name !== c.name) out.name = name === c.defaultName ? null : name;
		if (d.dark.toUpperCase() !== c.color.dark.toUpperCase()) out.dark = d.dark.toUpperCase() === c.defaultColor.dark.toUpperCase() ? null : d.dark.toUpperCase();
		if (d.light.toUpperCase() !== c.color.light.toUpperCase()) out.light = d.light.toUpperCase() === c.defaultColor.light.toUpperCase() ? null : d.light.toUpperCase();
		return out.name === undefined && out.dark === undefined && out.light === undefined ? null : out;
	});
	readonly canSave = computed(() => !!this.changes() && !this.nameProblem() && !this.darkProblem() && !this.lightProblem() && !this.saving());
	/** the badge as the draft would draw it (a live preview, nothing is saved) */
	readonly preview = computed(() => {
		const d = this.draft(), c = this.current(), row = this.levels.level(this.role(), this.index()); if (!d || !c) return null;
		return levelDisplayFromInfo({ role: this.role(), index: this.index(), total: 15, name: d.name.trim() || c.defaultName, percent: row?.percent, percentKind: this.role() === 'PROVIDER' ? 'PLATFORM_COMMISSION' : this.role() === 'CLIENT' ? 'CASHBACK' : 'EARNED_COMMISSION', color: { dark: HEX.test(d.dark) ? d.dark : c.color.dark, light: HEX.test(d.light) ? d.light : c.color.light } });
	});

	ngOnInit() { this.reload(); }
	reload() {
		this.busy.set(true); this.error.set('');
		this.levels.load().subscribe({ next: () => this.busy.set(false), error: () => { this.busy.set(false); this.error.set('تعذّر تحميل المستويات الفعلية من الخادم.'); } });
		void this.loadIdentity();
	}
	private async loadIdentity(keepNotice = false): Promise<void> {
		try { const r = await firstValueFrom(this.api.view()); this.view.set(r.data); this.resetDraft(); if (!keepNotice) this.notice.set(null); }
		catch (e) { this.view.set(null); this.draft.set(null); this.error.set(e instanceof HttpErrorResponse && e.status === 403 ? 'ليست لديك صلاحية تعديل هوية المستويات.' : 'تعذّر قراءة هوية المستويات من الخادم.'); }
	}
	private resetDraft() { const c = this.current(); this.draft.set(c ? { name: c.name, dark: c.color.dark, light: c.color.light } : null); }

	pickRole(r: Role) { this.role.set(r); this.index.set(1); this.notice.set(null); this.resetDraft(); }
	pickLevel(n: number) { this.index.set(n); this.notice.set(null); this.resetDraft(); }
	setName(v: string) { this.draft.update(d => d && { ...d, name: v }); }
	setColour(theme: 'dark' | 'light', v: string) { this.draft.update(d => d && { ...d, [theme]: v.startsWith('#') ? v : '#' + v }); }
	resetName() { const c = this.current(); if (c) this.setName(c.defaultName); }
	resetColour(theme: 'dark' | 'light') { const c = this.current(); if (c) this.setColour(theme, c.defaultColor[theme]); }
	revert() { this.resetDraft(); this.notice.set(null); }
	isEdited(r: LevelIdentityRow): boolean { return r.overridden.name || r.overridden.dark || r.overridden.light; }
	rowOf(level: number): LevelIdentityRow | null { return this.view()?.rows.find(r => r.role === this.role() && r.level === level) ?? null; }

	async save() {
		const ch = this.changes(), v = this.view(); if (!ch || !v || !this.canSave()) return;
		this.saving.set(true); this.notice.set(null);
		try {
			const r = await firstValueFrom(this.api.save(v.version, [ch]));
			this.view.set(r.data); this.resetDraft();
			this.levels.load().subscribe({ error: () => undefined }); // this page's own table follows at once; other sessions follow through the socket
			this.notice.set({ type: 'ok', text: 'تم الحفظ على الخادم، وظهر الاسم واللون الجديدان على الموقع لكل المستخدمين.' });
		} catch (e) {
			const err = e as HttpErrorResponse;
			if (err.status === 409) { this.notice.set({ type: 'conflict', text: err.error?.message ?? 'عُدّلت الهوية من جهة أخرى. أعد التحميل.' }); }
			else this.notice.set({ type: 'error', text: err.error?.errors?.[0]?.message ?? err.error?.message ?? 'تعذّر الحفظ. لم يتغيّر شيء على الموقع.' });
		} finally { this.saving.set(false); }
	}
	async reloadAfterConflict() { await this.loadIdentity(); this.levels.load().subscribe({ error: () => undefined }); this.notice.set(null); }

	display(row: LevelRow) { return levelDisplayFromInfo({ role: this.role(), index: row.level, total: 15, name: row.name, percent: row.percent, percentKind: this.role() === 'PROVIDER' ? 'PLATFORM_COMMISSION' : this.role() === 'CLIENT' ? 'CASHBACK' : 'EARNED_COMMISSION', color: row.color }); }
}
