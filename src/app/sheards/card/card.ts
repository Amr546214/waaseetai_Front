import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../core/services/marketplace.service';
import { AuthStore } from '../../core/store/auth.store';

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
}
