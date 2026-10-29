import { Component, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconFnRow } from '../../../../../core/identity/site-identity-admin.api';
import { IconsService } from '../core/icons.service';
import { RealIconsService } from '../core/real-icons.service';
import { IconFnStore } from './icon-fn.store';

export const ALL_CATS = '__all';
const PAGE = 96;
const OTHER_CAT = '__other';
/** the official AI mark and every `*-ai` slot belong to the identity page, never a substitute for a function icon */
const isAiSlot = (id: string): boolean => /(^|-)ai$/.test(id);

export interface PickerCard { id: string; label: string; cat: string; vb: string; paint: Record<string, string>; inner: string; real: boolean }

/**
 * The «اختيار من المكتبة» half of «تخصيص» - the old per-card substitute chooser of the original panel (3406b84c: `<select class="icon-select">` + `reassignSlot`), now a visual one: every EXISTING icon of the site drawn with its real drawing,
 * the old library tabs as categories, a search box, and a click selects the substitute. Nothing is saved here: the parent shows the current-vs-new preview and the server apply.
 * Only icons that have a drawing are offered (a slot nothing draws would be an empty card); the AI mark and the icon itself are not offered.
 */
@Component({
	selector: 'sc-icon-picker',
	standalone: true,
	templateUrl: './icon-picker.html',
	encapsulation: ViewEncapsulation.ShadowDom,
	styleUrls: ['../site-control-base.css', './icon-picker.css']
})
export class IconPicker {
	/** the icon being customised (never offered as its own substitute) */
	readonly forId = input.required<string>();
	readonly selected = input<string | null>(null);
	readonly disabled = input(false);
	readonly pick = output<string>();

	private readonly store = inject(IconFnStore);
	private readonly real = inject(RealIconsService);
	private readonly icons = inject(IconsService);
	private readonly sanitizer = inject(DomSanitizer);

	readonly query = signal('');
	readonly cat = signal(ALL_CATS);
	readonly shown = signal(PAGE);

	private readonly libOf = computed<Map<string, { lib: string; label: string; svg: string }>>(() => {
		const m = new Map<string, { lib: string; label: string; svg: string }>();
		for (const lib of this.icons.pristine()) for (const ic of lib.icons) if (!m.has(ic.slot)) m.set(ic.slot, { lib: lib.id, label: ic.label, svg: ic.svg });
		return m;
	});
	private readonly catLabels = computed<Record<string, string>>(() => ({ ...Object.fromEntries(this.icons.pristine().map(l => [l.id, l.label])), [OTHER_CAT]: 'أيقونات أخرى في الموقع' }));

	/** every icon that HAS a drawing (the site's real symbol first, the library file's sample when no template draws it) */
	readonly cards = computed<PickerCard[]>(() => {
		const out: PickerCard[] = [];
		const seen = new Set<string>();
		const rows = (this.store.rows() as IconFnRow[]).filter(r => r.id !== this.forId() && !isAiSlot(r.id) && r.managedBy !== 'icon.ai');
		// the keys `pl-<area>-<glyph>` (one per place of a drawing that had no symbol) repeat drawings the library already offers: they come last and a drawing is offered ONCE, so the picker is not crowded by copies
		const order = [...rows.filter(r => !r.id.startsWith('pl-')), ...rows.filter(r => r.id.startsWith('pl-'))];
		for (const r of order) {
			const ri = this.real.get(r.id), lib = this.libOf().get(r.id);
			const sig = ri ? (ri.vb ?? '0 0 24 24') + '|' + ri.inner : '';
			if (r.id.startsWith('pl-') && sig && seen.has(sig)) continue;
			if (ri) { out.push({ id: r.id, label: r.label || lib?.label || r.id, cat: r.library ?? lib?.lib ?? OTHER_CAT, vb: ri.vb ?? '0 0 24 24', paint: ri.paint, inner: ri.inner, real: true }); seen.add(sig); }
			else if (lib) out.push({ id: r.id, label: r.label || lib.label || r.id, cat: lib.lib, vb: '0 0 24 24', paint: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, inner: lib.svg, real: false });
		}
		return out;
	});
	readonly cats = computed(() => {
		const counts = new Map<string, number>();
		for (const c of this.cards()) counts.set(c.cat, (counts.get(c.cat) ?? 0) + 1);
		const order = ['general', 'ws-site', OTHER_CAT].filter(i => counts.has(i));
		for (const i of counts.keys()) if (!order.includes(i)) order.push(i);
		return [{ id: ALL_CATS, label: 'الكل', count: this.cards().length }, ...order.map(id => ({ id, label: this.catLabels()[id] ?? id, count: counts.get(id) ?? 0 }))];
	});
	readonly filtered = computed<PickerCard[]>(() => {
		const q = this.query().trim().toLowerCase(), c = this.cat();
		return this.cards().filter(x => (c === ALL_CATS || x.cat === c) && (!q || x.id.toLowerCase().includes(q) || x.label.toLowerCase().includes(q)));
	});
	readonly visible = computed(() => this.filtered().slice(0, this.shown()));
	/** the rows that could not be offered because nothing draws them (counted, never shown as empty cards) */
	readonly undrawn = computed(() => (this.store.rows() as IconFnRow[]).filter(r => r.id !== this.forId() && !isAiSlot(r.id) && r.managedBy !== 'icon.ai' && !this.real.get(r.id) && !this.libOf().has(r.id)).length);
	readonly loading = computed(() => this.real.phase() === 'loading' || this.icons.phase() === 'loading' || this.store.phase() === 'loading');
	readonly failed = computed(() => !this.cards().length && !this.loading() && (this.real.phase() === 'error' || this.icons.phase() === 'error'));

	setQuery(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); this.shown.set(PAGE); }
	setCat(id: string): void { this.cat.set(id); this.shown.set(PAGE); }
	more(): void { this.shown.update(n => n + PAGE); }
	html(inner: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(inner); }
	retry(): void { void this.real.load(true); void this.icons.load(true); }
	/** `key` of the chosen card, for the parent */
	choose(c: PickerCard): void { if (!this.disabled()) this.pick.emit(c.id); }
}

/** the full SVG text of the built-in drawing of a library icon (what is copied to the server as the substitute); null when nothing draws it */
export function libraryDrawingSvg(real: RealIconsService, icons: IconsService, id: string): string | null {
	const r = real.fullSvg(id); if (r) return r;
	for (const lib of icons.pristine()) { const ic = lib.icons.find(i => i.slot === id); if (ic) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>`; }
	return null;
}
