import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Account } from './account';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';

// The preferences save button is disabled while nothing changed: the page now SAYS so («لا توجد تغييرات للحفظ») instead of a silent dead button; the message goes away on a change.
describe('client account page: no-changes feedback', () => {
	function mount() {
		TestBed.configureTestingModule({ imports: [Account], providers: [provideRouter([]),
			{ provide: ProfileApiService, useValue: { getMyProfile: () => of({ success: true, data: { currentProfileData: { interfaceLanguage: 'العربية', timezone: '(GMT+3) توقيت الرياض' } } }), updateProfile: vi.fn(() => of({ success: true })) } },
			{ provide: ProviderProfileService, useValue: { getActiveSessions: () => of({ success: true, data: [] }), revokeSession: vi.fn() } }] });
		const f = TestBed.createComponent(Account);
		f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());
	it('clean page: the hint is visible and the save button is disabled; after a change the hint is gone and the button works', () => {
		const { f, c, el } = mount();
		expect(el.querySelector('[data-testid="no-changes"]')?.textContent).toContain('لا توجد تغييرات للحفظ');
		expect((el.querySelector('[data-testid="save-prefs"]') as HTMLButtonElement).disabled).toBe(true);
		c.language.set('English'); f.detectChanges();
		expect(el.querySelector('[data-testid="no-changes"]')).toBeNull();
		expect((el.querySelector('[data-testid="save-prefs"]') as HTMLButtonElement).disabled).toBe(false);
	});
});
