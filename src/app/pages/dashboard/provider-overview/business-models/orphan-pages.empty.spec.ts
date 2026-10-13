import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SalesTrackingComponent } from './sales-tracking/sales-tracking.component';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

// The sales page shows only what GET /provider/finance/sales returns: "—" and an empty state before/without data, never demo rows.
const FAKE = /شركة|مؤسسة|الأفق|الإبداع|أحمد العتيبي|سارة القحطاني|محمد الزهراني|REQ-2026|S-2026|145,000|32,500|6,041|42,000|45,000/;

describe('provider sales-tracking page', () => {
	it('no sales: empty state, "—" figures, nothing invented', async () => {
		await TestBed.configureTestingModule({ imports: [SalesTrackingComponent], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderSales: () => of({ success: true, data: { summary: { totalRevenue: 0, monthRevenue: 0, salesCount: 0, averageOrderValue: 0, currency: 'USD' }, topModels: [], sales: [] } }) } }] }).compileComponents();
		const f = TestBed.createComponent(SalesTrackingComponent);
		f.detectChanges();
		const text = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain('لا توجد مبيعات بعد');
		expect(text).not.toMatch(FAKE);
	});

	it('shows the real figures and rows from the endpoint', async () => {
		const data = { summary: { totalRevenue: 140, monthRevenue: 90, salesCount: 2, averageOrderValue: 70, currency: 'USD' }, topModels: [{ name: 'خدمة 1', sales: 2, revenue: 140, pct: 100 }], sales: [{ id: 'a', orderNumber: 'WS-1', model: 'خدمة 1', client: 'أ ب', amount: 90, date: '2026-10-01', status: 'completed' }] };
		await TestBed.configureTestingModule({ imports: [SalesTrackingComponent], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderSales: () => of({ success: true, data }) } }] }).compileComponents();
		const f = TestBed.createComponent(SalesTrackingComponent);
		f.detectChanges();
		const text = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain('140 $');
		expect(text).toContain('WS-1');
		expect(text).toContain('خدمة 1');
	});
});
