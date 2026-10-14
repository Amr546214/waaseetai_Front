import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MarketerTicketDetail } from './ticket-detail';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

const ticket = (status = 'AWAITING_CUSTOMER') => ({ id: 't1', ticketNumber: 'TK-ABC', userId: 'me', subject: 'سؤال عن السحب', category: 'استفسار وسيط تسويقي', priority: 'عادية', description: 'x', status, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' });
const messages = [
	{ id: 'm0', ticketId: 't1', senderId: 'me', body: 'لم يصلني التحويل', createdAt: '2026-10-01T10:00:00Z', sender: { id: 'me', firstName: 'ليلى', lastName: 'م', accountType: 'MARKETING_BROKER' } },
	{ id: 'm1', ticketId: 't1', senderId: 'staff', body: 'نراجع طلبك الآن', createdAt: '2026-10-02T10:00:00Z', sender: { id: 'staff', firstName: 'س', lastName: 'ع', accountType: 'ADMIN' } },
];

describe('marketer ticket detail', () => {
	let fixture: ComponentFixture<MarketerTicketDetail>;
	let api: any;
	const el = () => fixture.nativeElement as HTMLElement;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	async function mount(getTicket: any, id = 't1') {
		api = { getTicket: vi.fn(() => getTicket), replyToTicket: vi.fn(() => of({ success: true })), closeTicket: vi.fn(() => of({ success: true })) };
		await TestBed.configureTestingModule({ imports: [MarketerTicketDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => ({ id: 'me' }) } }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } }] }).compileComponents();
		fixture = TestBed.createComponent(MarketerTicketDetail);
		fixture.detectChanges(); render();
	}
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('loads through the marketer ticket route and shows the real thread: the marketer as "أنت", the admin reply as "فريق الدعم"', async () => {
		await mount(of({ success: true, data: { ticket: ticket(), messages } }));
		expect(api.getTicket).toHaveBeenCalledWith('marketer', 't1');
		const msgs = Array.from(el().querySelectorAll('[data-testid="ticket-message"]'));
		expect(msgs.length).toBe(2);
		expect(msgs[0].textContent).toContain('أنت');
		expect(msgs[1].textContent).toContain('فريق الدعم');
		expect(msgs[1].textContent).toContain('نراجع طلبك الآن');
		expect(el().querySelector('[data-testid="ticket-status"]')!.textContent).toContain('بانتظار ردّك');
	});

	it('reply is sent through the marketer route then the thread reloads', async () => {
		await mount(of({ success: true, data: { ticket: ticket(), messages } }));
		fixture.componentInstance.replyText.set('هل من جديد؟');
		fixture.componentInstance.send();
		expect(api.replyToTicket).toHaveBeenCalledWith('marketer', 't1', 'هل من جديد؟');
		expect(api.getTicket).toHaveBeenCalledTimes(2);
		expect(fixture.componentInstance.replyText()).toBe('');
	});

	it('close goes through the marketer route; a closed ticket shows the note and no reply box', async () => {
		await mount(of({ success: true, data: { ticket: ticket(), messages } }));
		fixture.componentInstance.close();
		expect(api.closeTicket).toHaveBeenCalledWith('marketer', 't1');
		TestBed.resetTestingModule();
		await mount(of({ success: true, data: { ticket: ticket('CLOSED'), messages } }));
		expect(el().querySelector('[data-testid="ticket-closed-note"]')).not.toBeNull();
		expect(el().querySelector('[data-testid="ticket-send"]')).toBeNull();
	});

	it('someone else\'s or a missing ticket (server 404) = "التذكرة غير موجودة"; other failures = an error with retry', async () => {
		await mount(throwError(() => ({ status: 404 })));
		expect(el().querySelector('[data-testid="ticket-not-found"]')).not.toBeNull();
		TestBed.resetTestingModule();
		await mount(throwError(() => ({ status: 500 })));
		expect(el().querySelector('[data-testid="ticket-error"]')).not.toBeNull();
	});

	it('no live-support or response-time promise on the page', async () => {
		await mount(of({ success: true, data: { ticket: ticket(), messages } }));
		expect(el().textContent).not.toMatch(/خلال \d+ ساعة|دعم مباشر|متصل الآن/);
	});
});
