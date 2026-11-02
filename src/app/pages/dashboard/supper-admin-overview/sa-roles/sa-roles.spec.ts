import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { SaRoles } from './sa-roles';
import { environment } from '../../../../../environments/environment';

// The old page showed fixed account-type "roles" with disabled controls. The page is now the real roles / permissions manager (see ../admin-team-pages.spec.ts for its behaviour);
// this spec only pins that the old fixed, disabled state is gone and that an empty list is said plainly.
describe('SaRoles', () => {
	it('with no roles yet it says so and offers templates; the add button is live for a SUPER_ADMIN (no more "fixed roles" notice)', async () => {
		TestBed.configureTestingModule({ imports: [SaRoles], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
		const { AdminAccessService } = await import('../../../../core/services/admin-access.service');
		const acc = TestBed.inject(AdminAccessService); acc.access.set({ userId: 'u', isSuperAdmin: true, staffStatus: null, roleName: 'Super Admin', permissions: [], hasAnyPermission: true, state: 'SUPER_ADMIN', displayRole: 'Super Admin' }); acc.status.set('ready');
		const http = TestBed.inject(HttpTestingController); const f = TestBed.createComponent(SaRoles); f.detectChanges();
		http.expectOne(`${environment.url_api}/admin/team/permissions`).flush({ success: true, data: { permissions: [], groups: {}, templates: [], superAdminOnly: [], ambiguities: [] } });
		http.expectOne(`${environment.url_api}/admin/team/roles`).flush({ success: true, data: [] });
		http.expectOne(r => r.url === `${environment.url_api}/admin/team/access-audit`).flush({ success: true, data: [] }); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="roles-empty"]')).toBeTruthy(); expect(el.querySelector('[data-testid="role-add"]')?.hasAttribute('disabled')).toBe(false); expect(el.textContent).not.toContain('الأدوار ثابتة');
	});
});
