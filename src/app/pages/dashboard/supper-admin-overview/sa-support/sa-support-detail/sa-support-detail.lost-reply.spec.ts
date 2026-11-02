import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { SaSupportDetail } from './sa-support-detail';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const ticket = (messages: any[]) => ({ success: true, data: { ticket: { id: 't1', ticketNumber: 'TK-1', status: 'OPEN', priority: 'عادية', subject: 's', category: 'c', description: 'd', createdAt: new Date().toISOString() }, messages, user: { id: 'u1', firstName: 'a', lastName: 'b' }, internalNotes: [] } });
const staffMsg = (body: string, ageMs = 1000) => ({ id: 'm' + body, body, createdAt: new Date(Date.now() - ageMs).toISOString(), sender: { accountType: 'ADMIN', firstName: 'x', lastName: 'y' } });

function setup(getTicket: any, reply: any) {
	const notify = { success: vi.fn(), error: vi.fn() };
	const api = { adminGetTicket: vi.fn(getTicket), adminReply: vi.fn(reply), adminListTickets: () => of({ success: true, data: { items: [] } }) };
	TestBed.configureTestingModule({
		imports: [SaSupportDetail],
		providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } }, { provide: UiNotificationService, useValue: notify },
			{ provide: ActivatedRoute, useValue: { paramMap: of(new Map([['id', 't1']]) as any) } }],
	});
	const f = TestBed.createComponent(SaSupportDetail); f.detectChanges();
	const c: any = f.componentInstance; c.draftReply.set('نص الرد');
	return { f, c, api, notify };
}

// A lost answer must not let the admin send the same reply twice, and must not wipe a reply that did not arrive.
describe('support detail: reply whose answer was lost', () => {
	it('the reply DID arrive: the ticket is re-read, the draft is cleared, no second send is made', () => {
		let calls = 0;
		const { c, api, notify } = setup(() => of(calls++ === 0 ? ticket([]) : ticket([staffMsg('نص الرد')])), () => throwError(() => ({ status: 0 })));
		c.sendReply();
		expect(api.adminReply).toHaveBeenCalledTimes(1);
		expect(c.draftReply()).toBe('');
		expect(notify.success).toHaveBeenCalled();
		expect(c.busy()).toBe(false);
	});
	it('the reply did NOT arrive: the draft stays and the admin is told it can be sent again', () => {
		const { c } = setup(() => of(ticket([])), () => throwError(() => ({ status: 0 })));
		c.sendReply();
		expect(c.draftReply()).toBe('نص الرد');
		expect(c.replyError()).toContain('لم يصل الرد');
	});
	it('a clean refusal (400) does not trigger the check and keeps the draft', () => {
		const { c, api } = setup(() => of(ticket([])), () => throwError(() => ({ status: 400, error: { message: 'أدخل نص الرد' } })));
		const before = api.adminGetTicket.mock.calls.length;
		c.sendReply();
		expect(api.adminGetTicket.mock.calls.length).toBe(before);
		expect(c.draftReply()).toBe('نص الرد');
	});
});
