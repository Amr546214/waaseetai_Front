import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { WsSelectComponent, WsSelectOption } from '../../../../../shared/forms/select.component';
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

	// No client-company projects / team-members directory endpoint exists, so no options are invented here (the previous
	// hard-coded orders and people were saved on the ticket as real data). The selects keep only their neutral option.
	companyProjects: Array<{ id: string; name: string }> = [];

	teamMembers: string[] = [];

	// Same neutral "no data yet" row the native selects showed when a directory is empty (a disabled, unselectable option).
	private readonly noData: WsSelectOption[] = [{ value: '', label: 'لا توجد بيانات بعد', disabled: true }];
	projectOptions = (): WsSelectOption[] => this.companyProjects.length ? this.companyProjects.map(p => ({ value: p.id, label: `${p.name} · ${p.id}` })) : this.noData;
	memberOptions = (): WsSelectOption[] => this.teamMembers.length ? this.teamMembers.map(m => ({ value: m, label: m })) : this.noData;

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
		this.ticketApi.createTicket('client', {
			subject: this.subject().trim(),
			category: this.category(),
			priority: this.priority(),
			description: this.description().trim(),
			relatedOrder: this.relatedOrder().trim() || undefined,
			relatedProject: this.relatedProject() || undefined,
			relatedMember: this.teamMember() || undefined,
		}).subscribe({
			next: (res) => {
				this.submitting.set(false);
				if (res.success && res.data) {
					this.showToast('تم فتح تذكرتك بنجاح');
					setTimeout(() => this.router.navigate(['/client-overview/help/tickets', res.data!.id]), 1200);
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

	get helpBackLink(): string { return '/client-overview/help'; }

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
