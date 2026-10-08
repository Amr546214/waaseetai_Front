/// <reference types="node" />
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

// The client setup wizard has NO way to skip it: the test-time "تخطي الآن" button, its handler and the "يمكن التخطي مؤقتاً" wording are gone.
const html = readFileSync(join(__dirname, 'profile-setup.html'), 'utf8');
const ts = readFileSync(join(__dirname, 'profile-setup.ts'), 'utf8');

describe('client setup wizard: no skip', () => {
	let router: Router;
	function mount() {
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: { completionPercentage: 0 } }), saveClientProfileSetup: vi.fn(() => of({ success: true })), saveClientSetupStep: vi.fn(() => of({ success: true, data: {} })) } },
			],
		});
		router = TestBed.inject(Router);
		const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		const f = TestBed.createComponent(ProfileSetupDashboard);
		f.detectChanges();
		const render = () => { f.componentRef.injector.get(ChangeDetectorRef).markForCheck(); f.detectChanges(); };
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, nav, render };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('the source has no skip button, handler or "temporary skip" wording', () => {
		expect(html).not.toContain('تخطي');
		expect(html).not.toContain('skipSetup');
		expect(html).not.toContain('يمكن التخطي مؤقتاً');
		expect(ts).not.toContain('skipSetup');
		expect(ts).not.toContain('تم التخطي');
	});

	it('the rendered page has no "تخطي الآن" button or text, and the component has no skip method', () => {
		const { c, el } = mount();
		expect(el.textContent).not.toContain('تخطي');
		expect(Array.from(el.querySelectorAll('button')).some(b => /تخطي|skip/i.test(b.textContent || ''))).toBe(false);
		expect((c as any).skipSetup).toBeUndefined();
	});

	it('the warning stays as information only, with the corrected wording', () => {
		const { el } = mount();
		const notice = el.querySelector('[data-testid="setup-notice"]') as HTMLElement;
		expect(notice).not.toBeNull();
		expect(notice.querySelectorAll('button, a').length).toBe(0);
		expect(notice.textContent).toContain('يجب إكمال هذا المسار قبل استخدام بعض ميزات الحساب.');
		expect((notice.textContent!.match(/يجب إكمال هذا المسار/g) || []).length).toBe(1);   // no repeated sentence (title is just "تنبيه")
	});

	it('Next / Previous / "إرسال للمراجعة" are still there', () => {
		const { c, el, render } = mount();
		const labels = () => Array.from(el.querySelectorAll('button')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim());
		expect(labels().some(t => t === 'التالي')).toBe(true);
		expect(labels().some(t => t === 'السابق')).toBe(true);
		c.currentStep.set(5); render();
		expect(labels().some(t => t.includes('إرسال للمراجعة'))).toBe(true);
	});

	it('the wizard cannot be bypassed: Next on an empty step 1 stays, the setup is not submitted, nothing navigates away', () => {
		const { c, nav, render } = mount();
		c.nextStep(); render();
		expect(c.currentStep()).toBe(1);
		expect(c.missing().length).toBeGreaterThan(0);
		c.submitForm();
		expect(nav).not.toHaveBeenCalled();
	});
});
