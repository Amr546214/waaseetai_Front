import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SaRoles } from './sa-roles';
import { AdminConsoleApiService } from '../../../../core/services/admin-console-api.service';

describe('SaRoles', () => {
	function setup() {
		const admins = [
			{ id: '1', name: 'A', email: 'a@x', accountType: 'SUPER_ADMIN', status: 'ACTIVE', lastActiveAt: null, createdAt: '' },
			{ id: '2', name: 'B', email: 'b@x', accountType: 'ADMIN', status: 'ACTIVE', lastActiveAt: null, createdAt: '' },
			{ id: '3', name: 'C', email: 'c@x', accountType: 'ADMIN', status: 'ACTIVE', lastActiveAt: null, createdAt: '' },
		];
		TestBed.configureTestingModule({ imports: [SaRoles], providers: [provideRouter([]), { provide: AdminConsoleApiService, useValue: { getAdmins: () => of({ success: true, data: admins }) } }] });
		const f = TestBed.createComponent(SaRoles);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	it('shows the two real fixed roles with real counts and no invented roles', () => {
		const el = setup();
		const cards = Array.from(el.querySelectorAll('[data-testid="role-card"]')).map((c) => c.textContent || '');
		expect(cards.length).toBe(2);
		expect(cards[0]).toContain('1 حساب');
		expect(cards[1]).toContain('2 حساب');
		expect(el.textContent).not.toContain('مشرف نزاعات');
	});
	it('add/edit role controls are disabled with a visible reason', () => {
		const el = setup();
		expect((el.querySelector('[data-testid="add-role"]') as HTMLButtonElement).disabled).toBe(true);
		expect(el.querySelector('[data-testid="roles-readonly-note"]')?.textContent).toContain('الأدوار ثابتة');
	});
});
