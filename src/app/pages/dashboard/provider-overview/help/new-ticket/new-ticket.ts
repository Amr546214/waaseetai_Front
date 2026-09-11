import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

@Component({
	selector: 'app-new-ticket',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './new-ticket.html',
	styleUrls: ['./new-ticket.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewTicketComponent {
	private router = inject(Router);

	category = signal<string>('');
	priority = signal<string>('عادية');
	subject = signal<string>('');
	description = signal<string>('');
	relatedOrder = signal<string>('');
	submitting = signal<boolean>(false);
	toast = signal<string | null>(null);

	categories = [
		'العقود والضمان',
		'المحفظة والمدفوعات',
		'النزاعات',
		'حسابي وأماني',
		'المشاريع والتسليم',
		'أخرى'
	];
	priorities = ['عادية', 'عالية', 'عاجلة'];

	errors = signal<{ [k: string]: string }>({});

	submit() {
		const errs: { [k: string]: string } = {};
		if (!this.category()) errs['cat'] = 'اختر التصنيف';
		if (!this.subject().trim()) errs['subj'] = 'أدخل عنوان التذكرة';
		if (this.subject().trim().length < 5) errs['subj'] = 'العنوان قصير جدًا';
		if (!this.description().trim()) errs['desc'] = 'صف مشكلتك';
		if (this.description().trim().length < 20) errs['desc'] = 'الوصف قصير جدًا، أضف تفاصيل أكثر';

		this.errors.set(errs);
		if (Object.keys(errs).length > 0) return;

		this.submitting.set(true);
		// Simulate submit — replace with real API call when backend supports tickets
		setTimeout(() => {
			this.submitting.set(false);
			this.showToast('تم فتح تذكرتك بنجاح');
			setTimeout(() => this.router.navigate(['/client-overview/help']), 1200);
		}, 800);
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
