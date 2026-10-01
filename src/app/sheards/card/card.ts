import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../core/services/marketplace.service';
import { AuthStore } from '../../core/store/auth.store';
import { resolveProviderLevelBadgeStyle } from '../../core/utils/provider-level-style.util';

@Component({
	selector: 'app-card',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './card.html',
	styleUrl: './card.css',
	encapsulation: ViewEncapsulation.None,
})
export class Card {
	constructor(
		private marketplaceService: MarketplaceService,
		private authStore: AuthStore,
		private router: Router,
	) {
		// Favorites are private. Public marketplace pages must not call this endpoint
		// for guests, otherwise the expected 401 would trigger a login redirect.
		if (this.authStore.isAuthenticated()) {
			this.marketplaceService.getFavorites().subscribe({
				next: response => this.favoriteModels.set(new Set(response?.data || response || [])),
				error: () => undefined
			});
		}
	}
	// Inputs
	models = input<MarketplaceModel[]>([]);
	isLoading = input<boolean>(false);
	linkBase = input<string>('/marketplace/offer');

	// Outputs
	favoriteToggled = output<string>();
	compareToggled = output<string>();
	categoryReset = output<void>();

	// Internal state
	favoriteModels = signal<Set<string>>(new Set());
	comparedModels = signal<Set<string>>(new Set());

	private readonly gradients = [
		'linear-gradient(135deg, #0A1628 0%, #0D1E38 100%)',
		'linear-gradient(135deg, #071822 0%, #0A2030 100%)',
		'linear-gradient(135deg, #0A1622 0%, #0E1F30 100%)',
		'linear-gradient(135deg, #161209 0%, #1E1800 100%)',
		'linear-gradient(135deg, #18091E 0%, #250C30 100%)',
	];

	getCardGradient(index: number): string {
		return this.gradients[index % this.gradients.length];
	}

	toggleFavorite(id: string, event: Event): void {
		event.preventDefault();
		event.stopPropagation();
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		const current = new Set(this.favoriteModels());
		if (current.has(id)) {
			current.delete(id);
		} else {
			current.add(id);
		}
		this.favoriteModels.set(current);
		this.marketplaceService.setFavorite(id, current.has(id)).subscribe({
			next: () => this.favoriteToggled.emit(id),
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
		if (current.has(id)) {
			current.delete(id);
		} else {
			current.add(id);
		}
		this.comparedModels.set(current);
		this.compareToggled.emit(id);
	}

	isFav(id: string): boolean {
		return this.favoriteModels().has(id);
	}

	isCompared(id: string): boolean {
		return this.comparedModels().has(id);
	}

	resetCategory(): void {
		this.categoryReset.emit();
	}

	/** Batch 5 — same canonical badge styling as marketplace.ts/slug.ts/
	 *  curated.ts, so a provider's level badge is never a different color
	 *  here than on the already-correct result-grid pages. */
	levelStyle(model: MarketplaceModel): { bg: string; color: string } {
		return resolveProviderLevelBadgeStyle(model.level, model.levelBg, model.levelColor);
	}

	// Batch 4 — model.eligibility is populated server-side (see
	// marketplace-service.service.ts getMarketplaceModels) ONLY for an
	// authenticated Client, via the same findActiveServicePurchases() helper
	// the checkout write-path guard uses. undefined for guests/other roles,
	// so these simply fall through to the normal card behavior for them.
	hasActivePurchase(model: MarketplaceModel): boolean {
		return Boolean(model.eligibility?.hasActivePurchase);
	}

	/** Navigates straight to the existing running project instead of the
	 *  normal offer/buy page when the Client already has an active purchase
	 *  for this exact service — never a fabricated id, only ever the real
	 *  activeProjectId the backend returned. */
	cardLink(model: MarketplaceModel): (string | null)[] {
		if (model.eligibility?.hasActivePurchase && model.eligibility.activeProjectId) {
			return ['/client-overview/projects', model.eligibility.activeProjectId];
		}
		return [this.linkBase(), model.id];
	}
}
