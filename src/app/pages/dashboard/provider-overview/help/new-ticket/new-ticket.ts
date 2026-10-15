import { Component, ChangeDetectionStrategy, ElementRef, signal, inject, computed } from '@angular/core';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, reportProblems } from '../../../../../shared/forms/form-error-focus';
import { clearTicketField, reportTicketError, ticketProblems } from '../ticket-form';

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
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

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

	/** A picked / typed field loses its error mark (a ws-select raises no input event). */
	edited(name: string) {
		clearTicketField(this.host.nativeElement, name);
	}

	async submit() {
		// A second click / Enter while the request is in flight does nothing.
		if (this.submitting() || this.guard.busy) return;
		const root = this.host.nativeElement;
		const problems = ticketProblems(root, { subject: this.subject(), category: this.category(), description: this.description() }, ['category', 'subject', 'description']);
		const errs: { [k: string]: string } = {};
		for (const p of problems) errs[({ category: 'cat', subject: 'subj', description: 'desc' } as Record<string, string>)[p.field!]] = p.message;
		this.errors.set(errs);
		if (problems.length > 0) {
			// Message next to the field + red + aria-invalid, and focus on the first one below the sticky header.
			await reportProblems(root, problems);
			return;
		}
		if (!this.guard.enter()) return;

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
				this.guard.release();
				if (res.success && res.data) {
					this.notify.success('تم فتح تذكرتك بنجاح');
					setTimeout(() => this.router.navigate(['/provider-overview/help/tickets', res.data!.id]), 1200);
				} else {
					this.notify.error(res.message || 'تعذر فتح التذكرة');
				}
			},
			error: (err) => {
				this.submitting.set(false);
				this.guard.release();
				void reportTicketError(root, err, this.notify, 'تعذر فتح التذكرة، حاول مرة أخرى');
			}
		});
	}
}
