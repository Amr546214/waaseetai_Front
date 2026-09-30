import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../core/services/marketplace.service';
import { AuthStore } from '../../../core/store/auth.store';
import { combineLatest, Subscription } from 'rxjs';

interface CategoryPalette {
	bg: string;
	border: string;
	color: string;
}

/**
 * /marketplace — two states, each ported from its approved design:
 *  - landing (no query params)                       → P-MK-001
 *  - search / filtered results (q, cat, sub, sort …) → P-MK-005
 */
@Component({
	selector: 'app-marketplace',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './marketplace.html',
	styleUrl: './marketplace.css',
	encapsulation: ViewEncapsulation.None
})
export class Marketplace implements OnInit, OnDestroy {
	private marketplaceService = inject(MarketplaceService);
	private authStore = inject(AuthStore);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private platformId = inject(PLATFORM_ID);

	currentSlide = 0;
	totalSlides = 3;
	sliderTimer: any;
	private clockTimer: any;
	private subscriptions = new Subscription();
	private modelsRequest?: Subscription;
	private aiRequest?: Subscription;

	// Symbols this component ships in its own local sprite (see marketplace.html).
	private readonly knownIconIds = new Set([
		'ws-cat-design', 'ws-cat-code', 'ws-cat-writing', 'ws-cat-marketing', 'ws-cat-video',
		'ws-cat-translate', 'ws-cat-consult', 'ws-cat-data', 'ws-cat-photo', 'ws-cat-audio',
		'ws-cat-sound', 'ws-cat-legal', 'ws-cat-training', 'ws-cat-admin', 'ws-cat-business'
	]);

	// The API sends generic Lucide/Feather-style icon names; map them to local symbols.
	private readonly iconNameMap: Record<string, string> = {
		palette: 'ws-cat-design', brush: 'ws-cat-design', 'pen-tool': 'ws-cat-writing',
		code: 'ws-cat-code', 'code-2': 'ws-cat-code', terminal: 'ws-cat-code',
		feather: 'ws-cat-writing', edit: 'ws-cat-writing', 'file-text': 'ws-cat-writing', 'edit-3': 'ws-cat-writing',
		'trending-up': 'ws-cat-marketing', megaphone: 'ws-cat-marketing', target: 'ws-cat-marketing',
		video: 'ws-cat-video', film: 'ws-cat-video', clapperboard: 'ws-cat-video',
		languages: 'ws-cat-translate', globe: 'ws-cat-translate', 'book-open': 'ws-cat-training',
		'message-circle': 'ws-cat-consult', 'message-square': 'ws-cat-consult', users: 'ws-cat-consult',
		'bar-chart': 'ws-cat-data', 'bar-chart-2': 'ws-cat-data', database: 'ws-cat-data', 'pie-chart': 'ws-cat-data',
		camera: 'ws-cat-photo', image: 'ws-cat-photo',
		music: 'ws-cat-audio', headphones: 'ws-cat-audio',
		mic: 'ws-cat-sound', radio: 'ws-cat-sound',
		scale: 'ws-cat-legal', gavel: 'ws-cat-legal', shield: 'ws-cat-legal',
		'graduation-cap': 'ws-cat-training', book: 'ws-cat-training',
		briefcase: 'ws-cat-admin', settings: 'ws-cat-admin',
		building: 'ws-cat-business', 'building-2': 'ws-cat-business',
		brain: 'ws-cat-data', 'dollar-sign': 'ws-cat-data', compass: 'ws-cat-business', clipboard: 'ws-cat-admin',
		zap: 'ws-cat-code', cloud: 'ws-cat-code', gamepad: 'ws-cat-video'
	};

