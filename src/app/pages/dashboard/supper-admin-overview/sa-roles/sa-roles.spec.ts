import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SaRoles } from './sa-roles';

// D1's page: the roles and counts come from /admin/users/roles-overview (real server aggregates); nothing is invented client-side.
describe('SaRoles', () => {
	function setup() {
		const overview = {
			roles: [
				{ role: 'SUPER_ADMIN', label: 'مدير عام', description: 'د1', members: 1 },
				{ role: 'ADMIN', label: 'إداري', description: 'د2', members: 2 },
			],
			accountTypes: [{ accountType: 'ADMIN', count: 2 }, { accountType: 'SUPER_ADMIN', count: 1 }],
			suspendedAccounts: 0,
			adminCapabilities: [{ key: 'user-delete', label: 'حذف', admin: false, superAdmin: true }],
		};
		TestBed.configureTestingModule({ imports: [SaRoles], providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: true, data: overview }) } }] });
		const f = TestBed.createComponent(SaRoles);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	it('shows the real fixed roles with the server counts and no invented roles', () => {
		const el = setup();
		const cards = Array.from(el.querySelectorAll('.rl-role-card')).map((c) => c.textContent || '');
		expect(cards.length).toBe(2);
		expect(cards[0]).toContain('1 عضو');
		expect(cards[1]).toContain('2 عضو');
		expect(el.textContent).not.toContain('مشرف نزاعات');
	});
	it('add/edit role controls are disabled with a visible reason', () => {
		const el = setup();
		expect(el.querySelector('.rl-btn-primary')!.hasAttribute('disabled')).toBe(true);
		expect(el.querySelector('.rl-role-edit')!.hasAttribute('disabled')).toBe(true);
		expect(el.textContent).toContain('الأدوار ثابتة');
	});
});
