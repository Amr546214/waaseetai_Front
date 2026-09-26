import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { SaSecurity } from './sa-security';
import { AdminSecurityApiService } from '../../../../../core/services/admin-security-api.service';

// Implementation Batch 7 — this page used to render 5 fully fabricated
// security events (fake brute-force/SQL-injection attempts, invented IPs)
// and fabricated KPIs (847 failed attempts, 124 blocked IPs, 24,812 audit
// logs, "Threat Score: LOW"). These tests lock in that it now reads real
// AccountAuditLog data via AdminSecurityApiService and never fabricates a
// number when the real feed is empty or unavailable.
describe('SaSecurity', () => {
	function setup(response: any) {
		const apiStub: Partial<AdminSecurityApiService> = {
			getSecurityEvents: () => of(response),
		};
		TestBed.configureTestingModule({
			imports: [SaSecurity],
			providers: [{ provide: AdminSecurityApiService, useValue: apiStub }],
		});
		const fixture = TestBed.createComponent(SaSecurity);
		fixture.detectChanges();
		return fixture;
	}

	it('has no hardcoded fictional events or blocked-IP concept on the component', () => {
		const fixture = setup({ success: true, data: { events: [], kpis: { totalEventsToday: 0, criticalOrWarningToday: 0, failedLoginAttemptsToday: 0 } } });
		const component: any = fixture.componentInstance;
		expect(component.blockedIps).toBeUndefined();
		expect(component.events()).toEqual([]);
	});

	it('renders real KPI counts, never the old hardcoded 847 / 124 / 24812', () => {
		const fixture = setup({
			success: true,
			data: { events: [], kpis: { totalEventsToday: 6, criticalOrWarningToday: 1, failedLoginAttemptsToday: 2 } },
		});
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('6');
		expect(text).toContain('2');
		expect(text).not.toContain('847');
		expect(text).not.toContain('24,812');
		expect(text).not.toContain('Threat Score');
	});

	it('renders a real event row from AccountAuditLog data, never a fake brute-force/SQL-injection entry', () => {
		const fixture = setup({
			success: true,
			data: {
				events: [{
					id: 'e1', category: 'SECURITY_CHANGE', eventType: 'LOGIN_REJECTED', title: 'محاولة تسجيل دخول مرفوضة',
					summary: 'تم رفض محاولة تسجيل دخول', severity: 'WARNING', source: 'USER', status: 'REJECTED',
					occurredAt: new Date().toISOString(), ipAddress: '10.0.0.5', device: 'Chrome', actorLabel: null,
				}],
				kpis: { totalEventsToday: 1, criticalOrWarningToday: 1, failedLoginAttemptsToday: 1 },
			},
		});
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('محاولة تسجيل دخول مرفوضة');
		expect(text).toContain('10.0.0.5');
		expect(text).not.toContain('SQL Injection');
		expect(text).not.toContain('185.220.101.47');
	});

	it('shows an empty state, not fabricated data, when the events feed is empty', () => {
		const fixture = setup({ success: true, data: { events: [], kpis: { totalEventsToday: 0, criticalOrWarningToday: 0, failedLoginAttemptsToday: 0 } } });
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لا توجد أحداث');
	});
});
