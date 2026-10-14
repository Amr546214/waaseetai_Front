import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { InvoicesComponent } from './provider-overview/finance/invoices/invoices';
import { AccreditationStatusPage } from './provider-overview/accreditation-status/accreditation-status';
import { ProviderApiService } from '../../core/services/provider-api.service';
import { ProviderAccessService } from '../../core/services/provider-access.service';

const rl = () => new HttpErrorResponse({ status: 429, error: { message: 'طلبات كثيرة' } });
const inv = { success: true, data: { invoices: [{ id: 'i1', status: 'paid', date: '2026-01-01T00:00:00Z', paymentDate: '2026-01-02T00:00:00Z', net: 1, total: 1, stageValue: 1, platformCommission: 0, tax: 0, currency: 'USD' }], summary: { totalCount: 1, paidCount: 1, dueCount: 0, paidNetTotal: 1, dueNetTotal: 0, platformCommissionTotal: 0, currency: 'USD' } } };

describe('list pages on 429 (provider invoices)', () => {
	function mount(first: any) {
		const get = vi.fn().mockReturnValueOnce(first);
		TestBed.configureTestingModule({ imports: [InvoicesComponent], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderInvoices: get } }] });
		const f = TestBed.createComponent(InvoicesComponent);
		f.detectChanges();
		return { f, c: f.componentInstance, get };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('keeps loaded invoices when a later reload is rate limited (no empty list, no error screen)', () => {
		const { c, get } = mount(of(inv));
		expect(c.invoices().length).toBe(1);
		get.mockReturnValueOnce(throwError(rl));
		c.loadInvoices();
		expect(c.invoices().length).toBe(1);
		expect(c.hasError()).toBe(false);
		expect(c.isLoading()).toBe(false);
	});
	it('first load rate limited: error state with retry (hasError), never an empty/zero list shown as data', () => {
		const { c, f } = mount(throwError(rl));
		expect(c.hasError()).toBe(true);
		expect((f.nativeElement as HTMLElement).querySelector('.retry-btn')).toBeTruthy();
	});
	it('other errors keep the previous behaviour (list cleared + error state)', () => {
		const { c, get } = mount(of(inv));
		get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
		c.loadInvoices();
		expect(c.invoices().length).toBe(0);
		expect(c.hasError()).toBe(true);
	});
});

describe('accreditation status page on 429', () => {
	it('shows the neutral temporary text with a retry button, never the "not approved" wording', () => {
		TestBed.configureTestingModule({ imports: [AccreditationStatusPage], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: { load: () => throwError(rl), invalidate: vi.fn() } }] });
		const f = TestBed.createComponent(AccreditationStatusPage);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="status-rate-limited"]')!.textContent).toContain('تعذّر التحقق مؤقتًا');
		expect(el.querySelector('[data-testid="status-retry"]')).toBeTruthy();
		expect(el.textContent).not.toContain('لا تُفتح');
		TestBed.resetTestingModule();
	});
});

describe('static: covered pages never turn an error into empty data without the 429-aware helper', () => {
	const COVERED = [
		'provider-overview/provider-overview/provider-overview.ts', 'provider-overview/offers/offers.ts', 'provider-overview/projects/active/active.ts',
		'provider-overview/projects/archived/archived.ts', 'provider-overview/finance/wallet/wallet.ts', 'provider-overview/finance/invoices/invoices.ts',
		'clients-overview/finance/wallet/wallet.ts', 'clients-overview/project/archived-projects/archived-projects.ts', 'clients-overview/notifications/notifications-center/notifications-center.ts',
		'marketer-overview/marketing-broker-overview/marketing-broker-overview.ts', 'marketer-overview/referrals/referrals.ts', 'marketer-overview/commissions/commissions.ts',
		'marketer-overview/ref-links/ref-links.ts', 'marketer-overview/assets/assets.ts',
	];
	it('every covered loader uses handleLoadError and has no bare `error: () => ... .set([])`', () => {
		const root = `${process.cwd()}/src/app/pages/dashboard/`;
		for (const rel of COVERED) {
			const src = readFileSync(root + rel, 'utf8');
			expect(src, rel).toContain('handleLoadError');
			expect(/error:\s*\(\)\s*=>\s*\{?[^\n]*\.set\(\[\]\)/.test(src), rel).toBe(false);
		}
	});
});
