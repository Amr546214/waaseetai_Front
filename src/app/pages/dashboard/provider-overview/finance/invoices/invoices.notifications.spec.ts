import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InvoicesComponent } from './invoices';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { NotificationHostComponent } from '../../../../../shared/forms/notification-host.component';

const invoice = {
	id: 'i1', sourceId: 's1', projectId: 'p1', clientName: 'عميل', projectTitle: 'مشروع', stageTitle: 'مرحلة', project: 'مشروع · مرحلة', date: '2026-05-01T00:00:00Z',
	stageValue: 100, platformCommission: 10, commissionRatePercent: 10, commissionEstimated: false, net: 90, total: 100, tax: 0, status: 'paid' as const, paymentDate: null, currency: 'USD',
};

// The invoices page keeps no toast of its own: its feedback (if any) goes through the central UiNotificationService and its host.
describe('provider invoices: no local toast, feedback flows through the central notification service', () => {
	async function mount(getProviderInvoices: () => unknown) {
		TestBed.configureTestingModule({
			imports: [InvoicesComponent, NotificationHostComponent],
			providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderInvoices } }],
		});
		const page = TestBed.createComponent(InvoicesComponent);
		const host = TestBed.createComponent(NotificationHostComponent);
		page.detectChanges(); await page.whenStable(); page.detectChanges(); host.detectChanges();
		return { page, host, service: TestBed.inject(UiNotificationService) };
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('the page has no toast state or markup, and a central message shows only in the host, never inside the page', async () => {
		const { page, host, service } = await mount(() => of({ success: true, data: { summary: { totalCount: 1, paidCount: 1, dueCount: 0, paidNetTotal: 90, dueNetTotal: 0, platformCommissionTotal: 10, currency: 'USD' }, invoices: [invoice] } }));
		const el = page.nativeElement as HTMLElement;
		expect('toast' in page.componentInstance).toBe(false);
		expect('showToast' in page.componentInstance).toBe(false);
		expect(el.querySelector('.inv-toast')).toBeNull();
		service.success('رسالة اختبار مركزية');
		page.detectChanges(); host.detectChanges();
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain('رسالة اختبار مركزية');
		expect(el.textContent).not.toContain('رسالة اختبار مركزية');
	});

	it('downloading an invoice opens the print dialog and does not raise a local toast', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
		const { page, host, service } = await mount(() => of({ success: true, data: { summary: { totalCount: 1, paidCount: 1, dueCount: 0, paidNetTotal: 90, dueNetTotal: 0, platformCommissionTotal: 10, currency: 'USD' }, invoices: [invoice] } }));
		(page.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.inv-dl')!.click();
		page.detectChanges(); host.detectChanges();
		expect(print).toHaveBeenCalledTimes(1);
		expect((page.nativeElement as HTMLElement).querySelector('.inv-toast')).toBeNull();
		expect(service.toasts()).toEqual([]);
	});

	it('a failed load keeps the inline error state with retry (not a toast)', async () => {
		const { page, service } = await mount(() => throwError(() => new Error('500')));
		const el = page.nativeElement as HTMLElement;
		expect(el.querySelector('.error-card')?.textContent).toContain('تعذّر تحميل الفواتير');
		expect(el.querySelector('.retry-btn')).not.toBeNull();
		expect(service.toasts()).toEqual([]);
	});
});
