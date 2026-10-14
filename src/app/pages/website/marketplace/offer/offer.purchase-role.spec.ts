import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Offer } from './offer';
import { UserRole, AccountType } from '../../../../core/models/auth.model';
import { AccountService } from '../../../../core/services/account.service';

// Marketplace hotfix: a user acting as a PROVIDER can browse a service but not buy it (no add-to-cart / buy buttons, a switch-to-client CTA instead); acting as CLIENT everything is as before.
const MODEL = { id: 'svc-1', title: 't', category: 'c', status: 'PUBLISHED', totalAmount: 100, totalDays: 5, aiScore: 0, rating: 0, provider: { id: 'p1', name: 'p', initials: 'p' } } as any;
const user = (activeRole: UserRole, roles: UserRole[] = [UserRole.PROVIDER, UserRole.CLIENT]) => ({ id: 'u1', firstName: 'a', lastName: 'b', email: 'a@b.c', accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole, roles } as any);

describe('marketplace offer page: purchase follows the acting role', () => {
	async function render(u: any, extra: any[] = []) {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		await TestBed.configureTestingModule({ imports: [Offer], providers: [provideRouter([]), ...extra] }).compileComponents();
		const f = TestBed.createComponent(Offer);
		(f.componentInstance as any).authStore.authenticate('tok', u);
		f.componentInstance.model.set(MODEL);
		f.detectChanges();
		return f;
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
	const buyButtons = (f: any) => f.nativeElement.querySelectorAll('.pkg-order-btn, .btn-order-primary, #sidebar-order-btn');

	it('acting as PROVIDER: no buy / add-to-cart buttons, and a switch-to-client CTA is shown', async () => {
		const f = await render(user(UserRole.PROVIDER));
		expect(buyButtons(f).length).toBe(0);
		expect(f.nativeElement.querySelector('[data-testid="buy-blocked"]')).toBeTruthy();
		expect(f.nativeElement.querySelector('[data-testid="switch-to-client"]')?.textContent).toContain('بدّل إلى طالب خدمة للشراء');
	});

	it('addToCart() does nothing while acting as a provider (the cart service is never called)', async () => {
		const f = await render(user(UserRole.PROVIDER));
		const spy = vi.spyOn((f.componentInstance as any).cartService, 'addToCart$');
		f.componentInstance.addToCart();
		expect(spy).not.toHaveBeenCalled();
	});

	it('a provider account with no client role is offered to create a client account instead', async () => {
		const f = await render(user(UserRole.PROVIDER, [UserRole.PROVIDER]));
		expect(f.nativeElement.querySelector('[data-testid="switch-to-client"]')).toBeNull();
		expect(f.nativeElement.querySelector('[data-testid="create-client-account"]')?.textContent).toContain('أنشئ حساب طالب خدمة للشراء');
	});

	it('the switch button switches the acting role to CLIENT', async () => {
		const switchActiveRole = vi.fn(() => of({ success: true }));
		const f = await render(user(UserRole.PROVIDER), [{ provide: AccountService, useValue: { switchActiveRole } }]);
		f.componentInstance.switchToClient();
		expect(switchActiveRole).toHaveBeenCalledWith(UserRole.CLIENT);
	});

	it('acting as CLIENT: the buy buttons are there and no blocking CTA', async () => {
		const f = await render(user(UserRole.CLIENT));
		expect(buyButtons(f).length).toBeGreaterThan(0);
		expect(f.nativeElement.querySelector('[data-testid="buy-blocked"]')).toBeNull();
	});

	it('requesting / negotiating a service as a provider shows the switch message and never calls the API', async () => {
		const f = await render(user(UserRole.PROVIDER));
		const spy = vi.spyOn((f.componentInstance as any).marketplaceService, 'requestService');
		f.componentInstance.requestService('negotiation');
		expect(spy).not.toHaveBeenCalled();
		expect(f.componentInstance.cartError()).toBe('بدّل إلى حساب طالب الخدمة لإتمام الشراء');
	});
});
