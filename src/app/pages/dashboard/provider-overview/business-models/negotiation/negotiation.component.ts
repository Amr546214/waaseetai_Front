import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface NegotiationMessage {
	id: string; from: 'client' | 'provider'; text: string; time: string;
}

@Component({
	selector: 'app-negotiation',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterModule],
	templateUrl: './negotiation.component.html',
	styleUrls: ['./negotiation.component.css']
})
export class NegotiationComponent {
	counterForm: FormGroup;
	messageForm: FormGroup;

	// No negotiation data source exists for this page yet: nothing is invented, the page shows its empty state.
	request: { id: string; title: string; client: string; originalBudget: number; originalDays: number; currentOffer: number; currentDays: number } | null = null;

	messages: NegotiationMessage[] = [];

	constructor(private fb: FormBuilder) {
		this.counterForm = this.fb.group({
			amount: [null as number | null, [Validators.required, Validators.min(1000)]],
			days: [null as number | null, [Validators.required, Validators.min(1)]],
			notes: ['', Validators.required]
		});
		this.messageForm = this.fb.group({
			message: ['', [Validators.required, Validators.minLength(2)]]
		});
	}

	sendCounter() {
		if (this.counterForm.valid && this.request) {
			this.request.currentOffer = this.counterForm.value.amount;
			this.request.currentDays = this.counterForm.value.days;
			this.messages.push({
				id: Date.now().toString(),
				from: 'provider',
				text: `عرض محدث: ${this.counterForm.value.amount.toLocaleString()} $ خلال ${this.counterForm.value.days} يوم. ${this.counterForm.value.notes}`,
				time: new Date().toLocaleString('ar-SA')
			});
			this.counterForm.reset({ amount: this.request.currentOffer, days: this.request.currentDays, notes: '' });
		}
	}

	sendMessage() {
		if (this.messageForm.valid) {
			this.messages.push({
				id: Date.now().toString(),
				from: 'provider',
				text: this.messageForm.value.message,
				time: new Date().toLocaleString('ar-SA')
			});
			this.messageForm.reset();
		}
	}

	acceptOffer() {
		this.messages.push({
			id: Date.now().toString(),
			from: 'provider',
			text: 'تم قبول العرض. سأرسل العقد للتوقيع.',
			time: new Date().toLocaleString('ar-SA')
		});
	}
}
