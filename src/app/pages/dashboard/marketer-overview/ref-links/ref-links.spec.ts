import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { RefLinks } from './ref-links';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

function setup(refLinksData: any = {
	primarySlug: 'amrokasha7e11',
	primaryLink: 'https://waseet.ai/ref/amrokasha7e11', // backend value — must NOT be what's displayed/copied
	customLinks: [{ id: 'c1', channelName: 'تيك توك', utmSource: 'tiktok', createdAt: '2026-01-01' }],
	settings: { notifyOnNewReferral: true, sharePerformanceStats: false }
}) {
	const fakeService: any = {
		getSummary: () => of({ success: true, data: { tier: 'مساعد', successfulReferrals: 0, totalCommissions: 0, progressPercentage: 0, nextTierThreshold: 10 } }),
		getRefLinks: () => of({ success: true, data: refLinksData }),
		createCustomLink: () => of({ success: true, data: {} }),
		updateSettings: () => of({ success: true, data: {} })
	};

	TestBed.configureTestingModule({
		imports: [RefLinks],
		providers: [{ provide: MarketerOverviewService, useValue: fakeService }]
	});

	const fixture: ComponentFixture<RefLinks> = TestBed.createComponent(RefLinks);
	const component = fixture.componentInstance;
	return { fixture, component };
}

describe('RefLinks', () => {
	it('should create', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('builds the full referral URL from the current origin + primarySlug — never the backend\'s hardcoded-domain primaryLink', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();

		// environment.ts (this repo's default/DEV environment) points url_api
		// at https://dev.waseetai.com/api, so the built link must use that
		// origin — never the backend's own primaryLink field, which is
		// hardcoded to https://waseet.ai regardless of environment.
		expect(component.fullReferralLink()).toBe('https://dev.waseetai.com/ref/amrokasha7e11');
		expect(component.fullReferralLink()).not.toContain('waseet.ai/ref/amrokasha7e11'.replace('dev.', ''));
	});

	it('copyToClipboard receives the full URL when the primary link is copied', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		const spy = vi.spyOn(component, 'copyToClipboard').mockImplementation(() => {});

		const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.txt-teal');
		button.click();

		expect(spy).toHaveBeenCalledWith('https://dev.waseetai.com/ref/amrokasha7e11');
	});

	it('builds a correct per-channel link (base URL + ?utm_source=) from the same full URL', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();

		expect(component.channelLink('tiktok')).toBe('https://dev.waseetai.com/ref/amrokasha7e11?utm_source=tiktok');
	});

	it('never produces /ref/undefined when primarySlug is missing — returns an empty string instead', () => {
		const { fixture, component } = setup({
			primarySlug: null,
			primaryLink: '',
			customLinks: [],
			settings: { notifyOnNewReferral: true, sharePerformanceStats: false }
		});
		fixture.detectChanges();

		expect(component.fullReferralLink()).toBe('');
		expect(component.fullReferralLink()).not.toContain('undefined');
		expect(component.channelLink('tiktok')).toBe('');

		const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.txt-teal');
		expect(button.disabled).toBe(true);
	});
});
