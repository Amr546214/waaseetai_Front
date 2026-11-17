import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { marketerProfileCompleteGuard } from './marketer-profile-complete.guard';
import { AuthStore } from '../store/auth.store';
import { MarketerProfileService } from '../services/marketer-profile.service';
import { MARKETER_SETUP_PAGE } from '../../pages/dashboard/marketer-overview/profile/profile-setup/marketer-setup-state';

const item = (key: string, status: 'missing' | 'pending_review' = 'missing') => ({ key, status, label: key, points: 20, tab: 'profile' as const, hint: '' });
const completeProfile = (over: any = {}) => ({
	id: 'm1',
	avatarUrl: 'data:image/png;base64,AAA',
	user: { avatarUrl: 'data:image/png;base64,AAA' },
	bio: 'وصف تسويقي مفصل يتجاوز خمسين حرفًا للوسيط التسويقي المحترف',
	marketingChannels: [{ id: 'c1', platform: 'INSTAGRAM', handle: '@amr' }],
	paypalPayoutEmail: null,
	completionPercentage: 70,
	missingItems: [item('payout')],
	...over,
});

describe('marketerProfileCompleteGuard', () => {
	function setup(res: Observable<any>, snapshot: any = null) {
		const getProfile = vi.fn(() => res);
		const profileSnapshot = signal<any>(snapshot);
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true) } },
				{ provide: MarketerProfileService, useValue: { getProfile, profileSnapshot } },
			],
		});
		return { getProfile, profileSnapshot };
	}

	async function run(url: string) {
		const out = TestBed.runInInjectionContext(() => marketerProfileCompleteGuard({} as any, { url } as any));
		const r = await firstValueFrom(out as Observable<boolean | UrlTree>);
		return r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;
	}

	const GATED = ['', '/referrals', '/ref-links', '/assets', '/commissions', '/withdraw', '/messages', '/profile/data', '/profile/public'];

	it('missing bio or channel blocks dashboard and every gated route -> redirects to /marketer-overview/profile-setup', async () => {
		for (const incomplete of [
			completeProfile({ bio: '', missingItems: [item('bio')] }),
			completeProfile({ marketingChannels: [], missingItems: [item('channel')] }),
			completeProfile({ avatarUrl: '', bio: '', marketingChannels: [], completionPercentage: 20, missingItems: [item('avatar'), item('bio'), item('channel'), item('payout')] }),
		]) {
			setup(of({ success: true, data: incomplete }));
			for (const g of GATED) {
				expect(await run('/marketer-overview' + g), g || 'home').toBe(MARKETER_SETUP_PAGE);
			}
		}
	});

	it('allowed onboarding/support paths stay open while incomplete without querying profile', async () => {
		const { getProfile } = setup(of({ success: true, data: completeProfile({ bio: '', missingItems: [item('bio')] }) }));
		for (const u of ['profile-setup', 'help', 'help/tickets/123', 'notifications', 'bebo']) {
			expect(await run('/marketer-overview/' + u), u).toBe(true);
		}
		expect(getProfile).not.toHaveBeenCalled();
	});

	it('bio + channel complete (even when avatar and PayPal are missing) opens dashboard and gated routes', async () => {
		setup(of({ success: true, data: completeProfile({ avatarUrl: '', user: {}, missingItems: [item('avatar'), item('payout')] }) }));
		for (const g of GATED) {
			expect(await run('/marketer-overview' + g), g || 'home').toBe(true);
		}
	});

	it('on network error: falls back to snapshot if incomplete, otherwise avoids trapping navigation', async () => {
		setup(throwError(() => new Error('500')), null);
		expect(await run('/marketer-overview')).toBe(true);

		setup(throwError(() => new Error('500')), completeProfile({ bio: '', missingItems: [item('bio')] }));
		expect(await run('/marketer-overview')).toBe(MARKETER_SETUP_PAGE);
	});
});
