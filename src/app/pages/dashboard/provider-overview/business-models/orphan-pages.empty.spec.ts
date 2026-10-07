import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CustomerRequestsComponent } from './customer-requests/customer-requests.component';
import { SalesTrackingComponent } from './sales-tracking/sales-tracking.component';
import { NegotiationComponent } from './negotiation/negotiation.component';

// Three routed pages that no menu links to used to show fixed demo rows (company names, amounts, statuses, a whole fake chat).
// They now show an honest empty state: no invented company names, ids, amounts, counts or statuses.
const FAKE = /شركة|مؤسسة|الأفق|الإبداع|أحمد العتيبي|سارة القحطاني|محمد الزهراني|REQ-2026|S-2026|145,000|32,500|6,041|42,000|45,000/;

describe('orphan provider pages show an empty state, not demo rows', () => {
	for (const [name, cls] of [['customer-requests', CustomerRequestsComponent], ['sales-tracking', SalesTrackingComponent], ['negotiation', NegotiationComponent]] as const) {
		it(`${name}: "لا توجد بيانات بعد" and nothing invented`, async () => {
			await TestBed.configureTestingModule({ imports: [cls], providers: [provideRouter([])] }).compileComponents();
			const f = TestBed.createComponent(cls as any);
			f.detectChanges();
			const text = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
			expect(text).toContain('لا توجد بيانات بعد');
			expect(text).not.toMatch(FAKE);
			TestBed.resetTestingModule();
		});
	}

	it('customer-requests: filter counts are real (all zero), not the old 8/3/2/2/1', async () => {
		await TestBed.configureTestingModule({ imports: [CustomerRequestsComponent], providers: [provideRouter([])] }).compileComponents();
		const c = TestBed.createComponent(CustomerRequestsComponent).componentInstance;
		expect(c.filters.map(f => f.count)).toEqual([0, 0, 0, 0, 0]);
	});
});
