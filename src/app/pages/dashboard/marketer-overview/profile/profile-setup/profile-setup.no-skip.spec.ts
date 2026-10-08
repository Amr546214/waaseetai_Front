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

// The marketer setup wizard has no "تخطي" buttons: no step is mandatory to move on, so "التالي" passes an optional step without input,
// while the save buttons ("حفظ ومتابعة" / "إضافة ومتابعة") still validate what is typed.
const html = readFileSync(join(__dirname, 'profile-setup.html'), 'utf8');
const ts = readFileSync(join(__dirname, 'profile-setup.ts'), 'utf8');

describe('marketer setup wizard: no skip buttons', () => {
	let svc: any;
	function mount() {
		svc = {
			getProfile: vi.fn(() => of({ success: true, data: { marketingChannels: [], completionPercentage: 0, missingItems: [{ key: 'bio', status: 'missing' }, { key: 'channel', status: 'missing' }, { key: 'iban', status: 'missing' }], user: {} } })),
			updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(() => of({ success: true })), updateBankInfo: vi.fn(() => of({ success: true })),
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
			c.setStep(step); render();
			expect(el.textContent, `step ${step}`).not.toContain('تخطي');
			expect(labels().some(t => /تخطي|skip/i.test(t)), `step ${step}`).toBe(false);
		}
	});

	it('optional steps are passed with "التالي" only, without input and without saving anything', () => {
		const { c, render, labels } = mount();
		expect(c.currentStep()).toBe(2);                                                  // opens on the first missing step
		for (const step of [2, 3, 4]) {
			c.setStep(step); render();
			expect(labels().filter(t => t === 'التالي').length, `step ${step}`).toBe(1);
		}
		c.setStep(2); render();
		c.nextStep(); render(); expect(c.currentStep()).toBe(3);
		c.nextStep(); render(); expect(c.currentStep()).toBe(4);
		c.nextStep(); render(); expect(c.currentStep()).toBe(5);
		expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
		expect(svc.addChannel).not.toHaveBeenCalled();
		expect(svc.updateBankInfo).not.toHaveBeenCalled();
	});

	it('the save buttons still validate: an empty channel / empty bank form is not sent and the step does not advance', () => {
		const { c, render } = mount();
		c.setStep(3); render();
		c.addChannel(); render();
		expect(svc.addChannel).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(3);
		c.setStep(4); render();
		c.saveBankInfo(); render();
		expect(svc.updateBankInfo).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(4);
		expect(c.missing().length).toBeGreaterThan(0);
	});

	it('the save buttons still save and move on', () => {
		const { c, render } = mount();
		c.setStep(3); render();
		c.channelForm.setValue({ platform: 'INSTAGRAM', handle: '@amr' });
		c.addChannel();
		expect(svc.addChannel).toHaveBeenCalledTimes(1);
	});

	it('the intro text no longer talks about skipping', () => {
		const { el } = mount();
		expect(el.textContent).not.toContain('التخطي');
		expect(el.textContent).toContain('يمكنك المتابعة دون إكمال أي خطوة');
	});
});
