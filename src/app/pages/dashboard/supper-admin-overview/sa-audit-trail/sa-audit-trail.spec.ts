import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { SaAuditTrail } from './sa-audit-trail';
import { AdminConsoleApiService } from '../../../../core/services/admin-console-api.service';
import { AdminAiService } from '../../../../core/services/admin-ai.service';

function setup(items: any[]) {
	const api = {
		getAdmins: vi.fn(() => of({ success: true, data: [{ id: 'a1', name: 'مدير حقيقي', email: 'x@y.z', accountType: 'ADMIN', status: 'ACTIVE', lastActiveAt: null, createdAt: '' }] })),
		getAuditLog: vi.fn(() => of({ success: true, data: { items, pagination: { page: 1, limit: 20, total: items.length, pages: 1 }, eventTypes: ['LOGIN_REJECTED'] } })),
	};
	TestBed.configureTestingModule({
		imports: [SaAuditTrail],
		providers: [provideRouter([]), { provide: AdminConsoleApiService, useValue: api }, { provide: AdminAiService, useValue: { getAnomalySummary: () => of({ result: null, failed: true }) } }],
	});
	const fixture = TestBed.createComponent(SaAuditTrail);
	fixture.detectChanges();
	return { fixture, api, c: fixture.componentInstance as any, el: fixture.nativeElement as HTMLElement };
}

describe('SaAuditTrail', () => {
	it('renders only server entries and none of the old sample data', () => {
		const { el } = setup([{ id: 'l1', eventType: 'LOGIN_REJECTED', category: 'SECURITY_CHANGE', title: 'محاولة دخول مرفوضة', summary: 'تفصيل حقيقي', severity: 'WARNING', source: 'USER', status: 'REJECTED', occurredAt: new Date().toISOString(), ipAddress: '1.2.3.4', device: null, actorLabel: null, account: { id: 'a1', name: 'مدير حقيقي', accountType: 'ADMIN' } }]);
		const text = el.textContent || '';
		expect(text).toContain('محاولة دخول مرفوضة');
		expect(text).not.toContain('هيثم القرني');
		expect(text).not.toContain('8,241');
		expect(el.querySelectorAll('[data-testid="at-row"]').length).toBe(1);
	});

	it('shows an honest empty state', () => {
		const { el } = setup([]);
		expect(el.querySelector('[data-testid="at-empty"]')).toBeTruthy();
	});

	it('filters are sent to the server and reset to page 1', () => {
		const { c, api } = setup([]);
		c.page.set(3);
		c.setFilter(c.eventTypeFilter, 'LOGIN_REJECTED');
		const last = (api.getAuditLog.mock.calls.at(-1) as any[])[0];
		expect(last).toMatchObject({ page: 1, eventType: 'LOGIN_REJECTED' });
		c.setFilter(c.actorFilter, 'a1');
		expect((api.getAuditLog.mock.calls.at(-1) as any[])[0]).toMatchObject({ actorId: 'a1', eventType: 'LOGIN_REJECTED' });
	});
});
