import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step6-review',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink],
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

	toggleAckFromKeyboard(event: KeyboardEvent, key: keyof typeof this.acks) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.toggleAck(key);
		}
	}

	// Modal state
	showConfirmModal = signal(false);

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