	// Quick-category tile colours, verbatim from P-MK-001 in order. The design's 8th
	// tile used the AI purple; the owner removed AI purple from cycling category
	// palettes (commit 1bdd278), so that slot uses the same chart-6 replacement.
	private readonly palette: CategoryPalette[] = [
		{ bg: 'rgba(43,127,255,.12)', border: 'rgba(43,127,255,.2)', color: '#5DA0FF' },
		{ bg: 'rgba(43,212,199,.12)', border: 'rgba(43,212,199,.2)', color: 'var(--teal)' },
		{ bg: 'rgba(15,169,154,.12)', border: 'rgba(15,169,154,.2)', color: 'var(--green)' },
		{ bg: 'rgba(217,138,11,.12)', border: 'rgba(217,138,11,.2)', color: 'var(--kahr)' },
		{ bg: 'rgba(255,140,105,.12)', border: 'rgba(255,140,105,.2)', color: 'var(--red)' },
		{ bg: 'rgba(43,212,199,.08)', border: 'rgba(43,212,199,.15)', color: 'var(--teal)' },
		{ bg: 'rgba(43,127,255,.08)', border: 'rgba(43,127,255,.15)', color: 'var(--blue-txt)' },
		{ bg: 'rgba(89,193,245,.10)', border: 'rgba(89,193,245,.20)', color: '#59C1F5' }
	];

	// Category-block item icon colours (P-MK-001 blocks; purple slots → chart-6, see above).
	private readonly blockPalette: CategoryPalette[] = [
		{ bg: 'rgba(43,127,255,.1)', border: 'rgba(43,127,255,.2)', color: '#5DA0FF' },
		{ bg: 'rgba(89,193,245,.1)', border: 'rgba(89,193,245,.2)', color: '#59C1F5' },
		{ bg: 'rgba(43,212,199,.1)', border: 'rgba(43,212,199,.2)', color: 'var(--teal)' },
		{ bg: 'rgba(217,138,11,.1)', border: 'rgba(217,138,11,.2)', color: 'var(--kahr)' },
		{ bg: 'rgba(43,212,199,.1)', border: 'rgba(43,212,199,.2)', color: 'var(--teal)' },
		{ bg: 'rgba(43,127,255,.1)', border: 'rgba(43,127,255,.2)', color: 'var(--blue-txt)' },
		{ bg: 'rgba(15,169,154,.1)', border: 'rgba(15,169,154,.2)', color: 'var(--green)' },
		{ bg: 'rgba(89,193,245,.1)', border: 'rgba(89,193,245,.2)', color: '#59C1F5' }
	];

