/// <reference types="node" />
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { ProfileSetup } from './profile-setup';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

// The marketer setup wizard has no "تخطي" buttons. The bio and ONE valid channel are required (the bar / «التالي» cannot pass those two steps without them,
// see profile-setup.required.spec.ts); PayPal stays optional. The save buttons still validate what is typed.
const html = readFileSync(join(__dirname, 'profile-setup.html'), 'utf8');
const ts = readFileSync(join(__dirname, 'profile-setup.ts'), 'utf8');

describe('marketer setup wizard: no skip buttons', () => {
	let svc: any;
	function mount() {
		svc = {
			getProfile: vi.fn(() => of({ success: true, data: { marketingChannels: [], completionPercentage: 0, missingItems: [{ key: 'bio', status: 'missing' }, { key: 'channel', status: 'missing' }, { key: 'payout', status: 'missing' }], user: {} } })),
			updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(() => of({ success: true })), updatePaypalPayout: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({ imports: [ProfileSetup], providers: [provideRouter([]), { provide: MarketerProfileService, useValue: svc }] });
		const f = TestBed.createComponent(ProfileSetup);
		f.detectChanges();
		const render = () => { f.componentRef.injector.get(ChangeDetectorRef).markForCheck(); f.detectChanges(); };
		const el = f.nativeElement as HTMLElement;
		const labels = () => Array.from(el.querySelectorAll('button')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim());
		return { c: f.componentInstance, el, render, labels };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('the source has no "تخطي" and no skipChannel()', () => {
		expect(html).not.toContain('تخطي');
		expect(html).not.toContain('skipChannel');
		expect(ts).not.toContain('skipChannel');
	});

	it('no step (1..5) renders a skip button or text', () => {
		const { c, el, render, labels } = mount();
		for (const step of [1, 2, 3, 4, 5]) {
			c.currentStep.set(step); render();
			expect(el.textContent, `step ${step}`).not.toContain('تخطي');
			expect(labels().some(t => /تخطي|skip/i.test(t)), `step ${step}`).toBe(false);
		}
	});

	it('only the PayPal step is optional: the bio and channel steps cannot be passed with "التالي" without their item (nothing is saved or sent)', () => {
		const { c, render, labels } = mount();
		expect(c.currentStep()).toBe(2);                                                  // opens on the first missing step
		for (const step of [2, 3, 4]) {
			c.currentStep.set(step); render();
			expect(labels().filter(t => t === 'التالي').length, `step ${step}`).toBe(1);
		}
		c.currentStep.set(2); render();
		c.skipNext(); render(); expect(c.currentStep()).toBe(2);                           // no saved bio
		c.profile.set({ ...(c.profile() as any), bio: 'وصف' });
		c.skipNext(); render(); expect(c.currentStep()).toBe(3);
		c.skipNext(); render(); expect(c.currentStep()).toBe(3);                           // no channel yet
		c.profile.set({ ...(c.profile() as any), marketingChannels: [{ id: 'c', platform: 'TIKTOK', handle: 'x' }] });
		c.skipNext(); render(); expect(c.currentStep()).toBe(4);
		c.skipNext(); render(); expect(c.currentStep()).toBe(5);                           // PayPal is optional
		expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
		expect(svc.addChannel).not.toHaveBeenCalled();
		expect(svc.updatePaypalPayout).not.toHaveBeenCalled();
	});

	it('the save buttons still validate: an empty channel / empty PayPal form is not sent and the step does not advance', () => {
		const { c, render } = mount();
		c.currentStep.set(3); render();
		c.addChannel(); render();
		expect(svc.addChannel).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(3);
		c.currentStep.set(4); render();
		c.savePaypal(); render();
		expect(svc.updatePaypalPayout).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(4);
		expect(c.missing().length).toBeGreaterThan(0);
	});

	it('the save buttons still save and move on', () => {
		const { c, render } = mount();
		c.currentStep.set(3); render();
		c.channelForm.setValue({ platform: 'INSTAGRAM', handle: '@amr' });
		c.addChannel();
		expect(svc.addChannel).toHaveBeenCalledTimes(1);
	});

	it('the intro text no longer talks about skipping', () => {
		const { el } = mount();
		expect(el.textContent).not.toContain('التخطي');
		expect(el.textContent).toContain('الوصف التسويقي وقناة تسويق واحدة مطلوبان');
	});
});
