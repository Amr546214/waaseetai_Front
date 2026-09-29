import { Component, ViewEncapsulation, AfterViewInit, OnInit, OnDestroy, Inject, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MarketplaceService, MarketplaceModel } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { CartService } from '../../../../core/services/cart.service';
import { CartItem } from '../../../../core/models/checkout.model';

@Component({
	selector: 'app-offer',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './offer.html',
	styleUrl: './offer.css',
	encapsulation: ViewEncapsulation.None
})
export class Offer implements AfterViewInit, OnInit, OnDestroy {
	private isBrowser: boolean;
	activeTab = signal<'overview' | 'reviews' | 'faq'>('overview');
	model = signal<MarketplaceModel | null>(null);
	activeImageIndex = signal<number>(0);
	isLoading = signal<boolean>(true);
	isFavorite = signal<boolean>(false);
	isSubmitting = signal<boolean>(false);
	showNegotiation = signal<boolean>(false);
	alreadyInCart = signal<boolean>(false);
	cartError = signal<string | null>(null);
	/** Phase 4 — the signed-in client's own active purchase of this service
	 *  (read back from the server, never inferred locally). While set, the
	 *  "order now" actions are replaced by a link to the running project. */
	activePurchase = signal<{ projectId: string | null; contractStatus: string | null } | null>(null);
	negotiationMessage = signal<string>('');
	questionMessage = signal<string>('');
	reviewFilter = signal<number | null>(null);
	private routeSub!: Subscription;
	private paramSub!: Subscription;
	private authStore = inject(AuthStore);
	private cartService = inject(CartService);

	constructor(
		@Inject(PLATFORM_ID) platformId: Object,
		private route: ActivatedRoute,
		private router: Router,
		private marketplaceService: MarketplaceService
	) {
		this.isBrowser = isPlatformBrowser(platformId);
	}

	ngOnInit() {
		// Read ID from URL and fetch data
		this.paramSub = this.route.paramMap.subscribe(params => {
			const id = params.get('id');
			if (id) {
				this.loadModel(id);
			} else {
				this.isLoading.set(false);
			}
		});

		// Read initial tab from URL and subscribe to changes
		this.routeSub = this.route.queryParams.subscribe(params => {
			const tab = params['tab'] as 'overview' | 'reviews' | 'faq';
			if (tab === 'reviews' || tab === 'faq') {
				this.activeTab.set(tab);
			} else {
				this.activeTab.set('overview');
			}
			if (this.isBrowser) {
				setTimeout(() => this.reInitViews(), 0);
			}
		});
	}

