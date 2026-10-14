import { TestBed } from '@angular/core/testing';
import { provideRouter, Route } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TicketDetailComponent } from './ticket-detail/ticket-detail';
import { AuthStore } from '../../../../core/store/auth.store';
import { TicketApiService } from '../../../../core/services/ticket-api.service';
import { ActivatedRoute } from '@angular/router';
import { CLIENT_OVERVIEW_ROUTES } from '../client.routes';

const ticket = (status: string) => ({ id: 't1', ticketNumber: 'TK-ABC', userId: 'me', subject: 'مشكلة', category: 'أخرى', priority: 'عادية', description: 'd', status, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' });
const messages = [
	{ id: 'm0', ticketId: 't1', senderId: 'me', body: 'سؤالي', createdAt: '2026-10-01T10:00:00Z', sender: { id: 'me', firstName: 'ع', lastName: 'ك', accountType: 'CLIENT_INDIVIDUAL' } },
	{ id: 'm1', ticketId: 't1', senderId: 'staff', body: 'نراجع طلبك', createdAt: '2026-10-01T11:00:00Z', sender: { id: 'staff', firstName: 'Real', lastName: 'Admin', accountType: 'ADMIN' } },
];

describe('client ticket detail', () => {
	async function mount(getTicket: any) {
		TestBed.configureTestingModule({
			imports: [TicketDetailComponent],
			providers: [
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 't1' } } } },
				{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: 'CLIENT_INDIVIDUAL' }) } },
				{ provide: TicketApiService, useValue: { getTicket } },
			],
		});
		const f = TestBed.createComponent(TicketDetailComponent);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('shows the staff reply as «فريق الدعم» (never the admin real name) and the current status', async () => {
		const { el } = await mount(vi.fn(() => of({ success: true, data: { ticket: ticket('AWAITING_CUSTOMER'), messages } })));
		const text = el.textContent || '';
		expect(text).toContain('نراجع طلبك');
		expect(text).toContain('فريق الدعم');
		expect(text).not.toContain('Real Admin');
		expect(el.querySelector('[data-testid=ticket-status]')?.textContent).toContain('بانتظار ردّك');
		expect(el.querySelector('textarea')).not.toBeNull();
	});

	it('refresh reloads and shows the new status', async () => {
		const getTicket = vi.fn()
			.mockReturnValueOnce(of({ success: true, data: { ticket: ticket('OPEN'), messages } }))
			.mockReturnValueOnce(of({ success: true, data: { ticket: ticket('RESOLVED'), messages } }));
		const { f, el } = await mount(getTicket);
		expect(el.querySelector('[data-testid=ticket-status]')?.textContent).toContain('مفتوحة');
		(el.querySelector('[data-testid=ticket-refresh]') as HTMLButtonElement).click();
		f.detectChanges();
		expect(el.querySelector('[data-testid=ticket-status]')?.textContent).toContain('محلولة');
	});

	it('a closed ticket has no reply box and says it is closed', async () => {
		const { el } = await mount(vi.fn(() => of({ success: true, data: { ticket: ticket('CLOSED'), messages } })));
		expect(el.querySelector('textarea')).toBeNull();
		expect(el.querySelector('[data-testid=ticket-closed-note]')).not.toBeNull();
	});

	it('a 403/404 shows a clear not-found-or-forbidden error with retry; a network error shows the generic one', async () => {
		const forbidden = await mount(vi.fn(() => throwError(() => ({ status: 403 }))));
		expect(forbidden.el.textContent).toContain('التذكرة غير موجودة أو لا تملك صلاحية الوصول إليها');
		expect(forbidden.el.querySelector('.retry-btn')).not.toBeNull();
		TestBed.resetTestingModule();
		const down = await mount(vi.fn(() => throwError(() => ({ status: 0 }))));
		expect(down.el.textContent).toContain('تعذّر تحميل التذكرة');
	});
});

describe('client support routes, copy and notification deep link', () => {
	const paths = CLIENT_OVERVIEW_ROUTES.map((r: Route) => r.path);
	const root = join(__dirname);

	it('the notification actionUrl for a client ticket owner resolves to a real client route', () => {
		const actionUrl = '/client-overview/help/tickets/some-ticket-id';
		const rest = actionUrl.replace('/client-overview/', '').split('/');
		const match = CLIENT_OVERVIEW_ROUTES.find((r: Route) => {
			const seg = (r.path || '').split('/');
			return seg.length === rest.length && seg.every((s, i) => s.startsWith(':') || s === rest[i]);
		});
		expect(match?.path).toBe('help/tickets/:id');
		expect(paths).toContain('help/tickets');
		expect(paths).toContain('help/tickets/new');
	});

	it('the old live-support path redirects to the tickets list instead of a dead placeholder', () => {
		const r = CLIENT_OVERVIEW_ROUTES.find((x: Route) => x.path === 'help/live-support');
		expect(r?.redirectTo).toBe('help/tickets');
	});

	it('help copy carries no live-chat promise, availability badge, SLA or licensing claim', () => {
		const html = readFileSync(join(root, 'help.html'), 'utf8') + readFileSync(join(root, 'new-ticket/new-ticket.html'), 'utf8');
		for (const bad of ['متاح الآن', 'غير متاح حاليًا', 'خلال 24', 'شات مباشر', 'دردشة فورية', 'مرخّص', 'رد أسرع', 'SAMA']) {
			expect(html.replace(/\s+/g, ' ')).not.toContain(bad);
		}
		expect(html).not.toContain('type="file"');
	});
});
