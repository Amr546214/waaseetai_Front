import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, BehaviorSubject, Subject, throwError } from 'rxjs';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
import { TicketApiService } from '../../../../core/services/ticket-api.service';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
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
		expect(api.adminListTickets).toHaveBeenLastCalledWith({ status: 'RESOLVED', q: undefined, page: 1 });
	});

	it('detail: reply and status change call the admin endpoints and reload', async () => {
		const detail = { success: true, data: { ticket, user, messages: [{ id: 'm1', ticketId: 't1', senderId: 'u1', body: 'original', createdAt: '2026-10-01T00:00:00Z', sender: { id: 'u1', firstName: 'م', lastName: 'ق', accountType: 'PROVIDER_INDIVIDUAL' } }, { id: 'm2', ticketId: 't1', senderId: 'a', body: 'رد الدعم', createdAt: '2026-10-02T00:00:00Z', sender: { id: 'a', firstName: 'A', lastName: 'B', accountType: 'ADMIN' } }] } };
		const api = {
			adminGetTicket: vi.fn(() => of(detail)),
			adminListTickets: vi.fn(() => of({ success: true, data: { items: [], counts: {}, pagination: {} } })),
			adminReply: vi.fn(() => of({ success: true, data: {} })),
			adminSetStatus: vi.fn(() => of({ success: true, data: {} })),
		};
		TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } }, { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 't1' })) } }] });
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

	it('list shows assignee, priority and uses server pagination', () => {
		const api = { adminListTickets: vi.fn(() => of({ success: true, data: { items: [{ ...ticket, priority: 'عاجلة', assignedTo: { id: 's1', name: 'سارة' }, user }], counts: { OPEN: 1 }, pagination: { page: 1, limit: 20, total: 45, pages: 3 } } })) };
		TestBed.configureTestingModule({ imports: [SaSupport], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }] });
		const f = TestBed.createComponent(SaSupport);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.textContent).toContain('عاجلة');
		expect(el.textContent).toContain('سارة');
		expect(f.componentInstance.totalPages()).toBe(3);
		f.componentInstance.goToPage(2);
		expect(api.adminListTickets).toHaveBeenLastCalledWith({ status: undefined, q: undefined, page: 2 });
	});

	describe('detail operations', () => {
		function setup() {
			const detail = { success: true, data: { ticket, user, messages: [], assignedTo: { id: 's1', name: 'سارة' }, internalNotes: [{ id: 'n1', body: 'ملاحظة سرية', createdAt: '2026-10-02T00:00:00Z', admin: { id: 's1', name: 'سارة' } }] } };
			const ok = () => of({ success: true, data: {} });
			const api = {
				adminGetTicket: vi.fn(() => of(detail)),
				adminListTickets: vi.fn(() => of({ success: true, data: { items: [], counts: {}, pagination: {} } })),
				adminAssign: vi.fn(ok), adminSetPriority: vi.fn(ok), adminAddNote: vi.fn(ok),
			};
			TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [{ id: 's2', name: 'خالد', email: 'k@x', accountType: 'ADMIN' }] }) } }, { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 't1' })) } }] });
			const f = TestBed.createComponent(SaSupportDetail);
			f.detectChanges();
			return { f, api };
		}

		it('assign, priority and internal note call the right API methods', () => {
			const { f, api } = setup();
			const c = f.componentInstance;
			c.selectedAssigneeId.set('s2');
			c.assign();
			expect(api.adminAssign).toHaveBeenCalledWith('t1', 's2');
			c.setPriority('عالية');
			expect(api.adminSetPriority).toHaveBeenCalledWith('t1', 'عالية');
			c.noteDraft.set('  تحقق من الدفع ');
			c.addNote();
			expect(api.adminAddNote).toHaveBeenCalledWith('t1', 'تحقق من الدفع');
			expect(c.noteDraft()).toBe('');
		});

		it('renders note label, notes, assignee and disabled controls with reasons', () => {
			const { f } = setup();
			const el = f.nativeElement as HTMLElement;
			expect(el.textContent).toContain('ملاحظات داخلية — لا تراها صاحب التذكرة');
			expect(el.textContent).toContain('ملاحظة سرية');
			expect(el.textContent).toContain('سارة');
			expect(el.textContent).toContain('ردك يظهر لصاحب التذكرة');
			const attach = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('إرفاق ملف')) as HTMLButtonElement;
			expect(attach.disabled).toBe(true);
			expect(attach.title).toBe('المرفقات غير مدعومة في تذاكر الدعم حالياً');
			const esc = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'تصعيد') as HTMLButtonElement;
			expect(esc.disabled).toBe(true);
			expect(el.textContent).toContain('يتطلب جدولاً لقياس زمن الاستجابة');
		});
	});
});

