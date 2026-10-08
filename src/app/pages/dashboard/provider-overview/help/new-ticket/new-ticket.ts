import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';

@Component({
	selector: 'app-new-ticket',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule, WsSelectComponent],
	templateUrl: './new-ticket.html',
	styleUrls: ['./new-ticket.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewTicketComponent {
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private ticketApi = inject(TicketApiService);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	category = signal<string>('');
	priority = signal<string>('عادية');
	subject = signal<string>('');
	description = signal<string>('');
	relatedOrder = signal<string>('');
	relatedProject = signal<string>('');
	relatedMember = signal<string>('');
	ccEmail = signal<string>('');
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

	companyCategories = [
		'مالية — محفظة أو سحب أو فواتير',
		'مشاريع — مراحل أو تسليم أو أوامر تغيير',
		'فريق — أعضاء أو أدوار أو صلاحيات',
		'سوق — نماذج أو اعتماد أو طلبات',
		'تقني — خطأ في اللوحة',
		'أخرى'
	];

	// No company team/project-link source is wired to this form yet, so only the neutral option is offered
	// (the previous list held invented project ids and team-member names).
	companyProjects = [
		'بدون ربط'
	];

	companyMembers = [
		'بدون تحديد'
	];

	priorities = ['عادية', 'عالية', 'عاجلة'];
	companyPriorities = [
		{ id: 'low', label: 'منخفضة', desc: 'استفسار عام لا يعطّل العمل' },
		{ id: 'medium', label: 'متوسطة', desc: 'يؤثر على مشروع أو مبلغ محدد' },
		{ id: 'high', label: 'عالية', desc: 'يعطّل تسليماً أو عملية مالية' },
	];
	selectedPriorityId = signal<string>('medium');

	errors = signal<{ [k: string]: string }>({});

	get activeCategories() {
		return this.isCompanyMode() ? this.companyCategories : this.categories;
	}

	pickPriority(id: string) {
		this.selectedPriorityId.set(id);
		const p = this.companyPriorities.find(x => x.id === id);
		if (p) this.priority.set(p.label);
	}

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
		this.ticketApi.createTicket('provider', {
			subject: this.subject().trim(),
			category: this.category(),
			priority: this.priority(),
			description: this.description().trim(),
			relatedOrder: this.relatedOrder().trim() || undefined,
			relatedProject: this.relatedProject() || undefined,
			relatedMember: this.relatedMember() || undefined,
			ccEmail: this.ccEmail().trim() || undefined,
		}).subscribe({
			next: (res) => {
				this.submitting.set(false);
				if (res.success && res.data) {
					this.showToast('تم فتح تذكرتك بنجاح');
					setTimeout(() => this.router.navigate(['/provider-overview/help/tickets', res.data!.id]), 1200);
				} else {
					this.showToast(res.message || 'تعذر فتح التذكرة');
				}
			},
			error: (err) => {
				this.submitting.set(false);
				this.showToast(err?.error?.message || 'تعذر فتح التذكرة، حاول مرة أخرى');
			}
		});
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
