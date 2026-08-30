import { Component, AfterViewInit, OnDestroy, OnInit, PLATFORM_ID, Inject, ViewEncapsulation, signal, computed } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';
import { Card } from '../../../../sheards/card/card';
import { Subscription } from 'rxjs';

@Component({
	selector: 'app-slug',
	standalone: true,
	imports: [CommonModule, RouterLink, Card],
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

	aiInsightTitle = computed(() => {
		const best = [...this.models()].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))[0];
		return best ? `الأعلى توافقاً مع الذكاء الاصطناعي: ${best.title}` : 'لا توجد خدمات متاحة حالياً';
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
		private marketplaceService: MarketplaceService
	) {
		this.isBrowser = isPlatformBrowser(platformId);

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

		this.initParticles();
		this.initDragScroll();
		this.initFilters();
	}

	ngOnDestroy() {
		this.subscriptions.unsubscribe();
	}

	private initParticles() {
		const pc = document.getElementById('particles-container');
		if (pc) {
			const n = window.innerWidth < 768 ? 11 : 25;
			for (let i = 0; i < n; i++) {
				const p = document.createElement('div');
				p.className = 'particle';
				const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
				p.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + sz + ';height:' + sz + ';animation-duration:' + (Math.random() * 9 + 5).toFixed(1) + 's;animation-delay:' + (Math.random() * -12).toFixed(1) + 's;opacity:' + (Math.random() * 0.35 + 0.08).toFixed(2);
				pc.appendChild(p);
			}
		}
	}

	private initDragScroll() {
		const el = document.querySelector('.subcats-inner') as HTMLElement;
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

	private initFilters() {
		// Remaining filter initialization if needed for other non-angular filters like range sliders
	}
}