describe('SaSupportDetail form validation UX', () => {
	afterEach(() => TestBed.resetTestingModule());
	function setup() {
		const detail = { success: true, data: { ticket, user, messages: [], assignedTo: null, internalNotes: [] } };
		const api: any = {
			adminGetTicket: vi.fn(() => of(detail)),
			adminListTickets: vi.fn(() => of({ success: true, data: { items: [], counts: {}, pagination: {} } })),
			adminReply: vi.fn(() => of({ success: true, data: {} })), adminAssign: vi.fn(() => of({ success: true })), adminAddNote: vi.fn(() => of({ success: true })),
			adminSetPriority: vi.fn(() => of({ success: true })), adminSetStatus: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [{ id: 's2', name: 'خالد', email: 'k@x', accountType: 'ADMIN' }] }) } }, { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 't1' })) } }] });
		const f = TestBed.createComponent(SaSupportDetail);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, api, el, byId: (id: string) => el.querySelector('#' + id) as HTMLElement };
	}

	it('empty reply / note / assignee: a message under each control, focus, no request', async () => {
		const { f, c, api, byId, el } = setup();
		c.sendReply(); await settleForm();
		expectFieldProblem(byId('sup-reply'), 'اكتب نص الرد');
		expectFocused(byId('sup-reply'));
		c.addNote(); await settleForm();
		expectFieldProblem(byId('sup-note'), 'ملاحظة');
		c.assign(); await settleForm(); f.detectChanges();
		expectFieldProblem(el.querySelector('ws-select[id="sup-assignee"] button, #sup-assignee-trigger'), 'اختر الموظف');
		expect(api.adminReply).not.toHaveBeenCalled(); expect(api.adminAddNote).not.toHaveBeenCalled(); expect(api.adminAssign).not.toHaveBeenCalled();
	});

	it('reply: 400 naming the body goes under the box; 429 / 500 / 409 / 403 stay a generic alert; typed text is kept', async () => {
		const { f, c, api, byId, el } = setup();
		c.draftReply.set('نص الرد');
		api.adminReply.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'body', message: 'الرد طويل جدًا' }] })));
		c.sendReply(); await settleForm(); f.detectChanges();
		expectFieldProblem(byId('sup-reply'), 'طويل جدًا');
		for (const st of [429, 500, 409, 403, 0]) {
			api.adminReply.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
			c.sendReply(); await settleForm(); f.detectChanges();
			expect(c.replyError(), String(st)).toBeTruthy();
			expectNoFieldProblem(el);
			expect(el.querySelector('[data-testid="reply-error"]')?.getAttribute('role')).toBe('alert');
		}
		expect(c.draftReply()).toBe('نص الرد');
	});

	it('a double click on send sends one reply request', () => {
		const { c, api } = setup();
		c.draftReply.set('نص الرد');
		api.adminReply.mockReturnValue(new Subject());
		c.sendReply(); c.sendReply();
		expect(api.adminReply).toHaveBeenCalledTimes(1);
	});

	it('status change failure shows an honest banner, not a toast only', async () => {
		const { f, c, api, el } = setup();
		api.adminSetStatus.mockReturnValueOnce(throwError(() => httpFail(500, null)));
		c.setStatus('RESOLVED'); await settleForm(); f.detectChanges();
		expect(el.querySelector('[data-testid="action-error"]')?.textContent).toContain('الخادم');
	});
});
