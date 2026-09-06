import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatingScore } from '../../../../../core/models/rating.model';

@Component({
	selector: 'app-client-rating-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './rating-modal.html',
	styleUrl: './rating-modal.css',
})
export class ClientRatingModal {
	@Input() open = false;
	@Input() providerName = '';
	@Input() isSubmitting = false;

	@Output() close = new EventEmitter<void>();
	@Output() submit = new EventEmitter<{ rating: RatingScore; comment?: string }>();

	hoverRating = signal<RatingScore | 0>(0);
	selectedRating = signal<RatingScore | 0>(0);
	comment = '';
	error = signal('');

	stars: RatingScore[] = [1, 2, 3, 4, 5];

	setHover(value: RatingScore | 0): void {
		this.hoverRating.set(value);
	}

	clearHover(): void {
		this.hoverRating.set(0);
	}

	selectRating(value: RatingScore): void {
		this.selectedRating.set(value);
		this.error.set('');
	}

	closeModal(): void {
		if (this.isSubmitting) return;
		this.reset();
		this.close.emit();
	}

	onSubmit(): void {
		const rating = this.selectedRating();
		if (rating === 0) {
			this.error.set('الرجاء اختيار تقييم من 1 إلى 5 نجوم');
			return;
		}
		this.submit.emit({ rating, comment: this.comment.trim() || undefined });
	}

	reset(): void {
		this.selectedRating.set(0);
		this.hoverRating.set(0);
		this.comment = '';
		this.error.set('');
	}
}
