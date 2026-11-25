import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, RouterStateSnapshot, ActivatedRouteSnapshot, provideRouter } from '@angular/router';
import { Observable, isObservable, firstValueFrom } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';
import { ClientOnboardingStateService } from '../services/client-onboarding-state.service';
import { clientOnboardingGuard, CLIENT_ONBOARDING_PAGE } from './client-onboarding.guard';

// An individual client enters the dashboard only after «استكمال البيانات» is finished AND the identity matched; a failed read never locks anyone out.
describe('clientOnboardingGuard + ClientOnboardingStateService', () => {
	let http: HttpTestingController; const info = vi.fn();
	function setup(accountType = 'CLIENT_INDIVIDUAL', activeRole?: string) {
		TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => ({ id: 'u1', accountType, activeRole }) } }, { provide: UiNotificationService, useValue: { info } }] });
		http = TestBed.inject(HttpTestingController);
	}
	const run = (url: string) => TestBed.runInInjectionContext(() => clientOnboardingGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
	const resolve = async (url: string, o: { percent?: number; canAdvance?: boolean; kyc?: string; fail?: boolean } = {}) => {
		const r = run(url);
		if (!isObservable(r)) return r;
		const p = firstValueFrom(r as Observable<unknown>);
		const s = http.expectOne(x => x.url.endsWith('/client/profile/setup')), g = http.expectOne(x => x.url.endsWith('/client/profile/setup/identity'));
		if (o.fail) { s.flush('x', { status: 500, statusText: 'err' }); void g; }
		else { s.flush({ data: { completionPercentage: o.percent ?? 40, kycStatus: o.kyc ?? 'PENDING' } }); g.flush({ data: { canAdvance: o.canAdvance ?? false } }); }
		return p;
	};
	beforeEach(() => info.mockClear());
	afterEach(() => TestBed.resetTestingModule());

	it('wizard unfinished: another page goes to the path with a message', async () => {
		setup(); const r = await resolve('/client-overview/my-requests', { percent: 40, canAdvance: false });
		expect(r instanceof UrlTree).toBe(true); expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe(CLIENT_ONBOARDING_PAGE); expect(info).toHaveBeenCalled();
	});
	it('wizard finished but the identity did not match yet: still closed', async () => {
		setup(); const r = await resolve('/client-overview/profile/edit', { percent: 100, canAdvance: false });
		expect(r instanceof UrlTree).toBe(true);
	});
	it('wizard finished and the identity passed: open', async () => {
		setup(); expect(await resolve('/client-overview/my-requests', { percent: 100, canAdvance: true })).toBe(true);
	});
	it('the path itself, help and the assistant are always reachable (no request)', () => {
		setup();
		for (const u of ['/client-overview/profile-setup', '/client-overview/profile-setup/x', '/client-overview/help', '/client-overview/bebo']) expect(run(u)).toBe(true);
		http.expectNone(() => true);
	});
	it('a failed read opens (never locks anyone out)', async () => {
		setup(); expect(await resolve('/client-overview/my-requests', { fail: true })).toBe(true);
	});
	it('a company client and a non-client role are not touched (no request)', () => {
		setup('CLIENT_COMPANY'); expect(run('/client-overview/my-requests')).toBe(true); http.expectNone(() => true);
	});
	it('badge: waiting for the administration, then approved; none while the wizard is open', async () => {
		setup(); await resolve('/client-overview/x', { percent: 100, canAdvance: true, kyc: 'PENDING' });
		const svc = TestBed.inject(ClientOnboardingStateService);
		expect(svc.badge()).toBe('PENDING_ADMIN');
		svc.load(true).subscribe();
		http.expectOne(x => x.url.endsWith('/client/profile/setup')).flush({ data: { completionPercentage: 100, kycStatus: 'VERIFIED' } });
		http.expectOne(x => x.url.endsWith('/client/profile/setup/identity')).flush({ data: { canAdvance: true } });
		expect(svc.badge()).toBe('APPROVED');
		svc.load(true).subscribe();
		http.expectOne(x => x.url.endsWith('/client/profile/setup')).flush({ data: { completionPercentage: 35, kycStatus: 'PENDING' } });
		http.expectOne(x => x.url.endsWith('/client/profile/setup/identity')).flush({ data: { canAdvance: false } });
		expect(svc.badge()).toBeNull();
	});
});
