import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { approvalView, type RegisteredSpecialty, type SpecialtyApprovalInfo } from '../../core/utils/specialty-states';

type Row = RegisteredSpecialty & SpecialtyApprovalInfo;

/** "Where does each of my specialties stand": test, samples and the admin decision told apart, with the one next step. Never says "معتمد" without an admin approval. */
@Component({
	selector: 'ws-specialty-status',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		@if (rows().length) {
		<section class="wss" data-testid="specialty-status" aria-label="حالة تخصصاتك">
			<h3 class="wss-title">حالة تخصصاتك</h3>
			@for (r of rows(); track r.specialtyId) {
			<div class="wss-row" [attr.data-state]="r.approvalState" [attr.data-tone]="r.view.tone">
				<div class="wss-main"><strong>{{ r.name }}</strong><span class="wss-tag" data-testid="specialty-status-label">{{ r.view.label }}</span></div>
				@if (r.view.detail) { <p class="wss-detail">{{ r.view.detail }}</p> }
				@if (r.view.ctaLink) { <a class="wss-cta" [routerLink]="r.view.ctaLink">{{ r.view.ctaLabel }}</a> }
			</div>
			}
		</section>
		}
	`,
	styles: [`
		.wss{display:flex;flex-direction:column;gap:8px;margin:0 0 18px;padding:14px 16px;border-radius:16px;background:var(--crd-bg);border:1px solid var(--crd-bd)}
		.wss-title{margin:0 0 2px;font-size:13px;font-weight:900;color:var(--txt)}
		.wss-row{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:12px;border:1px solid var(--crd-bd);background:rgba(255,255,255,.03)}
		.wss-main{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--txt)}
		.wss-tag{font-size:11px;font-weight:800;padding:2px 10px;border-radius:999px;border:1px solid currentColor}
		.wss-row[data-tone="ok"] .wss-tag{color:#2ECC8A}.wss-row[data-tone="wait"] .wss-tag{color:#FFB400}.wss-row[data-tone="bad"] .wss-tag{color:#FF8C69}.wss-row[data-tone="todo"] .wss-tag{color:#2BD4C7}
		.wss-detail{margin:0;font-size:12px;line-height:1.7;color:var(--txt-2)}
		.wss-cta{align-self:flex-start;font-size:11.5px;font-weight:800;color:#2BD4C7;text-decoration:none}
	`],
})
export class SpecialtyStatusComponent {
	readonly registered = input<readonly Row[] | null | undefined>(null);
	protected readonly rows = computed(() => (this.registered() ?? []).map((r) => ({ ...r, view: approvalView(r) })));
}
