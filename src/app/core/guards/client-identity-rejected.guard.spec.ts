import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, RouterStateSnapshot, ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { Observable, isObservable, firstValueFrom, of } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { clientIdentityRejectedGuard, resetClientIdentityRejectedCache, CLIENT_REJECTED_IDENTITY_PAGE } from './client-identity-rejected.guard';

// A client whose identity the admin REJECTED stays on the identity page of the wizard; anything else under /client-overview lands there (also on a reopened site / new login).
describe('clientIdentityRejectedGuard', () => {
	let http: HttpTestingController; const info = vi.fn();
	function setup(accountType = 'CLIENT_INDIVIDUAL', id = 'u1') {
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => ({ id, accountType }) } }, { provide: UiNotificationService, useValue: { info } }] });
		http = TestBed.inject(HttpTestingController);
	}
	const run = (url: string) => TestBed.runInInjectionContext(() => clientIdentityRejectedGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
	const resolve = async (url: string, status?: string | 'error') => {
		const r = run(url);
		if (!isObservable(r)) return r;
		const p = firstValueFrom(r as Observable<unknown>);
		const req = http.expectOne(x => x.url.endsWith('/client/profile/setup/identity'));
		if (status === 'error') req.flush('x', { status: 500, statusText: 'err' }); else req.flush({ data: { status } });
		return p;
	};
	beforeEach(() => { resetClientIdentityRejectedCache(); info.mockClear(); });

	it('REJECTED: any other page goes to the wizard (the identity step) with a message', async () => {
		setup(); const r = await resolve('/client-overview/my-requests', 'REJECTED');
		expect(r instanceof UrlTree).toBe(true); expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe(CLIENT_REJECTED_IDENTITY_PAGE); expect(info).toHaveBeenCalled();
	});
	it('REJECTED: the wizard itself stays open (no request, no loop)', async () => { setup(); expect(run('/client-overview/profile-setup?x=1')).toBe(true); http.expectNone(() => true); });
	it('not rejected (under review / approved / not submitted) or a failed read: nothing is locked', async () => {
		for (const s of ['UNDER_REVIEW', 'APPROVED', 'NOT_SUBMITTED', 'error'] as const) { resetClientIdentityRejectedCache(); setup(); expect(await resolve('/client-overview', s)).toBe(true); TestBed.resetTestingModule(); }
	});
	it('companies are never locked; a different account never inherits the cached verdict', async () => {
		setup('CLIENT_COMPANY'); expect(run('/client-overview/my-requests')).toBe(true); TestBed.resetTestingModule();
		setup('CLIENT_INDIVIDUAL', 'a'); await resolve('/client-overview/x', 'REJECTED'); TestBed.resetTestingModule();
		setup('CLIENT_INDIVIDUAL', 'b'); expect(await resolve('/client-overview/x', 'APPROVED')).toBe(true);
	});
	it('the verdict is cached for a moment, and cleared once new documents are sent', async () => {
		setup(); await resolve('/client-overview/a', 'REJECTED');
		const again = run('/client-overview/b'); expect(again instanceof UrlTree).toBe(true); http.expectNone(() => true);
		resetClientIdentityRejectedCache(); const fresh = run('/client-overview/c'); expect(isObservable(fresh)).toBe(true);
		const done = firstValueFrom(fresh as Observable<unknown>); http.expectOne(() => true).flush({ data: { status: 'UNDER_REVIEW' } }); expect(await done).toBe(true);
	});
});
