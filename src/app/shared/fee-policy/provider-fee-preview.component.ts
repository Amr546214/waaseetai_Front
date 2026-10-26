import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { currencyCode, formatMoneyIn } from '../../core/utils/currency';

interface FeePreview { currency: string; price: number; level: number; ratePercent: number; commission: number; net: number; policy: { version: number }; note: string }

/**
 * Before anyone signs: what the provider keeps out of the price they type. The commission is an ESTIMATE from the provider's current level and the fee policy in force now; the rate is frozen
 * on the escrow when the client signs and funds, so the box says so. It is read from the server (the same calculation the money path uses); nothing is computed or typed here.
 */
@Component({
	selector: 'ws-provider-fee-preview',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (preview(); as p) {
			<div class="wfp" data-testid="fee-preview" role="note">
				<div class="wfp-row"><span>عمولة المنصة (المستوى {{ p.level }} · {{ p.ratePercent }}٪)</span><b>{{ fmt(p.commission, p.currency) }}</b></div>
				<div class="wfp-row"><span>صافي ما تستلمه</span><b>{{ fmt(p.net, p.currency) }}</b></div>
				<div class="wfp-note">{{ p.note }}</div>
			</div>
		} @else if (failed()) {
			<div class="wfp wfp-warn" data-testid="fee-preview-unavailable" role="note">تعذّر حساب العمولة المتوقعة الآن؛ ستظهر لك النسبة النهائية قبل التوقيع.</div>
		}`,
	styles: [`.wfp { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--border, #cbd5e1); border-radius: 10px; font-size: 13px; line-height: 1.8; } .wfp-row { display: flex; justify-content: space-between; gap: 12px; } .wfp-note { font-size: 12px; opacity: .8; margin-top: 4px; } .wfp-warn { opacity: .85; }`],
})
export class ProviderFeePreviewComponent {
	private http = inject(HttpClient);
	readonly price = input<number | null | undefined>(null);
	readonly currency = input<string | null | undefined>(null);
	readonly preview = signal<FeePreview | null>(null);
	readonly failed = signal(false);
	readonly fmt = formatMoneyIn;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		effect(() => {
			const price = Number(this.price()); const currency = currencyCode(this.currency());
			untracked(() => {
				if (this.timer) clearTimeout(this.timer);
				if (!Number.isFinite(price) || price <= 0) { this.preview.set(null); this.failed.set(false); return; }
				this.timer = setTimeout(() => {
					this.http.get<{ success: boolean; data: FeePreview }>(`${environment.url_api}/provider/finance/fee-preview`, { params: { price: String(price), currency } }).subscribe({
						next: r => { this.preview.set(r?.data ?? null); this.failed.set(!r?.data); },
						error: () => { this.preview.set(null); this.failed.set(true); },
					});
				}, 400);
			});
		});
	}
}
