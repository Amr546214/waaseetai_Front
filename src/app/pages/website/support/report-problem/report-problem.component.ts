import { Component, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStore } from '../../../../core/store/auth.store';
import { TicketApiService, TicketRole } from '../../../../core/services/ticket-api.service';
import { mapHttpError } from '../../../../core/forms/http-error';
import { UserRole } from '../../../../core/models/auth.model';
import { attemptSubmit } from '../../../../core/forms/form-helpers';
import { focusInvalidControls } from '../../../../shared/forms/form-error-focus';

const REPORT_LABELS = { category: 'نوع المشكلة', name: 'الاسم', email: 'البريد الإلكتروني', subject: 'عنوان المشكلة', description: 'تفاصيل المشكلة' };

type Priority = 'low' | 'med' | 'high';

interface ProblemType { id: string; label: string; desc: string; icon: string; icoStyle: string; color: string; }

@Component({
	selector: 'app-report-problem',
	standalone: true,
	imports: [ReactiveFormsModule, RouterModule],
	templateUrl: './report-problem.component.html',
	styleUrls: ['./report-problem.component.css']
})
export class ReportProblemComponent {
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly auth = inject(AuthStore);
	private readonly tickets = inject(TicketApiService);
	/** Set once the server confirmed the save: the ticket number the person can look up. */
	ticketNumber = '';
	/** Error beside the send button (what failed, what to do). Inputs are kept. */
	sendError = '';
	/** The reply was lost: the ticket may exist. Resending is blocked until the person checks their tickets. */
	outcomeUnknown = false;
	fieldServerErrors: Record<string, string> = {};
	reportForm: FormGroup;
	isSubmitting = false;
	submitted = false;

	/** Problem types, verbatim from the design (P-SP-003 type grid). */
	categories: ProblemType[] = [
		{ id: 'payment', label: 'مدفوعات ومالية', desc: 'دفع، استرداد، حساب ضمان', icon: 'dollar', icoStyle: 'background:rgba(43,212,199,.08);border:1px solid rgba(43,212,199,.18)', color: 'var(--teal)' },
		{ id: 'account', label: 'حساب ودخول', desc: 'تسجيل الدخول، كلمة المرور، الملف', icon: 'user', icoStyle: 'background:rgba(43,127,255,.08);border:1px solid rgba(43,127,255,.18)', color: 'var(--blue-txt)' },
		{ id: 'service', label: 'مشروع وخدمة', desc: 'جودة التسليم، توقف المقدم', icon: 'file', icoStyle: 'background:rgba(217,138,11,.08);border:1px solid rgba(217,138,11,.18)', color: 'var(--kahr)' },
		{ id: 'fraud', label: 'احتيال وانتهاك', desc: 'سلوك مسيء، محتوى مخالف', icon: 'shield', icoStyle: 'background:rgba(255,140,105,.08);border:1px solid rgba(255,140,105,.18)', color: 'var(--red)' },
		{ id: 'technical', label: 'مشكلة تقنية', desc: 'خطأ في الموقع، ميزة لا تعمل', icon: 'settings', icoStyle: 'background:rgba(168,178,209,.08);border:1px solid rgba(168,178,209,.18)', color: 'var(--txt-2)' },
		{ id: 'other', label: 'أخرى', desc: 'أي شيء لا ينطبق عليه ما سبق', icon: 'lock', icoStyle: 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)', color: 'var(--txt-3)' }
	];

	constructor(private fb: FormBuilder) {
		this.reportForm = this.fb.group({
			category: ['', Validators.required],
			name: ['', Validators.required],
			email: ['', [Validators.required, Validators.email]],
			projectId: [''],
			subject: ['', [Validators.required, Validators.minLength(5)]],
			description: ['', [Validators.required, Validators.minLength(20)]],
			priority: ['' as Priority | '']
		});
	}

	get category(): string { return this.reportForm.get('category')?.value; }
	get priority(): Priority | '' { return this.reportForm.get('priority')?.value; }

	selectType(id: string) {
		this.reportForm.get('category')?.setValue(id);
		this.reportForm.get('category')?.markAsTouched();
	}

	setPri(p: Priority) {
		this.reportForm.get('priority')?.setValue(p);
	}

	get loggedIn(): boolean { return this.auth.isAuthenticated(); }

	/** The ticket router for the role the person acts as (admins use the client one: it only needs a signed-in active user). */
	private ticketRole(): TicketRole {
		const r = this.auth.actingRole();
		return r === UserRole.PROVIDER ? 'provider' : r === UserRole.AFFILIATE ? 'marketer' : 'client';
	}

	get ticketsLink(): string {
		const role = this.ticketRole();
		return role === 'provider' ? '/provider-overview/help/tickets' : role === 'marketer' ? '/marketer-overview/help/tickets' : '/client-overview/help/tickets';
	}

	invalid(name: string): boolean {
		const c = this.reportForm.get(name);
		return !!(c && c.touched && c.invalid);
	}

	onSubmit() {
		if (this.isSubmitting) return; // one send at a time
		// Every invalid field shows its message (touched) and the first one, in page order, takes the focus below the header.
		const attempt = attemptSubmit(this.reportForm, { labels: REPORT_LABELS });
		if (attempt.valid) {
			if (!this.loggedIn) return; // the page shows the sign-in requirement; nothing is sent
			if (this.outcomeUnknown) return; // check the tickets first (a second send could create a duplicate)
			this.isSubmitting = true;
			this.sendError = '';
			this.fieldServerErrors = {};
			const v = this.reportForm.getRawValue();
			const pri = v.priority === 'high' ? 'عالية' : v.priority === 'low' ? 'منخفضة' : 'عادية';
			const label = this.categories.find(c => c.id === v.category)?.label || v.category;
			this.tickets.createTicket(this.ticketRole(), {
				subject: v.subject, category: label, priority: pri,
				description: v.description, relatedProject: v.projectId || undefined, ccEmail: v.email,
			}).subscribe({
				next: (res) => {
					this.isSubmitting = false;
					const num = res?.data?.ticketNumber;
					if (res?.success && num) {
						this.ticketNumber = num;
						this.submitted = true;
						window.scrollTo({ top: 0, behavior: 'smooth' });
					} else {
						// no confirmed ticket number: never claim success
						this.outcomeUnknown = true;
						this.sendError = 'لم يصلنا تأكيد حفظ البلاغ. تحقق من قائمة تذاكرك قبل إعادة الإرسال حتى لا يتكرر.';
					}
				},
				error: (err: HttpErrorResponse) => {
					this.isSubmitting = false;
					const m = mapHttpError(err, { fallback: 'تعذّر إرسال البلاغ. لم يُحفظ شيء، ويمكنك المحاولة مجددًا.' });
					this.fieldServerErrors = m.fieldErrors;
					this.outcomeUnknown = !!m.outcomeUnknown;
					this.sendError = m.kind === 'forbidden' || m.status === 403 ? 'لا تملك صلاحية إرسال بلاغ بهذا الحساب. سجّل الدخول بحساب مستخدم.' : m.message;
				},
			});
		} else {
			void focusInvalidControls(this.host.nativeElement, attempt.missing);
		}
	}

	resetForm() {
		this.submitted = false;
		this.ticketNumber = '';
		this.sendError = '';
		this.outcomeUnknown = false;
		this.reportForm.reset({ category: '', name: '', email: '', projectId: '', subject: '', description: '', priority: '' });
	}
}
