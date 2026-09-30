import { Component, AfterViewInit, OnDestroy, OnInit, PLATFORM_ID, Inject, ViewEncapsulation, signal, computed } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { Subscription } from 'rxjs';

@Component({
	selector: 'app-slug',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './slug.html',
	styleUrl: './slug.css',
	encapsulation: ViewEncapsulation.None
})
export class Slug implements OnInit, AfterViewInit, OnDestroy {
	private isBrowser: boolean;
	private subscriptions = new Subscription();

	// State
	slug = signal<string>('');
	categories = signal<any[]>([]);
	models = signal<MarketplaceModel[]>([]);
	isLoading = signal<boolean>(true);
	selectedSub = signal<string>('');
	selectedLevels = signal<string[]>([]);
	selectedRating = signal<number>(0);
	selectedMaxDays = signal<number>(0);
	selectedMaxPrice = signal<number | null>(null);
	priceLimit = signal<number>(10000);
	sortBy = signal<string>('relevance');
	currentPage = signal<number>(1);
	totalPages = signal<number>(1);
	totalResults = signal<number>(0);
	pages = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

	categoryData = computed(() => {
		return this.categories().find(c => c.slug === this.slug() || c.id === this.slug());
	});

	/** The selected sub-specialty (?sub=...) — switches the page to the P-MK-004 variant. */
	selectedSubData = computed(() => {
		const sub = this.selectedSub();
		if (!sub) return null;
		return this.categoryData()?.subSpecialties?.find((s: any) => s.slug === sub) || null;
	});

	/** Name shown in the hero / results bar: the sub-specialty when one is selected, else the category. */
	heroName = computed(() => this.selectedSubData()?.name || this.categoryData()?.name || this.slug());

	/** Design title pattern: first word plain, the rest in the gradient <span> ("برمجة <span>وتقنية</span>"). */
	heroTitleHead = computed(() => {
		const words = String(this.heroName() || '').trim().split(/\s+/);
		return words.length > 1 ? words[0] : '';
	});
	heroTitleTail = computed(() => {
		const words = String(this.heroName() || '').trim().split(/\s+/);
		return words.length > 1 ? words.slice(1).join(' ') : words[0];
	});

	/** Published-services count for the hero stat: the selected sub's count, else the category's. */
	heroCount = computed(() => {
		const sub = this.selectedSubData();
		return sub ? (Number(sub.count) || 0) : (Number(this.categoryData()?.count) || 0);
	});

	/** Other sub-specialties of the same category (design P-MK-004 "تخصصات مشابهة"). */
	relatedSubs = computed(() => {
		const sub = this.selectedSub();
		if (!sub) return [];
		return (this.categoryData()?.subSpecialties || []).filter((s: any) => s.slug !== sub);
	});

	/** Pagination items with the design's "…" gap (1 2 3 … 28). */
	pageItems = computed<(number | null)[]>(() => {
		const total = this.totalPages();
		const cur = this.currentPage();
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const set = new Set<number>([1, total, cur - 1, cur, cur + 1]);
		if (cur <= 3) { set.add(2); set.add(3); }
		if (cur >= total - 2) { set.add(total - 1); set.add(total - 2); }
		const nums = Array.from(set).filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
		const out: (number | null)[] = [];
		nums.forEach((n, i) => {
			if (i > 0 && n - nums[i - 1] > 1) out.push(null);
			out.push(n);
		});
		return out;
	});

	// Favourites / compare — same behaviour the shared app-card provided before the
	// design's own card markup was inlined here.
	favoriteModels = signal<Set<string>>(new Set());
	comparedModels = signal<Set<string>>(new Set());

