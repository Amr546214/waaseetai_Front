import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { TicketApiService } from '../../../../core/services/ticket-api.service';
import { SaSupport } from './sa-support';
import { SaSupportDetail } from './sa-support-detail/sa-support-detail';

const ticket: any = { id: 't1', ticketNumber: 'TK-1', userId: 'u1', subject: 'مشكلة في التحويل', category: 'مالية', priority: 'عادية', description: 'وصف طويل للمشكلة هنا', status: 'OPEN', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const user = { id: 'u1', firstName: 'م', lastName: 'ق', email: 'p@x', accountType: 'PROVIDER_INDIVIDUAL' };

describe('SaSupport (admin tickets, real API)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('list renders API tickets and counts (no mock data)', async () => {
		const api = { adminListTickets: vi.fn(() => of({ success: true, data: { items: [{ ...ticket, user }], counts: { OPEN: 1, RESOLVED: 2 }, pagination: { page: 1, limit: 50, total: 3, pages: 1 } } })) };
		TestBed.configureTestingModule({ imports: [SaSupport], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }] });
		const f = TestBed.createComponent(SaSupport);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(api.adminListTickets).toHaveBeenCalled();
		expect(el.textContent).toContain('TK-1');
		expect(el.textContent).toContain('مشكلة في التحويل');
		expect(f.componentInstance.countFor('all')).toBe(3);
		expect(f.componentInstance.countFor('RESOLVED')).toBe(2);
		f.componentInstance.setFilter('RESOLVED');
		expect(api.adminListTickets).toHaveBeenLastCalledWith({ status: 'RESOLVED', q: undefined });
	});

	it('detail: reply and status change call the admin endpoints and reload', async () => {
		const detail = { success: true, data: { ticket, user, messages: [{ id: 'm1', ticketId: 't1', senderId: 'u1', body: 'original', createdAt: '2026-10-01T00:00:00Z', sender: { id: 'u1', firstName: 'م', lastName: 'ق', accountType: 'PROVIDER_INDIVIDUAL' } }, { id: 'm2', ticketId: 't1', senderId: 'a', body: 'رد الدعم', createdAt: '2026-10-02T00:00:00Z', sender: { id: 'a', firstName: 'A', lastName: 'B', accountType: 'ADMIN' } }] } };
		const api = {
			adminGetTicket: vi.fn(() => of(detail)),
			adminReply: vi.fn(() => of({ success: true, data: {} })),
			adminSetStatus: vi.fn(() => of({ success: true, data: {} })),
		};
		TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 't1' })) } }] });
		const f = TestBed.createComponent(SaSupportDetail);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.textContent).toContain('رد الدعم');
		expect(el.textContent).toContain('فريق الدعم');
		f.componentInstance.draftReply.set('مرحبا');
		f.componentInstance.sendReply();
		expect(api.adminReply).toHaveBeenCalledWith('t1', 'مرحبا');
		f.componentInstance.setStatus('RESOLVED');
		expect(api.adminSetStatus).toHaveBeenCalledWith('t1', 'RESOLVED');
		expect(api.adminGetTicket).toHaveBeenCalledTimes(3);
	});
});