	// Card thumb backgrounds + provider avatar gradients, verbatim from the P-MK-001 cards
	// (purple avatar gradients skipped — AI purple is reserved, see above).
	private readonly thumbGradients = [
		'linear-gradient(135deg,#0A1628,#0D1E38)',
		'linear-gradient(135deg,#071822,#0A2030)',
		'linear-gradient(135deg,#0A1622,#0E1F30)',
		'linear-gradient(135deg,#161209,#1E1800)',
		'linear-gradient(135deg,#0C1A12,#0E2018)',
		'linear-gradient(135deg,#1A0E09,#261508)',
		'linear-gradient(135deg,#091818,#0C2222)',
		'linear-gradient(135deg,#0A1B2E,#0D2040)'
	];
	private readonly avatarGradients = [
		'var(--grad)',
		'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
		'linear-gradient(135deg,#0FA99A,#2BD4C7)',
		'linear-gradient(135deg,#D98A0B,#FFB400)',
		'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
		'linear-gradient(135deg,#FF8C69,#FF6B4A)'
	];
	// P-MK-001 level badges (svc-lvl).
	private readonly homeLevelStyles: Record<string, { color: string; border: string; bg: string }> = {
		'خبير': { color: '#C084FC', border: 'rgba(123,47,190,.4)', bg: 'rgba(123,47,190,.7)' },
		'أخصائي': { color: '#2BD4C7', border: 'rgba(43,212,199,.4)', bg: 'rgba(43,212,199,.6)' },
		'متقن': { color: '#FFB4A2', border: 'rgba(255,140,105,.4)', bg: 'rgba(255,140,105,.6)' }
	};
	// P-MK-005 level badges (svc-level).
	private readonly resultLevelStyles: Record<string, { bg: string; color: string }> = {
		'خبير': { bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' },
		'محترف': { bg: 'rgba(43,127,255,.85)', color: '#C6E0FF' },
		'أخصائي': { bg: 'rgba(43,212,199,.75)', color: '#070D24' }
	};

	categoryIcon(icon?: string): string {
		if (!icon) return '#ws-tag';
		const id = icon.startsWith('#') ? icon.slice(1) : icon;
		if (this.knownIconIds.has(id)) return `#${id}`;
		const mapped = this.iconNameMap[id];
		return mapped ? `#${mapped}` : '#ws-tag';
	}

	categoryPalette(index: number): CategoryPalette {
		return this.palette[index % this.palette.length];
	}

	blockItemPalette(blockIndex: number, itemIndex: number): CategoryPalette {
		return this.blockPalette[(blockIndex * 4 + itemIndex) % this.blockPalette.length];
	}

	thumbGradient(index: number): string {
		return this.thumbGradients[index % this.thumbGradients.length];
	}

	avatarGradient(index: number): string {
		return this.avatarGradients[index % this.avatarGradients.length];
	}

	homeLevelStyle(model: MarketplaceModel) {
		const known = model.level ? this.homeLevelStyles[model.level] : undefined;
		return known || { color: model.levelColor || '#2BD4C7', border: 'rgba(43,212,199,.4)', bg: model.levelBg || 'rgba(43,212,199,.6)' };
	}

	resultLevelStyle(model: MarketplaceModel) {
		const known = model.level ? this.resultLevelStyles[model.level] : undefined;
		return known || { bg: model.levelBg || 'rgba(43,212,199,.6)', color: model.levelColor || '#2BD4C7' };
	}

	/** Original price before the discount (design: struck-through number next to the price). */
	originalPrice(model: MarketplaceModel): number {
		const d = Number(model.discountPercentage || 0);
		return d > 0 && d < 100 ? Math.round(model.totalAmount / (1 - d / 100)) : model.totalAmount;
	}

	// ── State ──
	isLoading = signal<boolean>(true);
	searchQuery = signal<string>('');
	selectedCategory = signal<string>('all');
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
	/** true → P-MK-005 results layout; false → P-MK-001 landing. */
	resultsMode = signal<boolean>(false);

	allModels = signal<MarketplaceModel[]>([]);
	aiRecommendedModels = signal<MarketplaceModel[]>([]);
	aiBannerInsight = signal<string>('جاري تحليل النماذج المنشورة لعرض أفضل التوصيات لك...');
	// Reflects the backend's honest generationSource — never assume GEMINI before a response confirms it.
	aiGenerationSource = signal<'GEMINI' | 'DETERMINISTIC' | null>(null);
	totalModelsCount = signal<number>(0);
	categories = signal<any[]>([]);

	favoriteModels = signal<Set<string>>(new Set());
	comparedModels = signal<Set<string>>(new Set());
	private now = signal<number>(Date.now());

	/** Flash deals (عروض لفترة محدودة): published models that carry a real discount. */
	flashModels = computed(() => this.allModels().filter(m => Number(m.discountPercentage || 0) > 0).slice(0, 4));

	/** Countdown to the earliest offer end among the flash deals (HH:MM:SS). */
	flashCountdown = computed(() => {
		const ends = this.flashModels()
			.map(m => (m.offerEndsAt ? new Date(m.offerEndsAt).getTime() : NaN))
			.filter(t => !isNaN(t) && t > this.now());
		if (!ends.length) return null;
		const secs = Math.max(0, Math.floor((Math.min(...ends) - this.now()) / 1000));
		const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
		return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
	});

	topRatedModels = computed(() => [...this.allModels()].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4));

	/** "كل الفئات +N": number of published sub-specialties (falls back to the category count). */
	allCatsCount = computed(() => {
		const subs = this.categories().reduce((acc, c) => acc + (c.subSpecialties?.length || 0), 0);
		return subs || this.categories().length;
	});

