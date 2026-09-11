import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

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
	private authStore = inject(AuthStore);

	isCompanyMode = computed(() => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY);

	category = signal<string>('');
	priority = signal<string>('عادية');
	subject = signal<string>('');
	description = signal<string>('');
	relatedOrder = signal<string>('');
	relatedProject = signal<string>('');
	teamMember = signal<string>('');
	submitting = signal<boolean>(false);
	toast = signal<string | null>(null);

	individualCategories = [
		'العقود والضمان',
		'المحفظة والمدفوعات',
		'النزاعات',
		'حسابي وأماني',
		'المشاريع والتسليم',
		'أخرى'
	];

	companyCategories = [
		'العقود والضمان',
		'المحفظة والمدفوعات',
		'النزاعات',
		'حساب الشركة وأمانها',
		'المشاريع والتسليم',
		'إدارة الفريق والصلاحيات',
		'الفواتير الرسمية',
		'أخرى'
	];

	categories = computed(() => this.isCompanyMode() ? this.companyCategories : this.individualCategories);
	priorities = ['عادية', 'عالية', 'عاجلة'];

	companyProjects = [
		{ id: 'ORD-3092', name: 'تصميم هوية بصرية لمنتج' },
		{ id: 'ORD-3093', name: 'تطوير متجر إلكتروني للشركة' },
		{ id: 'ORD-3094', name: 'حملة تسويق رقمي للموسم' },
	];

	teamMembers = [
		'سلطان العتيبي · المبيعات',
		'خالد المطيري · تقنية المعلومات',
		'نورة القحطاني · التسويق',
		'فهد الغامدي · المالية',
	];

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

	get helpBackLink(): string { return '/client-overview/help'; }

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
