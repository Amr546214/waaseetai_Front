import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Offer } from './offer';
import { UserRole, AccountType } from '../../../../core/models/auth.model';

// Batch B §8/§9: the owner of a service (any acting role) sees «هذه خدمتك» and no buy / negotiate / role-switch action; everyone else has exactly ONE «طلب تفاوض».
const model = (providerId: string, extra: any = {}) => ({ id: 'svc-1', title: 't', category: 'c', status: 'PUBLISHED', totalAmount: 100, totalDays: 5, aiScore: 0, rating: 0, provider: { id: providerId, name: 'p', initials: 'p' }, ...extra }) as any;
const user = (activeRole: UserRole) => ({ id: 'u1', firstName: 'a', lastName: 'b', email: 'a@b.c', accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole, roles: [UserRole.PROVIDER, UserRole.CLIENT] }) as any;

describe('marketplace offer page: own service / single negotiation request', () => {
	async function render(u: any, m: any) {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		await TestBed.configureTestingModule({ imports: [Offer], providers: [provideRouter([])] }).compileComponents();
		const f = TestBed.createComponent(Offer);
		(f.componentInstance as any).authStore.authenticate('tok', u);
		f.componentInstance.model.set(m);
		f.detectChanges();
		return f;
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
	const q = (f: any, sel: string) => f.nativeElement.querySelectorAll(sel);

	for (const role of [UserRole.CLIENT, UserRole.PROVIDER]) {
		it(`owner acting as ${role}: «هذه خدمتك», no buy, no negotiation, no role-switch CTA`, async () => {
			const f = await render(user(role), model('u1'));
			expect(q(f, '[data-testid="own-service"]')[0].textContent).toContain('هذه خدمتك');
			expect(q(f, '.pkg-order-btn, .btn-order-primary, #sidebar-order-btn').length).toBe(0);
			expect(q(f, '[data-testid="negotiation-request"]').length).toBe(0);
			expect(q(f, '[data-testid="switch-to-client"], [data-testid="buy-blocked"]').length).toBe(0);
		});
	}

	it('the BE isOwnService flag alone is enough (different provider id shape)', async () => {
		const f = await render(user(UserRole.CLIENT), model('other', { isOwnService: true }));
		expect(q(f, '[data-testid="own-service"]').length).toBeGreaterThan(0);
	});

	it('owner: addToCart() and requestService() never call the API', async () => {
		const f = await render(user(UserRole.CLIENT), model('u1'));
		const cart = vi.spyOn((f.componentInstance as any).cartService, 'addToCart$');
		const req = vi.spyOn((f.componentInstance as any).marketplaceService, 'requestService');
		f.componentInstance.addToCart(); f.componentInstance.requestService('negotiation');
		expect(cart).not.toHaveBeenCalled(); expect(req).not.toHaveBeenCalled();
	});

	it('someone else\'s service as CLIENT: buy buttons present and exactly ONE «طلب تفاوض», no «تواصل» button', async () => {
		const f = await render(user(UserRole.CLIENT), model('p9'));
		expect(q(f, '.btn-order-primary, #sidebar-order-btn').length).toBeGreaterThan(0);
		expect(q(f, '[data-testid="own-service"]').length).toBe(0);
		expect(q(f, '[data-testid="negotiation-request"]').length).toBe(1);
		expect(f.nativeElement.textContent).not.toContain('تواصل مع');
	});

	it('the negotiation request goes to the messages room it returns and shows the server message on refusal', async () => {
		const f = await render(user(UserRole.CLIENT), model('p9'));
		const router = (f.componentInstance as any).router; const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		const svc = (f.componentInstance as any).marketplaceService;
		vi.spyOn(svc, 'requestService').mockReturnValue(of({ data: { conversationId: 'c1' } }));
		f.componentInstance.requestService('negotiation');
		expect(nav).toHaveBeenCalledWith(['/client-overview/messages'], { queryParams: { conversationId: 'c1' } });
		expect(f.componentInstance.isSubmitting()).toBe(false);
	});
});
