import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SettlementDistribution } from '../../core/models/rating.model';

/**
 * How a project closed by a dispute settlement was really settled: refund to the client, gross release to the provider, the platform commission and the provider's net.
 * It replaces any "completed successfully / the whole amount released" claim for such a project, and shows only what the settlement record holds.
 */
@Component({
	selector: 'app-settlement-summary',
	standalone: true,
	imports: [CommonModule, DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
<div class="ss" dir="rtl" data-testid="settlement-summary" role="region" aria-label="توزيع التسوية">
	<div class="ss-ttl">أُغلق بتسوية نزاع</div>
	@if (distribution(); as d) {
		<ul class="ss-list">
			<li data-testid="ss-refund">استُرد للعميل: <b>{{ d.refundToClient | number: '1.2-2' }} $</b></li>
			<li data-testid="ss-release">أُفرج لمقدّم الخدمة (إجمالي): <b>{{ d.releaseToProvider | number: '1.2-2' }} $</b></li>
			@if (d.releaseToProvider > 0) {
				<li data-testid="ss-commission">عمولة المنصة على المُفرَج: <b>{{ d.platformCommission | number: '1.2-2' }} $</b> · صافي المقدّم: <b>{{ d.providerNet | number: '1.2-2' }} $</b></li>
			}
		</ul>
	} @else {
		<p class="ss-txt" data-testid="ss-no-distribution">تعذّر قراءة تفاصيل التوزيع. راجع صفحة النزاعات.</p>
	}
</div>`,
	styles: [`
:host{display:block}
.ss{background:rgba(217,138,11,.08);border:1px solid rgba(217,138,11,.28);border-radius:14px;padding:14px 16px;margin-bottom:16px}
.ss-ttl{font-size:14px;font-weight:800;margin-bottom:8px}
.ss-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.ss-txt{font-size:13px;margin:0}
`]
})
export class SettlementSummary {
	readonly distribution = input<SettlementDistribution | null>(null);
}
