import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step6-review',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step6-review.html',
})
export class Step6Review {
	@Input({ required: true }) parent!: CreateRequest;

	// Acknowledgments state
	acks = {
		data: signal(false),
		terms: signal(false),
		privacy: signal(false),
		publish: signal(false)
	};

	allAcksChecked = computed(() => {
		return this.acks.data() && this.acks.terms() && this.acks.privacy() && this.acks.publish();
	});

	toggleAck(key: keyof typeof this.acks) {
		this.acks[key].set(!this.acks[key]());
	}

	// Recommendations state
	recDetailsDone = signal(false);
	recBudgetDone = signal(false);

	applyRecDetails() {
		this.recDetailsDone.set(true);
	}

	applyRecBudget() {
		this.recBudgetDone.set(true);
		// Update budget Min/Max to 10000 if it was range or fixed
		if (this.parent.budgetType() === 'range') {
			this.parent.budgetMin.set(10000);
			this.parent.budgetMax.set(10000);
		} else if (this.parent.budgetType() === 'fixed') {
			this.parent.budgetFixed.set(10000);
		}
	}

	skipRecDetails() {
		this.recDetailsDone.set(true);
	}

	skipRecBudget() {
		this.recBudgetDone.set(true);
	}

	// Modal and Overlay state
	showConfirmModal = signal(false);
	showSuccessOverlay = signal(false);

	openModal() {
		if (this.allAcksChecked()) {
			this.showConfirmModal.set(true);
		}
	}

	closeModal() {
		this.showConfirmModal.set(false);
	}

	confirmPublish() {
		this.showConfirmModal.set(false);
		this.parent.submitRequest();
	}
}
