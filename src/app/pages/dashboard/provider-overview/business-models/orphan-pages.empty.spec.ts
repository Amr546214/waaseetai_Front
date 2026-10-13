import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SalesTrackingComponent } from './sales-tracking/sales-tracking.component';

// The fake placeholder pages (service-edit: fake form + fake "saved", customer-requests: empty list with dead accept/reject, business-models/negotiation: local fake accept) are DELETED, with their routes.
// The one remaining unlinked page (sales-tracking) shows an honest empty state: nothing invented.
const FAKE = /شركة|مؤسسة|الأفق|الإبداع|أحمد العتيبي|سارة القحطاني|محمد الزهراني|REQ-2026|S-2026|145,000|32,500|6,041|42,000|45,000/;

describe('provider placeholder pages', () => {
	it('sales-tracking: "لا توجد بيانات بعد" and nothing invented', async () => {
		await TestBed.configureTestingModule({ imports: [SalesTrackingComponent], providers: [provideRouter([])] }).compileComponents();
		const f = TestBed.createComponent(SalesTrackingComponent);
		f.detectChanges();
		const text = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain('لا توجد بيانات بعد');
		expect(text).not.toMatch(FAKE);
		TestBed.resetTestingModule();
	});

	it('the three deleted placeholder pages have no route and no source folder', () => {
		const routes = readFileSync(join(__dirname, '..', 'provider.routes.ts'), 'utf8');
		for (const gone of ['business-models/service-edit', 'business-models/customer-requests', 'business-models/negotiation', 'service-edit.component', 'customer-requests.component', 'negotiation.component']) expect(routes, gone).not.toContain(gone);
		for (const dir of ['service-edit', 'customer-requests', 'negotiation']) expect(() => readFileSync(join(__dirname, dir, `${dir}.component.ts`), 'utf8')).toThrow();
	});

	it('nothing in the provider app links to the deleted pages', () => {
		const sidebar = readFileSync(join(__dirname, '..', '..', '..', '..', 'sheards', 'dashboard', 'sidebar', 'sidebar.ts'), 'utf8');
		for (const gone of ['business-models/service-edit', 'business-models/customer-requests', 'business-models/negotiation']) expect(sidebar, gone).not.toContain(gone);
	});
});
