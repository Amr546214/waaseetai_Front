import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderApiService, ProviderSale } from '../../../../../core/services/provider-api.service';
import { formatAmount } from '../../../../../core/utils/currency';
import { WsAmountPipe } from '../../../../../shared/money/money.pipe';

@Component({
	selector: 'app-sales-tracking',
	standalone: true,
	imports: [CommonModule, RouterModule, WsAmountPipe],
	templateUrl: './sales-tracking.component.html',
	styleUrls: ['./sales-tracking.component.css']
})
export class SalesTrackingComponent implements OnInit {
	private providerApi = inject(ProviderApiService);

	// GET /provider/finance/sales: paid marketplace orders of this provider's services (net of the coupon share). "—" until it loads.
	stats = [
		{ lbl: 'إجمالي المبيعات', val: '—', color: 'teal', ico: 'wallet' },
		{ lbl: 'هذا الشهر', val: '—', color: 'blue', ico: 'chart' },
		{ lbl: 'عدد المبيعات', val: '—', color: 'green', ico: 'check' },
		{ lbl: 'متوسط قيمة الطلب', val: '—', color: 'amber', ico: 'tag' }
	];
	topModels: { name: string; sales: number; revenue: number; pct: number }[] = [];
	sales: (ProviderSale & { currency?: string })[] = [];
	/** currency of the headline figures and of the top models (the platform base currency, from the summary) */
	summaryCurrency: string | undefined;
	loadError = false;

	ngOnInit() {
		this.providerApi.getProviderSales().subscribe({
			next: res => {
				const d = res?.data;
				if (!d) return;
				this.summaryCurrency = d.summary.currency;
				const usd = (n: number) => formatAmount(n, d.summary.currency);
				this.stats = [
					{ lbl: 'إجمالي المبيعات', val: usd(d.summary.totalRevenue), color: 'teal', ico: 'wallet' },
					{ lbl: 'هذا الشهر', val: usd(d.summary.monthRevenue), color: 'blue', ico: 'chart' },
					{ lbl: 'عدد المبيعات', val: String(d.summary.salesCount), color: 'green', ico: 'check' },
					{ lbl: 'متوسط قيمة الطلب', val: usd(d.summary.averageOrderValue), color: 'amber', ico: 'tag' }
				];
				this.topModels = d.topModels;
				this.sales = d.sales;
			},
			error: () => { this.loadError = true; }
		});
	}

	statusLabel(s: string): string {
		return s === 'completed' ? 'مكتمل' : s === 'pending' ? 'قيد المعالجة' : 'مسترد';
	}
}
