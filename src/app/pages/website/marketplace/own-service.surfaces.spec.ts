import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Marketplace } from './marketplace';
import { Slug } from './slug/slug';
import { CuratedComponent } from './curated/curated';
import { FavoritesComponent } from './favorites/favorites';
import { ProviderProfileComponent } from './provider-profile/provider-profile';
import { CompareServicesComponent } from './compare-services/compare-services';
import { Card } from '../../../sheards/card/card';
import { CartComponent } from '../checkout/cart/cart';
import { CheckoutReviewComponent } from '../checkout/review/review';
import { AuthStore } from '../../../core/store/auth.store';
import { CartService } from '../../../core/services/cart.service';
import { UserRole, AccountType } from '../../../core/models/auth.model';
import { isOwnModel } from '../../../core/utils/own-service.util';

// Post-Batch-B fix 2: the SAME account (PROVIDER+CLIENT) that switched its acting role to CLIENT is still the owner of its services. Every surface that offers a
// buy / add-to-cart / order action must show «هذه خدمتك» for the owner (user id, or the BE flag) and keep the normal cue for everyone else, including a different
// user with the same display name.
const ME = 'u-me';
const user = { id: ME, firstName: 'سامي', lastName: 'أحمد', email: 'a@b.c', accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT, roles: [UserRole.PROVIDER, UserRole.CLIENT] } as any;
const mdl = (id: string, providerId: string, extra: any = {}) => ({ id, title: 'خدمة ' + id, category: 'تصميم', status: 'PUBLISHED', totalAmount: 100, totalDays: 5, aiScore: 70, rating: 4, level: 'مبتدئ', discountPercentage: 10, provider: { id: providerId, name: 'سامي أحمد', initials: 'سأ' }, ...extra }) as any;
const OWN = mdl('own', ME);
const OWN_BY_FLAG = mdl('flag', 'someone-else-shape', { isOwnService: true });
const TWIN = mdl('twin', 'u-twin'); // same display name «سامي أحمد», different user id
const OTHER = mdl('other', 'u-other', { provider: { id: 'u-other', name: 'آخر', initials: 'آ' } });

