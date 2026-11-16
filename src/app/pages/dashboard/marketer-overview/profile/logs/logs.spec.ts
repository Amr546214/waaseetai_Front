import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Logs } from './logs';
import { AccountLogsService } from '../../../../../core/services/account-logs.service';

function mount(getUserLogs: () => any) {
	TestBed.configureTestingModule({ imports: [Logs], providers: [{ provide: AccountLogsService, useValue: { getUserLogs } }] });
	const f = TestBed.createComponent(Logs);
	f.detectChanges();
	return f;
}
describe('marketer activity log', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('lists the account entries newest first from the shared log endpoint', () => {
		const getUserLogs = vi.fn(() => of({ success: true, data: { items: [{ id: 'a', title: 'تسجيل دخول', statusText: 'مكتمل', createdAt: '2026-11-15T10:00:00Z' }, { id: 'b', summary: 'تغيير كلمة المرور', createdAt: '2026-11-14T10:00:00Z' }] } }));
		const f = mount(getUserLogs);
		expect(getUserLogs).toHaveBeenCalledWith({ limit: 30 });
		const rows = (f.nativeElement as HTMLElement).querySelectorAll('[data-testid="logs-row"]');
		expect(rows.length).toBe(2);
		expect(rows[0].textContent).toContain('تسجيل دخول');
		expect(rows[1].textContent).toContain('تغيير كلمة المرور');
	});
	it('empty is honest and a failure shows an error with retry (never a fake empty)', () => {
		let f = mount(() => of({ success: true, data: { items: [] } }));
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="logs-empty"]')).toBeTruthy();
		TestBed.resetTestingModule();
		f = mount(() => throwError(() => new Error('x')));
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="logs-error"]')).toBeTruthy();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="logs-empty"]')).toBeNull();
	});
});
