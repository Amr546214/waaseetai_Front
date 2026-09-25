import { Component, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

interface CategoryPalette {
	bg: string;
	border: string;
	color: string;
}

@Component({
	selector: 'app-category-guide',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './category-guide.html',
	styleUrl: './category-guide.css',
	encapsulation: ViewEncapsulation.None
})
export class CategoryGuide implements OnInit, AfterViewInit, OnDestroy {
	private marketplaceService = inject(MarketplaceService);
	private router = inject(Router);
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);

	// Symbols this component ships in its own local sprite (see category-guide.html).
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
	// per category — with a dynamic category list we cycle through the same palette
	// the rest of the app already uses, e.g. marketplace-preview.ts getCategoryColor()).
	private readonly palette: CategoryPalette[] = [
		{ bg: 'rgba(43,127,255,.12)', border: 'rgba(43,127,255,.22)', color: '#5DA0FF' },
		{ bg: 'rgba(43,212,199,.10)', border: 'rgba(43,212,199,.20)', color: 'var(--teal)' },
		{ bg: 'rgba(15,169,154,.10)', border: 'rgba(15,169,154,.20)', color: 'var(--green)' },
		{ bg: 'rgba(217,138,11,.10)', border: 'rgba(217,138,11,.20)', color: 'var(--kahr)' },
		{ bg: 'rgba(255,140,105,.10)', border: 'rgba(255,140,105,.20)', color: 'var(--red)' },
		{ bg: 'rgba(123,47,190,.10)', border: 'rgba(123,47,190,.20)', color: 'var(--ai-txt)' }
	];

	// ---- Presentational fallbacks -------------------------------------------------
	// The /marketplace/categories endpoint (MarketplaceService.getCategories) does not
	// return a verified-providers aggregate, nor per-category rating / delivery-time /
	// satisfaction figures. Those numbers do not exist anywhere in the app's services,
	// so — per the design spec's own fallback guidance — presentational placeholders are
	// used for them instead of inventing per-category data.
	readonly verifiedProvidersFallback = 4200;
	readonly cardRatingFallback = '4.8';
	readonly cardDeliveryFallback = '3-5 أيام';
	readonly cardSatisfactionFallback = 96;

	isLoading = signal<boolean>(true);
	searchQuery = signal<string>('');
	categories = signal<any[]>([]);
	activeCatSlug = signal<string>('');
	aiTopPicks = signal<{ id: string; title: string }[]>([]);
	aiBannerInsight = signal<string>('توصيات الذكاء الاصطناعي تُحدَّث باستمرار بناءً على نشاط الطلبات على المنصة — تصفح الفئات الأكثر طلباً أدناه');
	// Reflects the backend's honest generationSource — never assume GEMINI
	// before a response actually confirms it (see F6 security follow-up).
	aiGenerationSource = signal<'GEMINI' | 'DETERMINISTIC' | null>(null);

	private totalModelsCountRaw = signal<number>(0);
	private scrollHandler = () => this.updateActiveCategory();

	totalMainCategories = computed(() => this.categories().length);

	totalSubSpecialties = computed(() =>
		this.categories().reduce((sum, cat) => sum + (cat.subSpecialties?.length || 0), 0)
	);

	totalPublishedServices = computed(() => {
		if (this.totalModelsCountRaw()) return this.totalModelsCountRaw();
		return this.categories().reduce((sum, cat) => sum + (Number(cat.count) || 0), 0);
	});

	// The category with the highest published-service count — a real, data-derived
	// signal used to badge the single most in-demand category instead of a fake tag.
	topCategorySlug = computed(() => {
		const cats = this.categories();
		if (!cats.length) return '';
		return [...cats].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))[0]?.slug || '';
	});

	primaryCategories = computed(() => this.categories().slice(0, 6));
	moreCategories = computed(() => this.categories().slice(6));

	ngOnInit() {
		this.loadCategories();
		this.loadAiInsight();
	}

	ngAfterViewInit() {
		if (this.isBrowser) {
			window.addEventListener('scroll', this.scrollHandler, { passive: true });
		}
	}

	ngOnDestroy() {
		if (this.isBrowser) {
			window.removeEventListener('scroll', this.scrollHandler);
		}
	}

	loadCategories() {
		this.isLoading.set(true);
		this.marketplaceService.getCategories().subscribe({
			next: (res) => {
				const cats = res?.data?.categories || [];
				this.categories.set(cats);
				if (cats.length) this.activeCatSlug.set(cats[0].slug);
				if (res?.data?.totalModelsCount) {
					this.totalModelsCountRaw.set(res.data.totalModelsCount);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load categories:', err);
				this.isLoading.set(false);
			}
		});
	}

	loadAiInsight() {
		this.marketplaceService.getAiRecommendations({ limit: 2 }).subscribe({
			next: (res) => {
				const recs = res?.data?.recommendations || res?.recommendations || [];
				this.aiTopPicks.set(recs.map((r: any) => ({ id: r.id, title: r.title })));
				this.aiGenerationSource.set(res?.data?.generationSource === 'GEMINI' ? 'GEMINI' : 'DETERMINISTIC');
				if (res?.data?.matchSummary) {
					this.aiBannerInsight.set(res.data.matchSummary);
				}
			},
			error: (err) => {
				console.error('Failed to load AI insight:', err);
				this.aiGenerationSource.set(null);
			}
		});
	}

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

	// The sub-specialty with the highest published count inside a category — used to
	// highlight the "most requested" item with real data instead of a scripted example.
	topSubId(cat: any): string {
		const subs = cat?.subSpecialties || [];
		if (!subs.length) return '';
		return [...subs].sort((a: any, b: any) => (Number(b.count) || 0) - (Number(a.count) || 0))[0]?.id || '';
	}

	// Same-page smooth scroll to a category card/mini-cat (both carry id="cat-{slug}").
	// Router fragment navigation isn't used here since this app's router config
	// (see app.config.ts) doesn't enable anchorScrolling.
	scrollToCategory(slug: string) {
		if (!this.isBrowser) return;
		const el = document.getElementById('cat-' + slug);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	onSearchInput(event: Event) {
		this.searchQuery.set((event.target as HTMLInputElement).value);
	}

	triggerSearch() {
		const q = this.searchQuery().trim();
		this.router.navigate(['/marketplace'], { queryParams: q ? { q } : {} });
	}

	formatCompact(n: number): string {
		if (!n) return '0';
		if (n >= 1000) {
			const val = n / 1000;
			return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'k';
		}
		return n.toLocaleString('ar-EG');
	}

	private updateActiveCategory() {
		if (!this.isBrowser) return;
		const sections = document.querySelectorAll('[id^="cat-"]');
		let current = this.activeCatSlug();
		sections.forEach((section) => {
			const el = section as HTMLElement;
			if (window.scrollY + 140 >= el.offsetTop) {
				current = el.id.replace('cat-', '');
			}
		});
		if (current !== this.activeCatSlug()) this.activeCatSlug.set(current);
	}
}
