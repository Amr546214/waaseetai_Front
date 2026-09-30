import { Component, DestroyRef, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';

export type CuratedMode = 'top-rated' | 'most-ordered' | 'featured' | 'exclusive' | 'newest';

/**
 * One component, five design pages (route data `mode`):
 *   top-rated    → P-MK-018   most-ordered → P-MK-019   featured → P-MK-020
 *   exclusive    → P-MK-021   newest       → P-MK-022
 * Each mode keeps its own sort/filter over the real published models.
 */
interface CuratedModeConfig {
	sort: (a: MarketplaceModel, b: MarketplaceModel) => number;
	filter?: (m: MarketplaceModel) => boolean;
}

const createdTime = (m: MarketplaceModel): number => {
	const raw = (m as any).createdAt;
	const t = raw ? new Date(raw).getTime() : NaN;
	return Number.isFinite(t) ? t : 0;
};

const MODE_CONFIG: Record<CuratedMode, CuratedModeConfig> = {
	'top-rated': { sort: (a, b) => (b.rating || 0) - (a.rating || 0) },
	'most-ordered': { sort: (a, b) => (b.salesCount || 0) - (a.salesCount || 0) },
	'featured': {
		sort: (a, b) => (b.aiScore || 0) - (a.aiScore || 0),
		filter: m => !!m.isFeatured
	},
	'exclusive': {
		sort: (a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0),
		filter: m => !!m.discountPercentage && m.discountPercentage > 0
	},
	'newest': { sort: (a, b) => createdTime(b) - createdTime(a) }
};

/** Category filter value, plus the two discount pills of P-MK-021. */
type CategoryFilter = string;
const DISC_30 = '__disc30';
const DISC_50 = '__disc50';

type NewGroupKey = 'live' | 'today' | 'yesterday' | 'week' | 'older';
interface NewGroup {
	key: NewGroupKey;
	title: string;
	sub: string;
	dot: 'live' | 'today' | 'old';
	badge?: { cls: 'live' | 'today'; label: string };
	recent: boolean;
	items: MarketplaceModel[];
}

const HOUR = 3600 * 1000;
const PAGE_SIZE = 8;

@Component({
	selector: 'app-curated',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './curated.html',
	styleUrl: './curated.css'
})
export class CuratedComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private destroyRef = inject(DestroyRef);
	private marketplaceService = inject(MarketplaceService);
	private authStore = inject(AuthStore);

	readonly DISC_30 = DISC_30;
	readonly DISC_50 = DISC_50;

	mode = signal<CuratedMode>('top-rated');
	models = signal<MarketplaceModel[]>([]);
	loading = signal<boolean>(true);
	categoryFilter = signal<CategoryFilter>('all');
	viewMode = signal<'grid' | 'list'>('grid');
	visibleCount = signal<number>(PAGE_SIZE);
	showOlder = signal<boolean>(false);
	favoriteModels = signal<Set<string>>(new Set());
	/** Ticks every second on the exclusive page to drive the real offer countdowns. */
	now = signal<number>(Date.now());
	private tickHandle: ReturnType<typeof setInterval> | null = null;

	categories = computed(() => {
		const set = new Set<string>();
		this.models().forEach(m => { if (m.category) set.add(m.category); });
		return Array.from(set);
	});

	filteredModels = computed(() => {
		const list = this.models();
		const cat = this.categoryFilter();
		if (cat === 'all') return list;
		if (cat === DISC_30) return list.filter(m => (m.discountPercentage || 0) >= 30);
		if (cat === DISC_50) return list.filter(m => (m.discountPercentage || 0) >= 50);
		return list.filter(m => m.category === cat);
	});

	// ── Hero stats (all real, computed from the loaded list) ──
	averageRating = computed(() => {
		const list = this.models();
		if (!list.length) return '0.0';
		return (list.reduce((sum, m) => sum + (m.rating || 0), 0) / list.length).toFixed(1);
	});

	totalReviews = computed(() => this.models().reduce((sum, m) => sum + (m.reviewsCount || 0), 0));

	totalOrders = computed(() => this.models().reduce((sum, m) => sum + (m.salesCount || 0), 0));

	// Share of listed services rated 4.5+ — used as a real proxy for "customer satisfaction",
	// since the API doesn't expose a dedicated satisfaction metric.
	satisfactionRate = computed(() => {
		const list = this.models();
		if (!list.length) return 0;
		const satisfied = list.filter(m => (m.rating || 0) >= 4.5).length;
		return Math.round((satisfied / list.length) * 100);
	});

	maxDiscount = computed(() => this.models().reduce((max, m) => Math.max(max, m.discountPercentage || 0), 0));

	avgDiscount = computed(() => {
		const list = this.models();
		if (!list.length) return 0;
		return Math.round(list.reduce((sum, m) => sum + (m.discountPercentage || 0), 0) / list.length);
	});

	newTodayCount = computed(() => {
		const now = Date.now();
		return this.models().filter(m => { const t = createdTime(m); return t && now - t < 24 * HOUR; }).length;
	});

	newWeekCount = computed(() => {
		const now = Date.now();
		return this.models().filter(m => { const t = createdTime(m); return t && now - t < 7 * 24 * HOUR; }).length;
	});

	// ── Top-3 showcase ──
	// Podium (top-rated / most-ordered): rank 2, rank 1, rank 3 visual order, as in the design.
	podiumSlots = computed(() => {
		if (this.mode() !== 'top-rated' && this.mode() !== 'most-ordered') return [];
		const top3 = this.filteredModels().slice(0, 3);
		if (top3.length < 3) return [];
		return [
			{ model: top3[1], rank: 2 },
			{ model: top3[0], rank: 1 },
			{ model: top3[2], rank: 3 }
		];
	});

	// Featured / exclusive: one large card + up to two side cards.
	showcase = computed(() => {
		if (this.mode() !== 'featured' && this.mode() !== 'exclusive') return [];
		return this.filteredModels().slice(0, 3);
	});

	restModels = computed(() => {
		const list = this.filteredModels();
		if (this.podiumSlots().length || this.showcase().length) return list.slice(3);
		return list;
	});

	/** Rank of the first card in the grid (after the podium). */
	rankOffset = computed(() => this.podiumSlots().length ? 4 : 1);

	visibleRest = computed(() => this.restModels().slice(0, this.visibleCount()));
	hasMore = computed(() => this.restModels().length > this.visibleCount());

	// ── Newest: real time groups from createdAt ──
	newGroups = computed<NewGroup[]>(() => {
		if (this.mode() !== 'newest') return [];
		const now = Date.now();
		const buckets: Record<NewGroupKey, MarketplaceModel[]> = { live: [], today: [], yesterday: [], week: [], older: [] };
		for (const m of this.filteredModels()) {
			const t = createdTime(m);
			const age = t ? now - t : Infinity;
			if (age < 6 * HOUR) buckets.live.push(m);
			else if (age < 24 * HOUR) buckets.today.push(m);
			else if (age < 48 * HOUR) buckets.yesterday.push(m);
			else if (age < 7 * 24 * HOUR) buckets.week.push(m);
			else buckets.older.push(m);
		}
		const groups: NewGroup[] = [
			{ key: 'live', title: 'منذ ساعات', sub: `${buckets.live.length} خدمة جديدة`, dot: 'live', badge: { cls: 'live', label: 'مباشر الآن' }, recent: true, items: buckets.live },
			{ key: 'today', title: 'اليوم', sub: `${buckets.today.length} خدمة`, dot: 'today', badge: { cls: 'today', label: 'اليوم' }, recent: true, items: buckets.today },
			{ key: 'yesterday', title: 'أمس', sub: `${buckets.yesterday.length} خدمة`, dot: 'old', recent: true, items: buckets.yesterday },
			{ key: 'week', title: 'هذا الأسبوع', sub: `${buckets.week.length} خدمة`, dot: 'old', recent: false, items: buckets.week },
			{ key: 'older', title: 'أقدم', sub: `${buckets.older.length} خدمة`, dot: 'old', recent: false, items: buckets.older }
		];
		return groups.filter(g => g.items.length);
	});

	private hasRecentGroups = computed(() => this.newGroups().some(g => g.recent));

	visibleNewGroups = computed(() => {
		const groups = this.newGroups();
		// Nothing added in the last 48h → show the older groups straight away instead of an empty page.
		if (this.showOlder() || !this.hasRecentGroups()) return groups;
		return groups.filter(g => g.recent);
	});

	hasOlderGroups = computed(() => !this.showOlder() && this.hasRecentGroups() && this.newGroups().some(g => !g.recent));

	olderButtonLabel = computed(() =>
		this.newGroups().some(g => g.key === 'week') ? 'عرض خدمات هذا الأسبوع' : 'عرض الخدمات الأقدم');

	// ── Exclusive: soonest real offer end for the page-level countdown ──
	soonestOfferEnd = computed(() => {
		const now = this.now();
		let best = 0;
		for (const m of this.models()) {
			const t = m.offerEndsAt ? new Date(m.offerEndsAt).getTime() : NaN;
			if (Number.isFinite(t) && t > now && (!best || t < best)) best = t;
		}
		return best;
	});

	globalCountdown = computed(() => {
		const end = this.soonestOfferEnd();
		if (!end) return null;
		const secs = Math.max(0, Math.floor((end - this.now()) / 1000));
		const pad = (v: number) => String(v).padStart(2, '0');
		return { h: pad(Math.floor(secs / 3600)), m: pad(Math.floor((secs % 3600) / 60)), s: pad(secs % 60) };
	});

	constructor() {
		// Favorites are private. Public marketplace pages must not call this endpoint
		// for guests, otherwise the expected 401 would trigger a login redirect.
		if (this.authStore.isAuthenticated()) {
			this.marketplaceService.getFavorites().subscribe({
				next: response => this.favoriteModels.set(new Set(response?.data || response || [])),
				error: () => undefined
			});
		}
		this.destroyRef.onDestroy(() => this.stopTicker());
	}

	ngOnInit(): void {
		this.route.data.subscribe(data => {
			const mode = (data['mode'] as CuratedMode) || 'top-rated';
			this.mode.set(mode);
			this.categoryFilter.set('all');
			this.viewMode.set('grid');
			this.visibleCount.set(PAGE_SIZE);
			this.showOlder.set(false);
			this.loadModels();
			if (mode === 'exclusive') this.startTicker(); else this.stopTicker();
		});
	}

	private loadModels() {
		this.loading.set(true);
		// Backend caps `limit` at 50; let it pre-filter / pre-sort where it can.
		const params: Record<string, string | number | boolean> = { limit: 50 };
		if (this.mode() === 'featured') params['featuredOnly'] = true;
		if (this.mode() === 'top-rated') params['sort'] = 'rating';
		this.marketplaceService.getPublishedModels(params).subscribe({
			next: res => {
				const list: MarketplaceModel[] = res?.data?.models || res?.models || [];
				const cfg = MODE_CONFIG[this.mode()];
				const filtered = cfg.filter ? list.filter(cfg.filter) : list;
				this.models.set([...filtered].sort(cfg.sort));
				this.loading.set(false);
			},
			error: () => {
				this.models.set([]);
				this.loading.set(false);
			}
		});
	}

	private startTicker() {
		if (!isPlatformBrowser(this.platformId) || this.tickHandle) return;
		this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
	}

	private stopTicker() {
		if (this.tickHandle) {
			clearInterval(this.tickHandle);
			this.tickHandle = null;
		}
	}

	setCategoryFilter(cat: CategoryFilter) {
		this.categoryFilter.set(cat);
		this.visibleCount.set(PAGE_SIZE);
	}

	setView(v: 'grid' | 'list') {
		this.viewMode.set(v);
	}

	loadMore() {
		this.visibleCount.update(n => n + PAGE_SIZE);
	}

	// ── Favorites (same real endpoint as the shared service card) ──
	isFav(id: string): boolean {
		return this.favoriteModels().has(id);
	}

	toggleFavorite(id: string, event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		const current = new Set(this.favoriteModels());
		if (current.has(id)) current.delete(id); else current.add(id);
		this.favoriteModels.set(current);
		this.marketplaceService.setFavorite(id, current.has(id)).subscribe({
			error: () => {
				const reverted = new Set(this.favoriteModels());
				if (current.has(id)) reverted.delete(id); else reverted.add(id);
				this.favoriteModels.set(reverted);
			}
		});
	}

	// ── Template helpers ──
	/** Five stars; `false` entries render dimmed (opacity .4) as in the design. */
	stars(rating: number | undefined): boolean[] {
		const r = Math.round(rating || 0);
		return [1, 2, 3, 4, 5].map(i => i <= r);
	}

	starText(rating: number | undefined): string {
		const r = Math.max(0, Math.min(5, Math.round(rating || 0)));
		return '★'.repeat(r) + '☆'.repeat(5 - r);
	}

	daysLabel(days: number | undefined): string {
		const d = days || 0;
		return `${d} ${d >= 3 && d <= 10 ? 'أيام' : 'يوم'}`;
	}

	priceBefore(m: MarketplaceModel): number {
		const d = m.discountPercentage || 0;
		return d > 0 && d < 100 ? Math.round(m.totalAmount / (1 - d / 100)) : m.totalAmount;
	}

	saving(m: MarketplaceModel): number {
		return Math.max(0, this.priceBefore(m) - (m.totalAmount || 0));
	}

	/** HH:MM:SS until the offer ends, or '' when the model has no (future) end date. */
	offerCountdown(m: MarketplaceModel): string {
		if (!m.offerEndsAt) return '';
		const end = new Date(m.offerEndsAt).getTime();
		if (!Number.isFinite(end)) return '';
		const secs = Math.floor((end - this.now()) / 1000);
		if (secs <= 0) return '';
		const pad = (v: number) => String(v).padStart(2, '0');
		return [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60].map(pad).join(':');
	}

	timeAgo(m: MarketplaceModel): string {
		const t = createdTime(m);
		if (!t) return '';
		const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
		if (mins < 60) return 'منذ دقائق';
		const hours = Math.floor(mins / 60);
		if (hours === 1) return 'منذ ساعة';
		if (hours === 2) return 'منذ ساعتين';
		if (hours < 24) return `منذ ${hours} ${hours <= 10 ? 'ساعات' : 'ساعة'}`;
		const days = Math.floor(hours / 24);
		if (days === 1) return 'أمس';
		if (days === 2) return 'منذ يومين';
		return `منذ ${days} ${days <= 10 ? 'أيام' : 'يوماً'}`;
	}

	// ── Drag-to-scroll for the filter rail and the newest rows (design behaviour) ──
	private drag: { el: HTMLElement; startX: number; scrollLeft: number } | null = null;

	dragStart(e: MouseEvent, el: HTMLElement) {
		this.drag = { el, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
		el.classList.add('dragging');
	}

	dragMove(e: MouseEvent) {
		if (!this.drag) return;
		e.preventDefault();
		const { el, startX, scrollLeft } = this.drag;
		const factor = this.mode() === 'newest' ? 1.5 : 1;
		el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * factor;
	}

	dragEnd() {
		if (!this.drag) return;
		this.drag.el.classList.remove('dragging');
		this.drag = null;
	}

	// Batch 4 — same eligibility contract/behavior as the shared <app-card>
	// component (src/app/sheards/card/card.ts): model.eligibility is only
	// ever populated server-side for an authenticated Client, via the exact
	// same findActiveServicePurchases() helper the checkout write-path guard
	// uses. Kept here too since this page renders its own card markup rather
	// than reusing <app-card> (out of scope to unify in this batch).
	hasActivePurchase(m: MarketplaceModel): boolean {
		return Boolean(m.eligibility?.hasActivePurchase);
	}

	cardLink(m: MarketplaceModel): (string | null)[] {
		if (m.eligibility?.hasActivePurchase && m.eligibility.activeProjectId) {
			return ['/client-overview/projects', m.eligibility.activeProjectId];
		}
		return ['/marketplace/offer', m.id];
	}
}
