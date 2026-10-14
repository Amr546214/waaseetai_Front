import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PROVIDER_SETUP_PAGE } from '../profile/profile-setup/provider-setup-state';
import { ProviderAccessService, ProviderAccessState } from '../../../../core/services/provider-access.service';

export const SAMPLE_REQUIRED_MESSAGE = 'اجتزت الاختبار، لكن يجب رفع نموذج الاعتماد لإكمال المراجعة.';
export const ASSESSMENT_REQUIRED_MESSAGE = 'أكمل الاختبار لإكمال اعتماد حسابك.';
export const PENDING_REVIEW_MESSAGE = 'تم اجتياز الاختبار، ونموذج الاعتماد قيد المراجعة. ستفتح لوحة مقدم الخدمة بعد اعتماد الإدارة.';

const SAMPLE_STATUS_LABELS: Record<string, string> = {
	MANUAL_REVIEW: 'قيد المراجعة اليدوية',
	PENDING: 'قيد المراجعة',
	PENDING_REVIEW: 'قيد المراجعة',
	APPROVED: 'معتمد',
	PASSED: 'معتمد',
	REJECTED: 'مرفوض',
	FAILED: 'مرفوض',
};

/** Where an individual provider waits (or finishes) onboarding: everything shown here comes from GET /provider/access-state. */
@Component({
	selector: 'app-accreditation-status',
	standalone: true,
	templateUrl: './accreditation-status.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccreditationStatusPage implements OnInit {
	private access = inject(ProviderAccessService);
	private router = inject(Router);

	readonly loading = signal(true);
	readonly failed = signal(false);
	readonly data = signal<ProviderAccessState | null>(null);

	ngOnInit() { this.refresh(); }

	refresh() {
		this.loading.set(true);
		this.failed.set(false);
		this.access.invalidate();
		this.access.load().subscribe({
			next: s => { this.data.set(s); this.loading.set(false); },
			error: () => { this.data.set(null); this.failed.set(true); this.loading.set(false); },
		});
	}

	/** Backend text first; the two key states fall back to the agreed wording if the backend sent none. */
	message(d: ProviderAccessState): string {
		if (d.message?.trim()) return d.message;
		if (d.state === 'SAMPLE_REQUIRED') return SAMPLE_REQUIRED_MESSAGE;
		if (d.state === 'ASSESSMENT_REQUIRED') return ASSESSMENT_REQUIRED_MESSAGE;
		if (d.state === 'PENDING_REVIEW') return PENDING_REVIEW_MESSAGE;
		return '';
	}

	sampleStatusLabel(status: string | null | undefined): string {
		return (status && SAMPLE_STATUS_LABELS[status]) || 'قيد المراجعة';
	}

	goSetup() { this.router.navigateByUrl(PROVIDER_SETUP_PAGE); }
	goUploadSample() { this.router.navigateByUrl('/provider-overview/business-models/accreditation/new'); }
	goDashboard() { this.router.navigateByUrl('/provider-overview'); }
}