	/** Category behind a hero slide (design: تصميم / برمجة), matched by slug keyword. */
	slideCategory(kind: 'design' | 'code'): any | null {
		const keys = kind === 'design' ? ['design'] : ['programming', 'code', 'development'];
		return this.categories().find(c => keys.some(k => String(c.slug || '').toLowerCase().includes(k))) || null;
	}

	slideLink(kind: 'design' | 'code'): any[] {
		const cat = this.slideCategory(kind);
		return cat ? ['/marketplace', cat.slug] : ['/marketplace/categories'];
	}

	slideCount(kind: 'design' | 'code'): number {
		return Number(this.slideCategory(kind)?.count || 0);
	}

	selectedCategoryData = computed(() => {
		const cat = this.selectedCategory();
		if (!cat || cat === 'all') return null;
		return this.categories().find(c => c.slug === cat || c.id === cat) || null;
	});

	selectedSubData = computed(() => {
		const sub = this.selectedSub();
		if (!sub) return null;
		return (this.selectedCategoryData()?.subSpecialties || []).find((s: any) => (s.slug || s.name || s.id) === sub) || null;
	});

	/** Refinement strip: the selected category's sub-specialties, otherwise the categories. */
	refinements = computed(() => {
		const cat = this.selectedCategoryData();
		if (cat) {
			return (cat.subSpecialties || []).map((s: any) => ({ key: s.slug || s.name || s.id, name: s.name, count: Number(s.count || 0), icon: cat.icon, isSub: true }));
		}
		return this.categories().map(c => ({ key: c.slug, name: c.name, count: Number(c.count || 0), icon: c.icon, isSub: false }));
	});

	refinementAllCount = computed(() => {
		const cat = this.selectedCategoryData();
		return cat ? Number(cat.count || 0) : (this.totalModelsCount() || this.totalResults());
	});

	levelOptions = computed(() => {
		const levels = new Map<string, number>();
		for (const model of this.allModels()) {
			if (model.level) levels.set(model.level, (levels.get(model.level) || 0) + 1);
		}
		for (const l of this.selectedLevels()) if (!levels.has(l)) levels.set(l, 0);
		return Array.from(levels, ([value, count]) => ({ value, count }));
	});

	ratingOptions = computed(() => [
		{ value: 4.5, label: '4.5 وأعلى', count: this.allModels().filter(m => (m.rating || 0) >= 4.5).length },
		{ value: 4, label: '4.0 وأعلى', count: this.allModels().filter(m => (m.rating || 0) >= 4).length },
		{ value: 0, label: 'جميع التقييمات', count: this.allModels().length }
	]);

	deliveryOptions = [3, 7, 14];

	deliveryLabel(days: number): string {
		if (days === 3) return 'أقل من 3 أيام';
		if (days === 14) return 'حتى 14 يوماً';
		return 'حتى ' + days + ' أيام';
	}