	// Card presentation cycles, taken verbatim from the design cards (P-MK-003).
	private readonly thumbGradients = [
		'linear-gradient(135deg,#061422,#0A1E38)',
		'linear-gradient(135deg,#071520,#0A2030)',
		'linear-gradient(135deg,#0A1020,#0E1828)',
		'linear-gradient(135deg,#060E20,#0B1832)',
		'linear-gradient(135deg,#07101E,#0B1A30)',
		'linear-gradient(135deg,#080E1C,#0C1828)'
	];
	private readonly avatarStyles = [
		{ background: 'var(--grad)', border: 'none', color: '#070D24' },
		{ background: 'rgba(43,127,255,.2)', border: '1px solid rgba(43,127,255,.3)', color: 'var(--blue-txt)' },
		{ background: 'rgba(15,169,154,.2)', border: '1px solid rgba(15,169,154,.3)', color: 'var(--green)' },
		{ background: 'rgba(43,212,199,.15)', border: '1px solid rgba(43,212,199,.25)', color: 'var(--teal)' },
		{ background: 'rgba(217,138,11,.15)', border: '1px solid rgba(217,138,11,.25)', color: 'var(--kahr)' },
		{ background: 'rgba(255,140,105,.15)', border: '1px solid rgba(255,140,105,.25)', color: 'var(--red)' }
	];
	// Design level-badge colours; levels the design doesn't show fall back to the
	// backend-provided levelBg/levelColor (as app-card did).
	private readonly levelStyles: Record<string, { bg: string; color: string }> = {
		'خبير': { bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' },
		'محترف': { bg: 'rgba(43,127,255,.85)', color: '#C6E0FF' },
		'أخصائي': { bg: 'rgba(43,212,199,.75)', color: '#070D24' }
	};

	thumbGradient(index: number): string {
		return this.thumbGradients[index % this.thumbGradients.length];
	}

	avatarStyle(index: number) {
		return this.avatarStyles[index % this.avatarStyles.length];
	}

	levelStyle(model: MarketplaceModel): { bg: string; color: string } {
		const known = model.level ? this.levelStyles[model.level] : undefined;
		return known || { bg: model.levelBg || 'rgba(43,212,199,.6)', color: model.levelColor || '#2BD4C7' };
	}

	// Symbols this component ships in its own local sprite (see slug.html).
	// Any category icon href that isn't in this set falls back to the generic ws-tag glyph.
	private readonly knownIconIds = new Set([
		'ws-cat-design', 'ws-cat-code', 'ws-cat-writing', 'ws-cat-marketing', 'ws-cat-video',
		'ws-cat-translate', 'ws-cat-consult', 'ws-cat-data', 'ws-cat-photo', 'ws-cat-audio',
		'ws-cat-sound', 'ws-cat-legal', 'ws-cat-training', 'ws-cat-admin', 'ws-cat-business'
	]);

	// The API sends generic Lucide/Feather-style icon names (e.g. "palette", "code",
	// "trending-up") rather than our ws-cat-* symbol ids. Map the common ones we've
	// actually seen from the backend to the matching local symbol.
	private readonly iconNameMap: Record<string, string> = {
		palette: 'ws-cat-design', brush: 'ws-cat-design', 'pen-tool': 'ws-cat-design',
		code: 'ws-cat-code', 'code-2': 'ws-cat-code', terminal: 'ws-cat-code',
		feather: 'ws-cat-writing', edit: 'ws-cat-writing', 'file-text': 'ws-cat-writing', 'edit-3': 'ws-cat-writing',
		'trending-up': 'ws-cat-marketing', megaphone: 'ws-cat-marketing', target: 'ws-cat-marketing',
		video: 'ws-cat-video', film: 'ws-cat-video', clapperboard: 'ws-cat-video',
		languages: 'ws-cat-translate', globe: 'ws-cat-translate', 'book-open': 'ws-cat-translate',
		'message-circle': 'ws-cat-consult', 'message-square': 'ws-cat-consult', users: 'ws-cat-consult',
		'bar-chart': 'ws-cat-data', 'bar-chart-2': 'ws-cat-data', database: 'ws-cat-data', 'pie-chart': 'ws-cat-data',
		camera: 'ws-cat-photo', image: 'ws-cat-photo',
		music: 'ws-cat-audio', headphones: 'ws-cat-audio',
		mic: 'ws-cat-sound', radio: 'ws-cat-sound',
		scale: 'ws-cat-legal', gavel: 'ws-cat-legal', shield: 'ws-cat-legal',
		'graduation-cap': 'ws-cat-training', book: 'ws-cat-training',
		briefcase: 'ws-cat-admin', settings: 'ws-cat-admin',
		building: 'ws-cat-business', 'building-2': 'ws-cat-business'
	};

	// Maps a category's icon href (e.g. "#ws-cat-code", "ws-cat-code", or a bare
	// Lucide-style name like "code" as the API actually sends) to one of the symbols
	// defined in this component's own sprite, falling back to the generic tag icon.
	categoryIcon(icon?: string): string {
		if (!icon) return '#ws-cat-code';
		const id = icon.startsWith('#') ? icon.slice(1) : icon;
		if (this.knownIconIds.has(id)) return `#${id}`;
		const mapped = this.iconNameMap[id];
		return mapped ? `#${mapped}` : '#ws-cat-code';
	}

	filteredModels = computed(() => {
		return this.models();
	});

	levelOptions = computed(() => {
		const levels = new Map<string, number>();
		for (const model of this.models()) {
			if (model.level) levels.set(model.level, (levels.get(model.level) || 0) + 1);
		}
		return Array.from(levels, ([value, count]) => ({ value, count }));
	});

	ratingOptions = computed(() => [
		{ value: 4.5, label: '4.5 وأعلى', count: this.models().filter(m => (m.rating || 0) >= 4.5).length },
		{ value: 4, label: '4.0 وأعلى', count: this.models().filter(m => (m.rating || 0) >= 4).length },
		{ value: 0, label: 'جميع التقييمات', count: this.models().length }
	]);

	deliveryOptions = [3, 7, 14];

	/** Highest-aiScore model on the current page (rendered as "الأعلى توافقاً مع الذكاء الاصطناعي: <strong>title</strong>"). */
	aiInsightBest = computed(() => {
		return [...this.models()].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))[0] || null;
	});

	providersCount = computed(() => {
		const unique = new Set(this.models().map(m => m.provider?.id).filter(Boolean));
		return unique.size || 0;
	});

	averageRating = computed(() => {
		const mods = this.models();
		if (!mods.length) return 0;
		const sum = mods.reduce((acc, m) => acc + (m.rating || 0), 0);
		return (sum / mods.length).toFixed(1);
	});

	totalReviews = computed(() => {
		return this.models().reduce((acc, m) => acc + (m.reviewsCount || 0), 0);
	});
	
	averageAiScore = computed(() => {
		const mods = this.models();
		if (!mods.length) return 0;
		const sum = mods.reduce((acc, m) => acc + (m.aiScore || 0), 0);
		return Math.round(sum / mods.length);
	});

	constructor(
		@Inject(PLATFORM_ID) platformId: Object,
		private route: ActivatedRoute,
		private router: Router,
		private marketplaceService: MarketplaceService,
		private authStore: AuthStore
	) {
		this.isBrowser = isPlatformBrowser(platformId);

		// Favorites are private. Public marketplace pages must not call this endpoint
		// for guests, otherwise the expected 401 would trigger a login redirect.
		if (this.authStore.isAuthenticated()) {
			this.marketplaceService.getFavorites().subscribe({
				next: response => this.favoriteModels.set(new Set(response?.data || response || [])),
				error: () => undefined
			});
		}
	}

	isFav(id: string): boolean {
		return this.favoriteModels().has(id);
	}

	isCompared(id: string): boolean {
		return this.comparedModels().has(id);
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

	toggleCompare(id: string, event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		const current = new Set(this.comparedModels());
		if (current.has(id)) current.delete(id); else current.add(id);
		this.comparedModels.set(current);
	}

	ngOnInit() {
		this.subscriptions.add(this.route.paramMap.subscribe(params => {
			const slugParam = params.get('slug');
			if (slugParam) {
				this.slug.set(slugParam);
			}
			if (slugParam) this.loadModels(slugParam);
		}));
		this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
			this.selectedSub.set(params.get('sub') || '');
			this.selectedRating.set(Number(params.get('minRating') || 0));
			this.selectedMaxDays.set(Number(params.get('maxDays') || 0));
			this.selectedMaxPrice.set(params.get('maxPrice') ? Number(params.get('maxPrice')) : null);
			this.selectedLevels.set((params.get('level') || '').split(',').filter(Boolean));
			this.sortBy.set(params.get('sort') || 'relevance');
			this.currentPage.set(Number(params.get('page') || 1));
			if (this.slug()) this.loadModels(this.slug());
		}));

		this.loadCategories();
	}

	loadCategories() {
		this.marketplaceService.getCategories().subscribe({
			next: (res) => {
				if (res?.data?.categories) {
					this.categories.set(res.data.categories);
				}
			},
			error: (err) => console.error('Failed to load categories', err)
		});
	}

	loadModels(categorySlug: string) {
		this.isLoading.set(true);
		const filters: any = {
			category: categorySlug,
			specialization: this.selectedSub() || undefined,
			minRating: this.selectedRating() || undefined,
			maxDays: this.selectedMaxDays() || undefined,
			maxPrice: this.selectedMaxPrice() || undefined,
			level: this.selectedLevels().join(',') || undefined,
			sort: this.sortBy() === 'relevance' ? undefined : this.sortBy(),
			page: this.currentPage(),
			limit: 12
		};

		this.marketplaceService.getPublishedModels(filters).subscribe({
			next: (res) => {
				const data = res?.data || res || {};
				this.models.set(data.models || []);
				this.totalResults.set(data.total || 0);
				this.totalPages.set(Math.max(1, data.totalPages || 1));
				this.priceLimit.set(Math.max(100, ...this.models().map(model => Number(model.totalAmount) || 0)));
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load models', err);
				this.isLoading.set(false);
			}
		});
	}

	selectSubCategory(subSlug: string) {
		this.selectedSub.set(subSlug);
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { sub: subSlug || null },
			queryParamsHandling: 'merge'
		});
	}

	toggleLevel(level: string) {
		const levels = new Set(this.selectedLevels());
		if (levels.has(level)) levels.delete(level); else levels.add(level);
		this.updateFilters({ level: Array.from(levels).join(',') || null, page: null });
	}

	setRating(rating: number) {
		this.updateFilters({ minRating: rating || null, page: null });
	}

	setMaxDays(days: number) {
		this.updateFilters({ maxDays: days || null, page: null });
	}

	setMaxPrice(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		this.updateFilters({ maxPrice: value < this.priceLimit() ? value : null, page: null });
	}

	setSort(event: Event) {
		this.updateFilters({ sort: (event.target as HTMLSelectElement).value || null, page: null });
	}

	applyFilters() {
		if (this.slug()) this.loadModels(this.slug());
	}

	resetFilters() {
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { sub: null, level: null, minRating: null, maxDays: null, maxPrice: null, sort: null, page: null },
			queryParamsHandling: 'merge'
		});
	}

	goToPage(page: number) {
		if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
		this.updateFilters({ page });
	}

	private updateFilters(queryParams: Record<string, string | number | null>) {
		this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
	}

	getSubCount(subSlug: string): number {
		return this.categoryData()?.subSpecialties?.find((sub: any) => sub.slug === subSlug)?.count || 0;
	}

	ngAfterViewInit() {
		if (!this.isBrowser) return;

		// Particles / bg-grid are owned by the shared website layout.
		this.initDragScroll();
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	private initDragScroll() {
		const el = document.querySelector("app-slug .subcats-inner") as HTMLElement;
		if (!el) return;

		let isDown = false;
		let startX: number;
		let scrollLeft: number;

		el.addEventListener('mousedown', (e) => {
			isDown = true;
			el.classList.add('dragging');
			startX = e.pageX - el.offsetLeft;
			scrollLeft = el.scrollLeft;
		});

		el.addEventListener('mouseleave', () => {
			isDown = false;
			el.classList.remove('dragging');
		});

		el.addEventListener('mouseup', () => {
			isDown = false;
			el.classList.remove('dragging');
		});

		el.addEventListener('mousemove', (e) => {
			if (!isDown) return;
			e.preventDefault();
			const x = e.pageX - el.offsetLeft;
			el.scrollLeft = scrollLeft - (x - startX) * 1.5;
		});
	}

	// Batch 4 — model.eligibility is populated server-side (see
	// marketplace-service.service.ts getMarketplaceModels) ONLY for an
	// authenticated Client, via the same findActiveServicePurchases() helper
	// the checkout write-path guard uses. undefined for guests/other roles.
	hasActivePurchase(model: MarketplaceModel): boolean {
		return Boolean(model.eligibility?.hasActivePurchase);
	}

	/** Navigates straight to the existing running project instead of the
	 *  normal offer/buy page when the Client already has an active purchase
	 *  for this exact service — never a fabricated id. */
	cardLink(model: MarketplaceModel): (string | null)[] {
		if (model.eligibility?.hasActivePurchase && model.eligibility.activeProjectId) {
			return ['/client-overview/projects', model.eligibility.activeProjectId];
		}
		return ['/marketplace/offer', model.id];
	}

}
