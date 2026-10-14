import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NewTicketComponent } from './new-ticket';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { NotificationHostComponent } from '../../../../../shared/forms/notification-host.component';

// Opening a ticket reports through the central UiNotificationService (rendered by <app-notification-host>), not a local toast.
describe('client new ticket: feedback flows through the central notification service', () => {
	async function submitWith(createTicket: () => unknown) {
		TestBed.configureTestingModule({
			imports: [NewTicketComponent, NotificationHostComponent],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } }, { provide: TicketApiService, useValue: { createTicket } }],
		});
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const page = TestBed.createComponent(NewTicketComponent);
		const host = TestBed.createComponent(NotificationHostComponent);
		const c = page.componentInstance;
		c.category.set('أخرى'); c.subject.set('مشكلة في الدفع'); c.description.set('لم يصلني إشعار تأكيد الدفع بعد إتمام العملية بنجاح');
		page.detectChanges(); await page.whenStable(); host.detectChanges();
		(page.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
		page.detectChanges(); host.detectChanges();
		return { page, host, service: TestBed.inject(UiNotificationService) };
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('a created ticket shows a success message in the central host, with no toast markup in the page', async () => {
		const { page, host, service } = await submitWith(() => of({ success: true, data: { id: 't1' } }));
		expect(service.toasts().map(t => [t.kind, t.message])).toEqual([['success', 'تم فتح تذكرتك بنجاح']]);
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain('تم فتح تذكرتك بنجاح');
		expect((page.nativeElement as HTMLElement).textContent).not.toContain('تم فتح تذكرتك بنجاح');
	});

	it('a server failure shows the server message as an error in the central host', async () => {
		const { host, service } = await submitWith(() => throwError(() => ({ error: { message: 'الخدمة غير متاحة مؤقتًا' } })));
		expect(service.toasts().map(t => [t.kind, t.message])).toEqual([['error', 'الخدمة غير متاحة مؤقتًا']]);
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain('الخدمة غير متاحة مؤقتًا');
	});
});
