import { Component, input } from '@angular/core';
import { IdentityGateState } from '../../core/services/identity-gate.service';

/** In-place status of the identity review inside the identity step (client and provider wizards). Owner-facing: never a field-match result. */
@Component({
	selector: 'ws-identity-gate-status',
	standalone: true,
	template: `
		@switch (state()?.status) {
			@case ('UNDER_REVIEW') {
				<div role="status" data-testid="identity-gate-under-review" class="ws-igs ws-igs--wait">
					<strong>الوثيقة قيد المراجعة</strong>
					<span>سيفتح الخطوة التالية بعد اعتماد الوثيقة والبيانات من الإدارة. ابقَ في هذه الصفحة، وتتحدّث الحالة تلقائيًا. إن غيّرت الصورة أو البيانات تبدأ المراجعة من جديد.</span>
				</div>
			}
			@case ('REJECTED') {
				<div role="alert" data-testid="identity-gate-rejected" class="ws-igs ws-igs--bad">
					<strong>رُفضت الوثيقة</strong>
					<span data-testid="identity-gate-reason">السبب: {{ state()?.rejectionReason || 'لم تستوفِ الوثيقة متطلبات التحقق' }}</span>
					<span>صحّح البيانات أو ارفع صورة جديدة؛ بياناتك محفوظة ولن تُمسح.</span>
				</div>
			}
			@case ('APPROVED') {
				<div role="status" data-testid="identity-gate-approved" class="ws-igs ws-igs--ok">
					<strong>تم اعتماد الوثيقة</strong>
					<span>يمكنك المتابعة إلى الخطوة التالية. تغيير الصورة أو بيانات الهوية يلغي الاعتماد ويعيد المراجعة.</span>
				</div>
			}
			@case ('NOT_SUBMITTED') {
				<div role="status" data-testid="identity-gate-not-submitted" class="ws-igs ws-igs--idle">
					<strong>وثيقة الهوية مطلوبة قبل المتابعة</strong>
					<span>ارفع الصورة وأكمل بيانات الهوية لتبدأ المراجعة@if (state()?.missing?.length) { (الناقص: {{ missingLabels() }}) }.</span>
				</div>
			}
		}
	`,
	styles: [`
		.ws-igs { display: flex; flex-direction: column; gap: 4px; border-radius: 12px; border: 1px solid; padding: 12px; margin-bottom: 20px; font-size: var(--font-size-small, 13px); font-weight: 700; line-height: 1.7; }
		.ws-igs--wait { background: #fffbeb; border-color: #fde68a; color: #92400e; }
		.ws-igs--bad { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
		.ws-igs--ok { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
		.ws-igs--idle { background: #f1f5f9; border-color: #cbd5e1; color: #334155; }
		:host-context(.dark) .ws-igs--wait, :host-context([data-theme='dark']) .ws-igs--wait { background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.3); color: #fde68a; }
		:host-context(.dark) .ws-igs--bad, :host-context([data-theme='dark']) .ws-igs--bad { background: rgba(239,68,68,.1); border-color: rgba(239,68,68,.35); color: #fecaca; }
		:host-context(.dark) .ws-igs--ok, :host-context([data-theme='dark']) .ws-igs--ok { background: rgba(16,185,129,.1); border-color: rgba(16,185,129,.35); color: #a7f3d0; }
		:host-context(.dark) .ws-igs--idle, :host-context([data-theme='dark']) .ws-igs--idle { background: rgba(148,163,184,.1); border-color: rgba(148,163,184,.3); color: #e2e8f0; }
	`],
})
export class IdentityGateStatusComponent {
	readonly state = input<IdentityGateState | null>(null);

	private static readonly LABELS: Record<string, string> = { idDocumentType: 'نوع الوثيقة', idIssuingCountry: 'دولة الإصدار', idNumber: 'رقم الوثيقة', frontId: 'الصورة الأمامية', backId: 'الصورة الخلفية' };
	missingLabels(): string {
		return (this.state()?.missing ?? []).map(k => IdentityGateStatusComponent.LABELS[k] ?? k).join('، ');
	}
}
