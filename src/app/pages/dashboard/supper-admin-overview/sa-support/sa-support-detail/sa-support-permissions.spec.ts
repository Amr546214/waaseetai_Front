import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaSupportDetail } from './sa-support-detail';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { ADMIN_ROUTE_ACCESS } from '../../../../../core/config/admin-access-rules';

// The server decides every request (support.review to read, support.reply for reply / status / priority / notes / taking a ticket, tasks.manage to hand one to somebody else).
// The page must not OFFER what the server would refuse.
const ticket = { success: true, data: { ticket: { id: 't1', ticketNumber: 'TK-1', status: 'OPEN', priority: 'عادية', subject: 's', category: 'c', description: 'd', createdAt: new Date().toISOString() }, messages: [], user: { id: 'u1', firstName: 'a', lastName: 'b' }, internalNotes: [] } };
const staff = [{ id: 'me', name: 'أنا الموظف', email: 'm@x', accountType: 'ADMIN' }, { id: 'peer', name: 'زميل', email: 'p@x', accountType: 'ADMIN' }];

function setup(perms: string[], staffList: any[] = staff) {
	const api = { adminGetTicket: vi.fn(() => of(ticket)), adminReply: vi.fn(() => of({ success: true })), adminSetStatus: vi.fn(() => of({ success: true })), adminSetPriority: vi.fn(() => of({ success: true })), adminAssign: vi.fn(() => of({ success: true })), adminAddNote: vi.fn(() => of({ success: true })), adminListTickets: () => of({ success: true, data: { items: [] } }) };
	TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
		{ provide: TicketApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: staffList }) } },
		{ provide: AdminAccessService, useValue: { can: (p: string) => perms.includes(p), access: signal({ userId: 'me' }) } },
		{ provide: ActivatedRoute, useValue: { paramMap: of(new Map([['id', 't1']]) as any) } }] });
	const f = TestBed.createComponent(SaSupportDetail); f.detectChanges();
	return { f, c: f.componentInstance as any, api, el: f.nativeElement as HTMLElement };
}
afterEach(() => TestBed.resetTestingModule());

describe('support ticket page: execute controls follow the server permissions', () => {
	it('support.review only (VIEW): sees the ticket but no status buttons, reply form, priority select, note input or assign control - and no method reaches the API', () => {
		const { c, api, el } = setup(['support.review']);
		expect(el.textContent).toContain('TK-1');
		expect(el.querySelector('.sup-ca-btn')).toBeNull();
		expect(el.querySelector('#sup-reply')).toBeNull();
		expect(el.querySelector('input[type=file]')).toBeNull();
		expect(el.querySelector('ws-select')).toBeNull();
		expect(el.querySelector('#sup-note')).toBeNull();
		expect(el.querySelector('.sup-side-btn')).toBeNull();
		expect(el.querySelector('[data-testid="reply-readonly"]')).not.toBeNull();
		expect(el.querySelector('[data-testid="priority-readonly"]')?.textContent).toContain('عادية');
		c.draftReply.set('x'); c.noteDraft.set('x'); c.selectedAssigneeId.set('me');
		c.sendReply(); c.setStatus('RESOLVED'); c.setPriority('عالية'); c.addNote(); c.assign(); c.escalate();
		for (const k of ['adminReply', 'adminSetStatus', 'adminSetPriority', 'adminAddNote', 'adminAssign']) expect((api as any)[k]).not.toHaveBeenCalled();
	});
	it('support.reply (no tasks.manage): reply, status, priority and notes appear; the assignee list holds only the member himself and no escalation', () => {
		const { c, api, el } = setup(['support.review', 'support.reply']);
		expect(el.querySelector('#sup-reply')).not.toBeNull();
		expect(el.querySelectorAll('.sup-ca-btn').length).toBe(5);
		expect(el.querySelector('#sup-note')).not.toBeNull();
		expect(c.staffOptions()).toEqual([{ value: 'me', label: 'أنا الموظف (أنا)' }]);
		expect(el.textContent).not.toContain('تصعيد التذكرة');
		c.selectedAssigneeId.set('peer'); c.assign(); expect(api.adminAssign).not.toHaveBeenCalled(); // somebody else needs tasks.manage on the server
		c.selectedAssigneeId.set('me'); c.assign(); expect(api.adminAssign).toHaveBeenCalledWith('t1', 'me');
	});
	it('a member without team.view still can take a ticket for himself (empty staff list)', () => {
		const { c } = setup(['support.review', 'support.reply'], []);
		expect(c.staffOptions()).toEqual([{ value: 'me', label: 'أنا (تكليف لنفسي)' }]);
	});
	it('support.reply + tasks.manage: the whole staff list and the escalation appear', () => {
		const { c, api } = setup(['support.review', 'support.reply', 'tasks.manage']);
		expect(c.staffOptions().map((o: any) => o.value)).toEqual(['me', 'peer']);
		expect(c.canEscalate()).toBe(true);
		c.selectedAssigneeId.set('peer'); c.assign(); expect(api.adminAssign).toHaveBeenCalledWith('t1', 'peer');
	});
	it('the route rule of the page is support.review', () => { expect(ADMIN_ROUTE_ACCESS['support']).toEqual({ all: ['support.review'] }); });
});