	aiInsightBest = computed(() => [...this.allModels()].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))[0] || null);

	providersCount = computed(() => new Set(this.allModels().map(m => m.provider?.id).filter(Boolean)).size);

	averageRating = computed(() => {
		const rated = this.allModels().filter(m => (m.rating || 0) > 0);
		if (!rated.length) return '0';
		return (rated.reduce((acc, m) => acc + (m.rating || 0), 0) / rated.length).toFixed(1);
	});

	completedOrders = computed(() => this.allModels().reduce((acc, m) => acc + (m.salesCount || 0), 0));
	totalReviews = computed(() => this.allModels().reduce((acc, m) => acc + (m.reviewsCount || 0), 0));

	/** Active-filter chips (P-MK-005 "فلاتر نشطة"). */
	activeFilters = computed(() => {
		const chips: { key: string; label: string }[] = [];
		const cat = this.selectedCategoryData();
		if (cat) chips.push({ key: 'cat', label: cat.name });
		else if (this.selectedCategory() !== 'all') chips.push({ key: 'cat', label: this.selectedCategory() });
		const sub = this.selectedSubData();
		if (this.selectedSub()) chips.push({ key: 'sub', label: sub?.name || this.selectedSub() });
		if (this.selectedRating()) chips.push({ key: 'minRating', label: this.selectedRating() + ' وأعلى' });
		if (this.selectedMaxDays()) chips.push({ key: 'maxDays', label: this.deliveryLabel(this.selectedMaxDays()) });
		if (this.selectedMaxPrice()) chips.push({ key: 'maxPrice', label: 'حتى ' + this.selectedMaxPrice() + ' $' });
		if (this.selectedLevels().length) chips.push({ key: 'level', label: this.selectedLevels().join(' + ') });
		return chips;
	});

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

	ngOnInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.startAuto();
			this.clockTimer = setInterval(() => this.now.set(Date.now()), 1000);
		}

		// Favorites are private — only fetch for signed-in users (a guest 401 would redirect to login).
		if (this.authStore.isAuthenticated()) {
			this.marketplaceService.getFavorites().subscribe({
				next: response => this.favoriteModels.set(new Set(response?.data || response || [])),
				error: () => undefined
			});
		}

		this.subscriptions.add(combineLatest([this.route.paramMap, this.route.queryParams]).subscribe(([pathParams, params]) => {
			if (params['cat']) {
				this.selectedCategory.set(params['cat']);
			} else if (pathParams.get('slug')) {
				// Keep legacy /marketplace/:slug links compatible with the query-filtered page.
				this.selectedCategory.set(pathParams.get('slug')!);
			} else {
				this.selectedCategory.set('all');
			}
			this.selectedSub.set(params['sub'] || '');
			this.searchQuery.set(params['q'] || params['search'] || '');
			this.selectedRating.set(Number(params['minRating'] || 0));
			this.selectedMaxDays.set(Number(params['maxDays'] || 0));
			this.selectedMaxPrice.set(params['maxPrice'] ? Number(params['maxPrice']) : null);
			this.selectedLevels.set(String(params['level'] || '').split(',').filter(Boolean));
			this.sortBy.set(params['sort'] || 'relevance');
			this.currentPage.set(Number(params['page'] || 1));
			const keys = ['q', 'search', 'cat', 'sub', 'sort', 'level', 'minRating', 'maxDays', 'maxPrice', 'page'];
			this.resultsMode.set(!!pathParams.get('slug') || keys.some(k => params[k] !== undefined && params[k] !== ''));
			this.loadModels();
			this.loadAiRecommendations();
		}));

		this.loadCategories();
	}

	ngOnDestroy() {
		this.stopAuto();
		if (this.clockTimer) clearInterval(this.clockTimer);
		this.subscriptions.unsubscribe();
		this.modelsRequest?.unsubscribe();
		this.aiRequest?.unsubscribe();
	}

	loadCategories() {
		this.marketplaceService.getCategories().subscribe({
			next: (res) => {
				if (res?.data?.categories && res.data.categories.length > 0) {
					this.categories.set(res.data.categories);
				}
				if (res?.data?.totalModelsCount) {
					this.totalModelsCount.set(res.data.totalModelsCount);
				}
			},
			error: (err) => console.error('Failed to load dynamic categories:', err)
		});
	}

	loadModels() {
		this.isLoading.set(true);
		const results = this.resultsMode();
		const filters: any = {
			category: this.selectedCategory() !== 'all' ? this.selectedCategory() : undefined,
			specialization: this.selectedSub() || undefined,
			search: this.searchQuery() || undefined,
			minRating: this.selectedRating() || undefined,
			maxDays: this.selectedMaxDays() || undefined,
			maxPrice: this.selectedMaxPrice() || undefined,
			level: this.selectedLevels().join(',') || undefined,
			sort: this.sortBy() === 'relevance' ? undefined : this.sortBy(),
			page: results ? this.currentPage() : undefined,
			limit: results ? 12 : 50
		};

		this.modelsRequest?.unsubscribe();
		this.modelsRequest = this.marketplaceService.getPublishedModels(filters).subscribe({
			next: (res) => {
				const data = res?.data || res || {};
				const models: MarketplaceModel[] = data.models || res?.models || [];
				this.allModels.set(models);
				this.totalResults.set(data.total || models.length);
				this.totalPages.set(Math.max(1, data.totalPages || 1));
				this.priceLimit.set(Math.max(100, this.selectedMaxPrice() || 0, ...models.map(m => Number(m.totalAmount) || 0)));
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load marketplace models:', err);
				this.isLoading.set(false);
			}
		});
	}

	loadAiRecommendations() {
		const payload = {
			query: this.searchQuery() || undefined,
			category: this.selectedCategory() !== 'all' ? this.selectedCategory() : undefined,
			subSpecialty: this.selectedSub() || undefined,
			limit: 5
		};

		this.aiRequest?.unsubscribe();
		this.aiRequest = this.marketplaceService.getAiRecommendations(payload).subscribe({
			next: (res) => {
				const recs = res?.data?.recommendations || res?.recommendations || [];
				this.aiRecommendedModels.set(recs);
				this.aiGenerationSource.set(res?.data?.generationSource === 'GEMINI' ? 'GEMINI' : 'DETERMINISTIC');
				if (res?.data?.matchSummary) {
					this.aiBannerInsight.set(res.data.matchSummary);
				}
			},
			error: (err) => {
				console.error('Failed to load AI recommendations:', err);
				this.aiGenerationSource.set(null);
				this.aiBannerInsight.set('تعذر تحميل التوصيات الذكية حالياً.');
			}
		});
	}

	// ── Search / filters (all state lives in the URL query params) ──
	onSearchInput(event: Event) {
		this.searchQuery.set((event.target as HTMLInputElement).value);
	}

	triggerSearch() {
		const q = this.searchQuery().trim();
		this.router.navigate(['/marketplace'], {
			queryParams: { q: q || null, page: null },
			queryParamsHandling: 'merge'
		});
	}

	selectRefinement(key: string, isSub: boolean) {
		if (isSub) this.updateFilters({ sub: key || null, page: null });
		else this.updateFilters({ cat: key || null, sub: null, page: null });
	}

	selectCategoryFilter(slug: string) {
		const same = this.selectedCategory() === slug;
		this.updateFilters({ cat: same ? null : slug, sub: null, page: null });
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
		this.updateFilters({ maxDays: this.selectedMaxDays() === days ? null : days, page: null });
	}

	setMaxPrice(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		this.updateFilters({ maxPrice: value < this.priceLimit() ? value : null, page: null });
	}

	setSort(event: Event) {
		this.updateFilters({ sort: (event.target as HTMLSelectElement).value || null, page: null });
	}

	removeFilter(key: string) {
		const params: Record<string, null> = { [key]: null, page: null };
		if (key === 'cat') params['sub'] = null;
		this.updateFilters(params);
	}

	applyFilters() {
		this.loadModels();
	}

	resetFilters() {
		this.updateFilters({ cat: null, sub: null, level: null, minRating: null, maxDays: null, maxPrice: null, sort: null, page: null });
	}

	goToPage(page: number) {
		if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
		this.updateFilters({ page });
	}

	private updateFilters(queryParams: Record<string, string | number | null>) {
		this.router.navigate(['/marketplace'], { queryParams, queryParamsHandling: 'merge' });
	}

	// ── Favourites / compare ──
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

	/** Adds/removes a service from the comparison (2+ selected → "قارن" link to /compare-services). */
	toggleCompare(id: string, event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		const current = new Set(this.comparedModels());
		if (current.has(id)) current.delete(id); else current.add(id);
		this.comparedModels.set(current);
	}

	compareIds = computed(() => Array.from(this.comparedModels()).slice(0, 3).join(','));

	// ── Slider ──
	setSlide(index: number) {
		this.currentSlide = index;
	}

	moveSlide(direction: number) {
		this.currentSlide = (this.currentSlide + direction + this.totalSlides) % this.totalSlides;
	}

	startAuto() {
		if (isPlatformBrowser(this.platformId)) {
			this.stopAuto();
			this.sliderTimer = setInterval(() => this.moveSlide(1), 4500);
		}
	}

	stopAuto() {
		if (this.sliderTimer) clearInterval(this.sliderTimer);
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
