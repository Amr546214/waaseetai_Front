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

	request = {
		id: 'REQ-2026-042',
		title: 'تطوير تطبيق تجارة إلكترونية',
		client: 'شركة التجارة الرقمية',
		originalBudget: 45000,
		originalDays: 30,
		currentOffer: 42000,
		currentDays: 28
	};

	messages: NegotiationMessage[] = [
		{ id: '1', from: 'client', text: 'مرحباً، أنا مهتم بتطوير تطبيق تجارة إلكترونية. الميزانية المتاحة 45,000 $ والمدة 30 يوم.', time: '2026-09-10 14:30' },
		{ id: '2', from: 'provider', text: 'أهلاً بك. يمكنني تنفيذ المشروع بميزانية 42,000 $ ومدة 28 يوم مع 3 مراجعات.', time: '2026-09-10 15:00' },
		{ id: '3', from: 'client', text: 'ممتاز. هل يشمل ذلك تصميم الواجهة وتطوير الـ API؟', time: '2026-09-10 15:15' },
		{ id: '4', from: 'provider', text: 'نعم، يشمل تصميم الواجهة وتطوير الـ API وربط بوابة الدفع. لا يشمل استضافة الخادم.', time: '2026-09-10 15:30' }
	];

	constructor(private fb: FormBuilder) {
		this.counterForm = this.fb.group({
			amount: [42000, [Validators.required, Validators.min(1000)]],
			days: [28, [Validators.required, Validators.min(1)]],
			notes: ['', Validators.required]
		});
		this.messageForm = this.fb.group({
			message: ['', [Validators.required, Validators.minLength(2)]]
		});
	}

	sendCounter() {
		if (this.counterForm.valid) {
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
