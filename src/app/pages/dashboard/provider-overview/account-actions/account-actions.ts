import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PROVIDER_SETUP_PAGE } from '../profile/profile-setup/provider-setup-state';
import { RATE_LIMIT_CHECK_MESSAGE, isRateLimitError } from '../../../../core/utils/rate-limit.util';
import { ProviderAccessService, ProviderAccessState } from '../../../../core/services/provider-access.service';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

export const SAMPLE_REQUIRED_MESSAGE = 'اجتزت الاختبار، لكن يجب رفع نموذج الاعتماد لإكمال المراجعة.';
export const ASSESSMENT_REQUIRED_MESSAGE = 'أكمل الاختبار لإكمال اعتماد حسابك.';
export const PENDING_REVIEW_MESSAGE = 'تم اجتياز الاختبار، ونموذج الاعتماد قيد المراجعة. ستفتح لوحة مقدم الخدمة بعد اعتماد الإدارة.';
export const COMPLETION_REQUIRED_MESSAGE = 'طلبت الإدارة استكمال بيانات طلب الاعتماد. افتح الطلب أدناه واضغط «استكمال البيانات».';

export type ApprovalRequestStatus = 'UNDER_REVIEW' | 'COMPLETION_REQUIRED' | 'REJECTED' | 'APPROVED';

export interface ApprovalRequestItem {
	id: string; requestNo: string; status: ApprovalRequestStatus; statusLabel: string;
	specialty: { providerSpecialtyId: string; nameAr: string; subSpecialties: string[] };
	model: { title: string; description: string; technologiesUsed: string[]; projectUrl: string | null; githubUrl: string | null };
	attachments: { id: string; fileName: string; mimeType: string; bytes: number }[];
	allowedAttachments: { maxFiles: number; maxMegabytes: number; allowedExtensions: string[]; label: string; note: string };
	revision: number; adminNote: string | null; rejectionReason: string | null; completionFields: string[]; canResubmit: boolean;
	submittedAt: string; updatedAt: string; decidedAt: string | null;
	history: { id: string; kind: string; label: string; revision: number; note: string | null; at: string }[];
}

/** Where a request is completed / re-submitted: the SAME wizard, opened on the request with its previous data. */
export const completionUrl = (id: string) => `/provider-overview/business-models/accreditation/new?resubmit=${encodeURIComponent(id)}`;

/**
 * «إجراءات الحساب»: the one place an account that is not approved yet follows its approval. The banner comes from GET /provider/access-state (the server's
 * entry gate), the log from GET /provider/account-actions (each request with id, specialty, model, attachments, dates and its real status).
 * It replaces the retired «حالة اعتماد الحساب» page (that route redirects here).
 */
@Component({
	selector: 'app-account-actions',
	standalone: true,
	imports: [DatePipe],
	templateUrl: './account-actions.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountActionsPage implements OnInit {
	private access = inject(ProviderAccessService);
	private api = inject(ProviderApiService);
	private router = inject(Router);
	private route = inject(ActivatedRoute);

	readonly loading = signal(true);
	readonly failed = signal(false);
	/** The failed check was a 429: a temporary condition, shown with neutral wording (never "not approved"). */
	readonly rateLimited = signal(false);
	readonly rateLimitText = RATE_LIMIT_CHECK_MESSAGE;
	readonly data = signal<ProviderAccessState | null>(null);
	readonly requests = signal<ApprovalRequestItem[]>([]);
	readonly logFailed = signal(false);
	/** the request opened from a link / notification (…/account-actions/:id) */
	readonly focusId = signal<string | null>(null);

	ngOnInit() {
		this.focusId.set(this.route.snapshot.paramMap.get('id'));
		this.refresh();
	}

	refresh() {
		this.loading.set(true);
		this.failed.set(false);
		this.rateLimited.set(false);
		this.logFailed.set(false);
		this.access.invalidate();
		this.access.load().subscribe({
			next: s => { this.data.set(s); this.loading.set(false); },
			error: (e) => { this.data.set(null); this.rateLimited.set(isRateLimitError(e)); this.failed.set(true); this.loading.set(false); },
		});
		// refresh always shows the server's latest decision (nothing is cached on the client)
		this.api.getAccountActions().subscribe({
			next: res => this.requests.set(Array.isArray(res?.data?.items) ? res.data.items : []),
			error: () => { this.requests.set([]); this.logFailed.set(true); },
		});
	}

	/** Backend text first; the key states fall back to the agreed wording if the backend sent none. */
	message(d: ProviderAccessState): string {
		if (d.message?.trim()) return d.message;
		if (d.state === 'SAMPLE_REQUIRED') return SAMPLE_REQUIRED_MESSAGE;
		if (d.state === 'ASSESSMENT_REQUIRED') return ASSESSMENT_REQUIRED_MESSAGE;
		if (d.state === 'PENDING_REVIEW') return PENDING_REVIEW_MESSAGE;
		if (d.state === 'COMPLETION_REQUIRED') return COMPLETION_REQUIRED_MESSAGE;
		return '';
	}

	fieldLabel(field: string): string {
		return ({ title: 'عنوان النموذج', description: 'الوصف الفني', files: 'ملفات الإثبات', technologiesUsed: 'التقنيات المستخدمة', projectUrl: 'رابط المشروع', githubUrl: 'رابط GitHub' } as Record<string, string>)[field] || field;
	}

	fieldLabelsOf(r: ApprovalRequestItem): string { return r.completionFields.map(f => this.fieldLabel(f)).join('، '); }

	goSetup() { this.router.navigateByUrl(PROVIDER_SETUP_PAGE); }
	goUploadSample() { this.router.navigateByUrl('/provider-overview/business-models/accreditation/new'); }
	goDashboard() { this.router.navigateByUrl('/provider-overview'); }
	complete(r: ApprovalRequestItem) { this.router.navigateByUrl(completionUrl(r.id)); }
}
