import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal, computed, ViewEncapsulation, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../core/services/marketplace.service';
import { combineLatest, Subscription } from 'rxjs';

interface CategoryPalette {
	bg: string;
	border: string;
	color: string;
}

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
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private platformId = inject(PLATFORM_ID);

	currentSlide = 0;
	totalSlides = 3;
	sliderTimer: any;
	private searchTimer: ReturnType<typeof setTimeout> | null = null;
	private subscriptions = new Subscription();
	private modelsRequest?: Subscription;
	private aiRequest?: Subscription;

	// Symbols this component ships in its own local sprite (see marketplace.html).
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

	// Cycling color palette used for category icon chips (design assigns a distinct hue
	// per category — matches the same palette used in category-guide.ts).
	private readonly palette: CategoryPalette[] = [
		{ bg: 'rgba(43,127,255,.12)', border: 'rgba(43,127,255,.22)', color: '#5DA0FF' },
		{ bg: 'rgba(43,212,199,.10)', border: 'rgba(43,212,199,.20)', color: 'var(--teal)' },
		{ bg: 'rgba(15,169,154,.10)', border: 'rgba(15,169,154,.20)', color: 'var(--green)' },
		{ bg: 'rgba(217,138,11,.10)', border: 'rgba(217,138,11,.20)', color: 'var(--kahr)' },
		{ bg: 'rgba(255,140,105,.10)', border: 'rgba(255,140,105,.20)', color: 'var(--red)' },
		{ bg: 'rgba(89,193,245,.10)', border: 'rgba(89,193,245,.20)', color: '#59C1F5' }
	];

	// Maps a category's icon href (e.g. "#ws-cat-code", "ws-cat-code", or a bare
	// Lucide-style name like "code" as the API actually sends) to one of the symbols
	// defined in this component's own sprite, falling back to the generic tag icon.
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

	isLoading = signal<boolean>(true);
	searchQuery = signal<string>('');
	selectedCategory = signal<string>('all');
	selectedSub = signal<string>('');

	allModels = signal<MarketplaceModel[]>([]);
	aiRecommendedModels = signal<MarketplaceModel[]>([]);
	aiBannerInsight = signal<string>('جاري تحليل النماذج المنشورة لعرض أفضل التوصيات لك...');
	// Reflects the backend's honest generationSource — never assume GEMINI
	// before a response actually confirms it (see F6 security follow-up).
	aiGenerationSource = signal<'GEMINI' | 'DETERMINISTIC' | null>(null);
	totalModelsCount = signal<number>(0);

	featuredModels = computed(() => {
		const models = this.allModels();
		return models.filter(m => m.isFeatured).slice(0, 4);
	});

	aiMatchAverage = computed(() => {
		const models = this.aiRecommendedModels();
		if (!models.length) return 0;
		return Math.round(models.reduce((sum, model) => sum + (model.aiMatchPercentage ?? model.aiScore ?? 0), 0) / models.length);
	});

	categoryCount(slug: string): number {
		return Number(this.categories().find(category => category.slug === slug)?.count || 0);
	}

	topRatedModels = computed(() => {
		return [...this.allModels()].sort((a, b) => (b.rating || 0) - (a.rating || 0));
	});

	activeSubSpecialties = computed(() => {
		const catId = this.selectedCategory();
		if (catId === 'all') return [];
		const catObj = this.categories().find(c => c.id === catId || c.slug === catId);
		return catObj?.subSpecialties || [];
	});

	categories = signal<any[]>([]);

	@ViewChild('catsNavInner') catsNavInnerRef?: ElementRef<HTMLDivElement>;
	canScrollCatsRight = signal(false);
	canScrollCatsLeft = signal(false);
	private readonly catsScrollStep = 220;

	hoveredCategory = signal<any | null>(null);
	dropdownPos = signal<{ top: number; right: number }>({ top: 0, right: 0 });
	private closeDropdownTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {}

	ngOnInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.startAuto();
			if (typeof window !== 'undefined') {
				window.addEventListener('resize', this.checkCatsScrollState);
			}
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
			if (params['sub']) {
				this.selectedSub.set(params['sub']);
			} else {
				this.selectedSub.set('');
			}
			this.searchQuery.set(params['q'] || params['search'] || '');
			this.loadModels();
			this.loadAiRecommendations();
		}));

		this.loadCategories();
	}

	ngOnDestroy() {
		this.stopAuto();
		this.subscriptions.unsubscribe();
		this.modelsRequest?.unsubscribe();
		this.aiRequest?.unsubscribe();
		if (this.searchTimer) clearTimeout(this.searchTimer);
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', this.checkCatsScrollState);
		}
		if (this.closeDropdownTimer) clearTimeout(this.closeDropdownTimer);
	}

	onCatEnter(cat: any, ev: MouseEvent) {
		if (!cat.subSpecialties || cat.subSpecialties.length === 0) {
			this.hoveredCategory.set(null);
			return;
		}
		if (this.closeDropdownTimer) {
			clearTimeout(this.closeDropdownTimer);
			this.closeDropdownTimer = null;
		}
		const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
		this.dropdownPos.set({ top: rect.bottom + 1, right: window.innerWidth - rect.right });
		this.hoveredCategory.set(cat);
	}

	onDropdownEnter() {
		if (this.closeDropdownTimer) {
			clearTimeout(this.closeDropdownTimer);
			this.closeDropdownTimer = null;
		}
	}

	onCatLeave() {
		if (this.closeDropdownTimer) clearTimeout(this.closeDropdownTimer);
		this.closeDropdownTimer = setTimeout(() => this.hoveredCategory.set(null), 150);
	}

	checkCatsScrollState = () => {
		const el = this.catsNavInnerRef?.nativeElement;
		if (!el) return;
		const maxScroll = el.scrollWidth - el.clientWidth;
		const scrolled = Math.abs(el.scrollLeft);
		this.canScrollCatsRight.set(scrolled > 2);
		this.canScrollCatsLeft.set(maxScroll - scrolled > 2);
	};

	scrollCatsRight() {
		this.catsNavInnerRef?.nativeElement.scrollBy({ left: this.catsScrollStep, behavior: 'smooth' });
		setTimeout(this.checkCatsScrollState, 300);
	}

	scrollCatsLeft() {
		this.catsNavInnerRef?.nativeElement.scrollBy({ left: -this.catsScrollStep, behavior: 'smooth' });
		setTimeout(this.checkCatsScrollState, 300);
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
				setTimeout(this.checkCatsScrollState, 0);
			},
			error: (err) => console.error('Failed to load dynamic categories:', err)
		});
	}

	loadModels() {
		this.isLoading.set(true);
		const filters: any = {
			category: this.selectedCategory() !== 'all' ? this.selectedCategory() : undefined,
			specialization: this.selectedSub() || undefined,
			search: this.searchQuery() || undefined,
			limit: 50
		};

		this.modelsRequest?.unsubscribe();
		this.modelsRequest = this.marketplaceService.getPublishedModels(filters).subscribe({
			next: (res) => {
				const models = res?.data?.models || res?.models || [];
				this.allModels.set(models);
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
			limit: 3
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

	resultsSectionTitle = computed(() => {
		const catSlug = this.selectedCategory();
		if (!catSlug || catSlug === 'all') return 'الأبرز في السوق';
		const cat = this.categories().find((c: any) => c.slug === catSlug);
		if (!cat) return 'الأبرز في السوق';
		const subSlug = this.selectedSub();
		if (subSlug) {
			const sub = (cat.subSpecialties || []).find((s: any) => (s.slug || s.name || s.id) === subSlug);
			if (sub) return `نتائج: ${sub.name}`;
		}
		return `نتائج: ${cat.name}`;
	});

	selectCategory(cat: string, sub: string = '') {
		this.router.navigate(['/marketplace'], { queryParams: { cat: cat === 'all' ? null : cat, sub: sub || null, q: this.searchQuery() || null } })
			.then(() => {
				if (isPlatformBrowser(this.platformId)) {
					// Router's scrollPositionRestoration jumps back to the top on every
					// navigation, including this query-param-only one; scroll to the
					// (now-filtered) results afterwards so the click visibly does something.
					setTimeout(() => {
						document.getElementById('marketplace-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}, 60);
				}
			});
	}

	onSearchInput(event: Event) {
		const val = (event.target as HTMLInputElement).value;
		this.searchQuery.set(val);
		if (this.searchTimer) clearTimeout(this.searchTimer);
		this.searchTimer = setTimeout(() => {
			this.loadModels();
			this.loadAiRecommendations();
		}, 350);
	}

	triggerSearch() {
		if (this.searchTimer) clearTimeout(this.searchTimer);
		this.loadModels();
		this.loadAiRecommendations();
	}

	setSlide(index: number) {
		this.currentSlide = index;
	}

	moveSlide(direction: number) {
		this.currentSlide = (this.currentSlide + direction + this.totalSlides) % this.totalSlides;
	}

	startAuto() {
		if (isPlatformBrowser(this.platformId)) {
			this.sliderTimer = setInterval(() => {
				this.moveSlide(1);
			}, 4500);
		}
	}

	stopAuto() {
		if (this.sliderTimer) {
			clearInterval(this.sliderTimer);
		}
	}
}
