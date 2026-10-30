import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpecialtyStatusComponent } from './specialty-status.component';
import { SPECIALTIES_PAGE, type RegisteredSpecialty, type SpecialtyApprovalInfo } from '../../core/utils/specialty-states';

type Row = RegisteredSpecialty & SpecialtyApprovalInfo;

/**
 * "Add a new specialty": the clear way to a specialty that is not in the list yet. It opens the specialties page (add the specialty and take its 15-question
 * test) and, with `returnTo`, that page brings the provider back here afterwards. Below it, the registered specialties that have NOT passed yet, each with its
 * real state: not tested, failed (with "you can retake in X hours" while the cooldown runs), attempt limit reached. Passing the test is not an approval.
 */
@Component({
	selector: 'ws-add-specialty',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, SpecialtyStatusComponent],
	template: `
		<section class="wsa" data-testid="add-specialty" aria-label="إضافة تخصص جديد">
			<div class="wsa-head">
				<div>
					<h3 class="wsa-title">إضافة تخصص جديد</h3>
					<p class="wsa-text">لتخصص غير ظاهر في القائمة: أضفه من صفحة التخصصات واجتز اختباره ({{ questionCount }} سؤالًا)، فيظهر هنا لترفع له نموذج اعتماد. اجتياز الاختبار لا يعني الاعتماد، فالاعتماد بنموذج وقرار الإدارة.</p>
				</div>
				<a class="wsa-cta" [routerLink]="page" [queryParams]="returnTo() ? { returnTo: returnTo() } : null" data-testid="add-specialty-cta">إضافة تخصص جديد</a>
			</div>
			@if (pending().length) {
				<ws-specialty-status [registered]="pending()" [returnTo]="returnTo()" />
			}
		</section>
	`,
	styles: [`
		.wsa{display:flex;flex-direction:column;gap:12px;margin:18px 0;padding:16px 18px;border-radius:16px;background:var(--crd-bg);border:1px dashed rgba(43,212,199,.35)}
		.wsa-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
		.wsa-title{margin:0 0 4px;font-size:var(--font-size-label);font-weight:900;color:var(--txt)}
		.wsa-text{margin:0;max-width:640px;font-size:var(--font-size-label);line-height:1.8;color:var(--txt-2)}
		.wsa-cta{padding:11px 24px;border-radius:999px;font-size:var(--font-size-label);font-weight:800;text-decoration:none;color:#070D24;background:linear-gradient(135deg,#2BD4C7,#2B7FFF);white-space:nowrap}
	`],
})
export class AddSpecialtyComponent {
	readonly registered = input<readonly Row[] | null | undefined>(null);
	readonly returnTo = input<string | null>(null);
	protected readonly page = SPECIALTIES_PAGE;
	protected readonly questionCount = 15;
	/** Registered specialties that have not passed the test yet (the passed ones are the selectable cards above). */
	protected readonly pending = computed(() => (this.registered() ?? []).filter((r) => r.state !== 'PASSED'));
}