async function render(cmp: any, set: (c: any) => void, auth = true): Promise<ComponentFixture<any>> {
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	await TestBed.configureTestingModule({ imports: [cmp], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
	if (auth) TestBed.inject(AuthStore).authenticate('tok', user);
	const f = TestBed.createComponent(cmp);
	f.detectChanges(); // ngOnInit first (it starts loading), then the test data lands
	set(f.componentInstance);
	f.detectChanges();
	return f;
}
const own = (f: any) => Array.from<HTMLElement>(f.nativeElement.querySelectorAll('[data-testid="own-service"]'));
afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

describe('isOwnModel', () => {
	it('user id or BE flag; never a name; false for a guest / missing data', () => {
		expect(isOwnModel(OWN, ME)).toBe(true);
		expect(isOwnModel(OWN_BY_FLAG, ME)).toBe(true);
		expect(isOwnModel(TWIN, ME)).toBe(false);
		expect(isOwnModel(OWN, undefined)).toBe(false);
		expect(isOwnModel(null, ME)).toBe(false);
	});
});

describe('own service on every buy surface (same account, acting role CLIENT)', () => {
	it('shared card (home preview / lists): badge + «هذه خدمتك» for the owner only', async () => {
		const f = await render(Card, c => { c.favoriteModels.set(new Set()); TestBed.runInInjectionContext(() => 0); });
		f.componentRef.setInput('models', [OWN, OWN_BY_FLAG, TWIN, OTHER]);
		f.detectChanges();
		const cards = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('a.svc-card'));
		expect(cards.length).toBe(4);
		expect(cards.map(c => c.textContent!.includes('هذه خدمتك'))).toEqual([true, true, false, false]);
		expect(own(f).length).toBe(2);
	});

	it('marketplace page: «الاقتراحات» (AI/suggestions block), grid, flash and results cards', async () => {
		const f = await render(Marketplace, c => { c.isLoading.set(false); c.allModels.set([OWN, TWIN]); c.aiRecommendedModels.set([OWN_BY_FLAG, OTHER]); });
		const html: string = f.nativeElement.textContent;
		expect(own(f).length).toBeGreaterThanOrEqual(3); // own in flash/top-rated/grid + flagged in suggestions
		const suggestions = f.nativeElement.querySelectorAll('a.svc-card');
		const ownCards = Array.from<HTMLElement>(suggestions).filter(a => a.querySelector('[data-testid="own-service"]'));
		const titles = ownCards.map(a => a.querySelector('.svc-title')?.textContent?.trim());
		expect(titles).toContain('خدمة own');
		expect(titles).toContain('خدمة flag');
		expect(titles).not.toContain('خدمة twin');
		expect(titles).not.toContain('خدمة other');
		expect(html).toContain('خدمة twin');
		f.componentInstance.resultsMode.set(true); f.detectChanges();
		const res = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('#svc-grid a.svc-card'));
		expect(res.filter(a => a.textContent!.includes('هذه خدمتك')).length).toBe(1);
		expect(res.length).toBe(2);
	});

	it('category / slug page cards', async () => {
		const f = await render(Slug, c => { c.isLoading.set(false); c.models.set([OWN, TWIN]); });
		const cards = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('a.svc-card'));
		const flagged = cards.filter(a => a.textContent!.includes('هذه خدمتك'));
		expect(flagged.length).toBe(1);
		expect(flagged[0].textContent).toContain('خدمة own');
	});

	it('curated pages: «اطلب الآن» becomes «هذه خدمتك» for the owner, stays for others', async () => {
		const f = await render(CuratedComponent, c => { c.loading.set(false); c.models.set([OWN, TWIN, OTHER]); });
		const txt: string = f.nativeElement.textContent;
		expect(txt).toContain('هذه خدمتك');
	});

	it('curated pages: a different user with the same display name sees no «هذه خدمتك» anywhere', async () => {
		const f = await render(CuratedComponent, c => { c.loading.set(false); c.models.set([TWIN, OTHER]); });
		expect(f.nativeElement.textContent).not.toContain('هذه خدمتك');
	});

	it('favorites: no «اطلب الآن» on the owner\'s saved service, it stays on others', async () => {
		const f = await render(FavoritesComponent, c => { c.loading.set(false); c.favorites.set([OWN, TWIN]); });
		const cards = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('.svc-card'));
		expect(cards.length).toBe(2);
		const [a, b] = cards;
		expect(a.querySelector('[data-testid="own-service"]')).toBeTruthy();
		expect(a.textContent).not.toContain('اطلب الآن');
		expect(b.querySelector('[data-testid="own-service"]')).toBeNull();
		expect(b.textContent).toContain('اطلب الآن');
	});

	it('public provider profile of the owner: every service card says «هذه خدمتك»; another provider\'s profile does not', async () => {
		for (const [pid, expected] of [[ME, 2], ['u-other', 0]] as const) {
			TestBed.resetTestingModule();
			vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
			const { ActivatedRoute } = await import('@angular/router');
			await TestBed.configureTestingModule({ imports: [ProviderProfileComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { paramMap: new (await import('rxjs')).Subject(), snapshot: { paramMap: { get: () => pid } } } }] }).compileComponents();
			TestBed.inject(AuthStore).authenticate('tok', user);
			const f = TestBed.createComponent(ProviderProfileComponent);
			f.componentInstance.provider.set({ header: { fullName: 'x', stats: {} }, services: [{ id: 's1', title: 'a', totalAmount: 5 }, { id: 's2', title: 'b', totalAmount: 6 }] });
			f.componentInstance.loading.set(false);
			f.componentInstance.activeTab.set('services');
			f.detectChanges();
			expect(own(f).length).toBe(expected);
		}
	});

	it('compare page: the order cue becomes «هذه خدمتك» for the owner', async () => {
		const f = await render(CompareServicesComponent, c => { c.loading.set(false); c.models.set([OWN, TWIN]); });
		const btns = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('.pcard-btn'));
		expect(btns.map(b => b.textContent!.trim())[0]).toBe('هذه خدمتك');
		expect(btns[1].textContent).not.toContain('هذه خدمتك');
		expect(btns[0].getAttribute('data-testid')).toBe('own-service');
	});

	it('cart: suggestion cards drop «إضافة للسلة» for the owner and never call the add API; others keep it', async () => {
		const f = await render(CartComponent, c => { c.aiLoading.set(false); c.aiError.set(false); c.aiRecommendations.set([OWN, OWN_BY_FLAG, TWIN]); });
		const add = vi.spyOn(TestBed.inject(CartService), 'addToCart$');
		const recs = Array.from<HTMLElement>(f.nativeElement.querySelectorAll('.rec-card'));
		expect(recs.length).toBe(3);
		expect(recs.map(r => !!r.querySelector('[data-testid="rec-own-service"]'))).toEqual([true, true, false]);
		expect(recs.map(r => !!r.querySelector('.rec-add-btn'))).toEqual([false, false, true]);
		f.componentInstance.addRecommendation(new Event('click'), OWN);
		expect(add).not.toHaveBeenCalled();
	});

	it('cart: a stale own-service row is flagged, cannot be saved/restored, checkout is blocked with a clear reason and the item can be removed', async () => {
		const f = await render(CartComponent, c => { c.aiLoading.set(false); c.aiError.set(true); });
		const cart = TestBed.inject(CartService) as any;
		const row = (id: string, ownService: boolean, savedForLater = false) => ({ id, modelId: 'm' + id, title: 't' + id, category: 'c', totalAmount: 10, totalDays: 2, provider: { id: ownService ? ME : 'p', name: 'n', initials: 'ن' }, addedAt: '', savedForLater, ownService });
		cart._items.set([row('a', true), row('b', false), row('c', true, true)]);
		f.detectChanges();
		const el: HTMLElement = f.nativeElement;
		expect(el.querySelectorAll('[data-testid="cart-own-service"]').length).toBe(1);
		expect(el.querySelectorAll('[data-testid="cart-own-service-saved"]').length).toBe(1);
		expect(el.querySelectorAll('.cart-save-btn').length).toBe(1); // only the other-user row can be saved for later; the saved own row has no «إعادة للسلة»
		(el.querySelector('.btn-checkout') as HTMLButtonElement).click(); f.detectChanges();
		expect(el.querySelector('.checkout-blocked-msg')!.textContent).toContain('خدمة تملكها أنت');
		const remove = vi.spyOn(cart, 'removeFromCart');
		(el.querySelector('.cart-remove-btn') as HTMLButtonElement).click();
		expect(remove).toHaveBeenCalledWith('a');
	});

	it('review page: «متابعة للدفع» is disabled while an own-service row is in the cart and no order is created', async () => {
		const f = await render(CheckoutReviewComponent, () => {});
		const cart = TestBed.inject(CartService) as any;
		cart._items.set([{ id: 'a', modelId: 'ma', title: 't', category: 'c', totalAmount: 10, totalDays: 2, provider: { id: ME, name: 'n', initials: 'ن' }, addedAt: '', savedForLater: false, ownService: true }]);
		f.detectChanges();
		const btn = f.nativeElement.querySelector('.btn-checkout') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
		const create = vi.spyOn((f.componentInstance as any).checkoutService, 'createOrder');
		f.componentInstance.proceedToPayment();
		expect(create).not.toHaveBeenCalled();
		expect(f.componentInstance.errorMessage()).toContain('خدمة تملكها أنت');
	});
});
