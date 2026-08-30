import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../core/services/marketplace.service';
import { combineLatest, Subscription } from 'rxjs';

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

	isLoading = signal<boolean>(true);
	searchQuery = signal<string>('');
	selectedCategory = signal<string>('all');
	selectedSub = signal<string>('');

	allModels = signal<MarketplaceModel[]>([]);
	aiRecommendedModels = signal<MarketplaceModel[]>([]);
	aiBannerInsight = signal<string>('اختيارات الذكاء الاصطناعي لك: تحليل النماذج المنشورة بنسبة توافق تصل إلى 97%');
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

	constructor() {}

	ngOnInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.startAuto();
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
				if (res?.data?.matchSummary) {
					this.aiBannerInsight.set(res.data.matchSummary);
				}
			},
			error: (err) => console.error('Failed to load AI recommendations:', err)
		});
	}

	selectCategory(cat: string, sub: string = '') {
		this.router.navigate(['/marketplace'], { queryParams: { cat: cat === 'all' ? null : cat, sub: sub || null, q: this.searchQuery() || null } });
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