	loadModel(id: string) {
		this.isLoading.set(true);
		this.marketplaceService.getPublishedModelById(id).subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					this.model.set(res.data);
					// Browsing is public. Only ask for the private favorites list when
					// a user is already authenticated, avoiding a guest 401 redirect.
					if (this.authStore.isAuthenticated()) {
						this.marketplaceService.getFavorites().subscribe({
							next: favorites => this.isFavorite.set((favorites?.data || favorites || []).includes(id)),
							error: () => this.isFavorite.set(false)
						});
						this.loadPurchaseStatus(id);
					} else {
						this.activePurchase.set(null);
					}
				}
				this.isLoading.set(false);
				if (this.isBrowser) {
					setTimeout(() => this.reInitViews(), 0);
				}
			},
			error: (err) => {
				console.error('Failed to fetch model:', err);
				this.isLoading.set(false);
			}
		});
	}

	/** Opens the client's already-running project for this service (the real
	 *  contract-backed project id returned by the server). */
	openActiveProject() {
		const projectId = this.activePurchase()?.projectId;
		this.router.navigate(projectId ? ['/client-overview/projects', projectId] : ['/client-overview/projects/active']);
	}

	private loadPurchaseStatus(id: string) {
		this.marketplaceService.getMyPurchaseStatus(id).subscribe({
			next: res => {
				const data = res?.data;
				this.activePurchase.set(data?.active ? { projectId: data.projectId, contractStatus: data.contractStatus } : null);
			},
			// Unknown state: keep the buy actions; the backend still refuses a
			// duplicate purchase authoritatively (409) at cart/order/payment.
			error: () => this.activePurchase.set(null)
		});
	}

	ngOnDestroy() {
		if (this.routeSub) {
			this.routeSub.unsubscribe();
		}
		if (this.paramSub) {
			this.paramSub.unsubscribe();
		}
	}

	ngAfterViewInit() {
		if (!this.isBrowser) return;
		this.reInitViews();
	}

	setTab(tab: 'overview' | 'reviews' | 'faq') {
		this.activeTab.set(tab);
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { tab },
			queryParamsHandling: 'merge',
		});
	}

	setActiveImage(index: number) {
		this.activeImageIndex.set(index);
	}

	toggleFavorite() {
		const id = this.model()?.id;
		if (!id) return;
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		const next = !this.isFavorite();
		this.marketplaceService.setFavorite(id, next).subscribe({ next: () => this.isFavorite.set(next) });
	}

	shareOffer() {
		if (!this.isBrowser) return;
		const shareData = { title: this.model()?.title || '', url: window.location.href };
		if (navigator.share) navigator.share(shareData).catch(() => undefined);
		else navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
	}

	openNegotiation() { this.showNegotiation.set(true); }
	closeNegotiation() { this.showNegotiation.set(false); }
	updateNegotiationMessage(event: Event) { this.negotiationMessage.set((event.target as HTMLTextAreaElement).value); }
	updateQuestionMessage(event: Event) { this.questionMessage.set((event.target as HTMLTextAreaElement).value); }
	toggleNegTag(event: Event) { (event.currentTarget as HTMLElement).classList.toggle('active'); }

	/** Q&A tab ask box: the question reaches the provider through the same
	 *  real request/conversation flow the negotiation modal uses. */
	askQuestion() {
		const question = this.questionMessage().trim();
		if (!question) return;
		this.negotiationMessage.set(question);
		this.requestService('negotiation');
	}

	requestService(mode: 'order' | 'negotiation') {
		const id = this.model()?.id;
		if (!id || this.isSubmitting()) return;
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.isSubmitting.set(true);
		this.marketplaceService.requestService(id, {
			mode,
			message: mode === 'negotiation' ? this.negotiationMessage() : undefined
		}).subscribe({
			next: response => {
				this.isSubmitting.set(false);
				this.closeNegotiation();
				const conversationId = response?.data?.conversationId || response?.conversationId;
				this.router.navigate(['/client-overview/messages'], { queryParams: conversationId ? { conversationId } : {} });
			},
			error: () => this.isSubmitting.set(false)
		});
	}

	addToCart(): void {
		const model = this.model();
		if (!model || this.isSubmitting()) return;
		if (this.activePurchase()) return;
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.isSubmitting.set(true);
		this.cartError.set(null);
		const cartItem = this.mapModelToCartItem(model);
		this.cartService.addToCart$(cartItem).subscribe({
			next: (added) => {
				this.isSubmitting.set(false);
				if (!added) {
					this.alreadyInCart.set(true);
					setTimeout(() => this.alreadyInCart.set(false), 3000);
					this.router.navigate(['/cart']);
				} else {
					this.router.navigate(['/cart']);
				}
			},
			error: (err) => {
				this.isSubmitting.set(false);
				const msg = err?.displayMessage || err?.error?.message || err?.message || 'تعذر إضافة الخدمة إلى السلة';
				this.cartError.set(msg);
				// 409 = the server found an active purchase of this service —
				// re-read it so the page switches to the "under execution" state.
				if (err?.status === 409) this.loadPurchaseStatus(model.id);
				setTimeout(() => this.cartError.set(null), 5000);
			},
		});
	}

	private mapModelToCartItem(model: MarketplaceModel): Omit<CartItem, 'id' | 'addedAt'> {
		return {
			modelId: model.id,
			title: model.title,
			category: model.category,
			categorySlug: model.categorySlug,
			coverImage: model.coverImage,
			totalAmount: model.totalAmount,
			totalDays: model.totalDays,
			level: model.level,
			aiScore: model.aiScore,
			provider: {
				id: model.provider.id,
				name: model.provider.name,
				avatar: model.provider.avatar,
				initials: model.provider.initials,
				isVerified: model.isVerified,
			},
			savedForLater: false,
		};
	}

	setReviewFilter(rating: number | null) { this.reviewFilter.set(rating); }
	filteredReviews() {
		const reviews = this.model()?.reviews || [];
		const filter = this.reviewFilter();
		return filter === null ? reviews : reviews.filter(review => review.rating === filter);
	}
	reviewCountFor(rating: number) { return (this.model()?.reviews || []).filter(review => review.rating === rating).length; }
	reviewPercent(rating: number) {
		const total = this.model()?.reviewsCount || 0;
		return total ? Math.round((this.reviewCountFor(rating) / total) * 100) : 0;
	}
	positiveReviewPercent() {
		const reviews = this.model()?.reviews || [];
		return reviews.length ? Math.round((reviews.filter(review => review.rating >= 4).length / reviews.length) * 100) : 0;
	}
	clientInitial(name?: string) { return name?.trim().charAt(0) || 'م'; }
	starIndexes() { return [1, 2, 3, 4, 5]; }
	/** P-MK-008 rating bars fade from 5★ (full) down to 1★. */
	barOpacity(star: number) { return ({ 5: null, 4: .7, 3: .5, 2: .4, 1: .3 } as Record<number, number | null>)[star] ?? null; }

	private reInitViews() {
		// Background grid + particles come from the website layout.
		if (this.activeTab() === 'overview') {
			this.initGallery();
			this.initReadMore();
		}
	}

	private initGallery() {
		const gtabs = document.querySelectorAll('.gtab');
		if (gtabs.length > 0 && !(gtabs[0] as any)._bound) {
			gtabs.forEach((tab) => {
				(tab as any)._bound = true;
				tab.addEventListener('click', function (this: HTMLElement) {
					document.querySelectorAll('.gtab').forEach((t) => t.classList.remove('active'));
					this.classList.add('active');
				});
			});
		}

		const gthumbs = document.querySelectorAll('.gthumb');
		if (gthumbs.length > 0 && !(gthumbs[0] as any)._bound) {
			gthumbs.forEach((th) => {
				(th as any)._bound = true;
				th.addEventListener('click', function (this: HTMLElement) {
					document.querySelectorAll('.gthumb').forEach((t) => t.classList.remove('active'));
					this.classList.add('active');
				});
			});
		}
	}

	private initReadMore() {
		const rmBtn = document.getElementById('read-more-btn');
		const descEl = document.getElementById('svc-desc-text');

		if (rmBtn && descEl && !(rmBtn as any)._bound) {
			(rmBtn as any)._bound = true;
			let open = false;
			rmBtn.addEventListener('click', () => {
				open = !open;
				descEl.style.maxHeight = open ? 'none' : '160px';
				const svg = rmBtn.querySelector('svg');
				if (svg) svg.style.transform = open ? 'rotate(90deg)' : 'rotate(0)';
				if (rmBtn.childNodes[0]) rmBtn.childNodes[0].textContent = open ? 'عرض أقل ' : 'قراءة المزيد ';
			});
		}
	}

}
