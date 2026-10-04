import { Component, ElementRef, HostListener, OnDestroy, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';

/** Lucide-style names the API sends -> our local symbol (same mapping the marketplace pages already use). */
const ICON_NAMES: Record<string, string> = {
	palette: 'design', brush: 'design', 'pen-tool': 'design',
	code: 'code', 'code-2': 'code', terminal: 'code',
	feather: 'writing', edit: 'writing', 'file-text': 'writing', 'edit-3': 'writing',
	'trending-up': 'marketing', megaphone: 'marketing', target: 'marketing',
	video: 'video', film: 'video', clapperboard: 'video',
	languages: 'translate', globe: 'translate', 'book-open': 'translate',
	'message-circle': 'consult', 'message-square': 'consult', users: 'consult',
	'bar-chart': 'data', 'bar-chart-2': 'data', database: 'data', 'pie-chart': 'data',
	camera: 'photo', image: 'photo',
	music: 'audio', headphones: 'audio',
	mic: 'sound', radio: 'sound',
	scale: 'legal', gavel: 'legal', shield: 'legal',
	'graduation-cap': 'training', book: 'training',
	briefcase: 'admin', settings: 'admin',
	building: 'business', 'building-2': 'business',
	smartphone: 'mobile',
};
const KNOWN = new Set(['code', 'mobile', 'design', 'writing', 'marketing', 'video', 'translate', 'consult', 'data', 'photo', 'audio', 'sound', 'legal', 'training', 'admin', 'business']);

/**
 * Specialties bar of the marketplace (design P-MK-001): a sticky horizontal strip with "كل التخصصات" + one chip per
 * main specialty (icon, count, active state), a small hover dropdown with the sub-specialties, and a mega panel
 * (search, all specialties, the opened specialty's sub-specialties in columns, "عرض كل خدمات …").
 * All data comes from `categories` (the real /marketplace/categories response); links are the pages' own routes:
 * /marketplace/:slug and /marketplace/:slug?sub=:subSlug.
 */
@Component({
	selector: 'app-specialties-bar',
	standalone: true,
	imports: [RouterLink],
	templateUrl: './specialties-bar.html',
	styleUrl: './specialties-bar.css',
	encapsulation: ViewEncapsulation.None,
})
export class SpecialtiesBar implements OnDestroy {
	private readonly doc = inject(DOCUMENT);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	readonly categories = input<any[]>([]);
	/** Slug of the selected specialty ('' = none). */
	readonly activeCategory = input<string>('');
	readonly activeSub = input<string>('');
	/** Distance from the viewport top where the bar sticks (below the site header, and the search bar on the landing page). */
	readonly stickyTop = input<number>(64);

	readonly megaOpen = signal(false);
	readonly megaQuery = signal('');
	private readonly megaSlug = signal<string | null>(null);

	readonly hoverSlug = signal<string | null>(null);
	readonly dropPos = signal<{ top: number; left: number } | null>(null);
	private dropTimer: ReturnType<typeof setTimeout> | null = null;

	/** "كل التخصصات" counter: all sub-specialties, or the categories when none have subs. */
	readonly total = computed(() => {
		const subs = this.categories().reduce((n, c) => n + (c.subSpecialties?.length || 0), 0);
		return subs || this.categories().length;
	});

	private norm(s: unknown) { return String(s ?? '').toLowerCase().replace(/[ً-ٟـ]/g, '').trim(); }

	readonly filtered = computed(() => {
		const q = this.norm(this.megaQuery());
		if (!q) return this.categories();
		return this.categories().filter(c => this.norm(c.name).includes(q) || (c.subSpecialties || []).some((s: any) => this.norm(s.name).includes(q)));
	});

	/** The opened specialty (kept inside the filtered list; falls back to the first match). */
	readonly detail = computed(() => {
		const list = this.filtered();
		return list.find(c => c.slug === this.megaSlug()) || list[0] || null;
	});

	/** With a search text, the opened specialty's subs are narrowed to the matching ones (all of them when the category itself matches). */
	readonly detailSubs = computed(() => {
		const cat = this.detail();
		if (!cat) return [];
		const subs: any[] = cat.subSpecialties || [];
		const q = this.norm(this.megaQuery());
		if (!q || this.norm(cat.name).includes(q)) return subs;
		return subs.filter(s => this.norm(s.name).includes(q));
	});

	readonly hoverCat = computed(() => this.categories().find(c => c.slug === this.hoverSlug()) || null);

	icon(icon?: string): string {
		const id = icon ? (icon.startsWith('#') ? icon.slice(1) : icon).replace(/^ws-cat-/, '') : '';
		return `#spb-${KNOWN.has(id) ? id : (ICON_NAMES[id] ?? 'tag')}`;
	}

	// ── mega panel ──
	toggleMega() { this.megaOpen() ? this.closeMega() : this.openMega(); }

	openMega() {
		this.closeDrop();
		this.megaQuery.set('');
		this.megaSlug.set(this.activeCategory() || this.categories()[0]?.slug || null);
		this.megaOpen.set(true);
		this.lockScroll(true);
	}

	closeMega() {
		if (!this.megaOpen()) return;
		this.megaOpen.set(false);
		this.megaQuery.set('');
		this.lockScroll(false);
	}

	pickMega(slug: string) { this.megaSlug.set(slug); }

	onMegaSearch(event: Event) { this.megaQuery.set((event.target as HTMLInputElement).value); }

	@HostListener('document:keydown.escape')
	onEscape() { this.closeMega(); this.closeDrop(); }

	/** The sheet is a full-screen layer on phones: keep the page behind it from scrolling. */
	private lockScroll(on: boolean) {
		const phone = !!this.doc.defaultView?.matchMedia?.('(max-width: 768px)').matches;
		this.doc.documentElement.classList.toggle('spb-lock', on && phone);
	}

	// ── small hover dropdown (desktop pointers only; outside the scrolling strip so it is never clipped) ──
	openDrop(event: Event, cat: any) {
		if (this.megaOpen() || !(cat.subSpecialties?.length)) return;
		if (!this.doc.defaultView?.matchMedia?.('(hover: hover)').matches) return;
		this.cancelDropClose();
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const width = 230;
		const view = this.doc.documentElement.clientWidth;
		const left = Math.max(8, Math.min(rect.right - width, view - width - 8));
		this.dropPos.set({ top: rect.bottom, left });
		this.hoverSlug.set(cat.slug);
	}

	scheduleDropClose() {
		this.cancelDropClose();
		this.dropTimer = setTimeout(() => this.closeDrop(), 140);
	}

	cancelDropClose() { if (this.dropTimer) { clearTimeout(this.dropTimer); this.dropTimer = null; } }

	closeDrop() { this.cancelDropClose(); this.hoverSlug.set(null); this.dropPos.set(null); }

	/** Navigating from any link closes whatever is open. */
	onNavigate() { this.closeDrop(); this.closeMega(); }

	ngOnDestroy() { this.cancelDropClose(); this.lockScroll(false); this.doc.documentElement.classList.remove('spb-lock'); }
}
