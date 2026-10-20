import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// «حفظ التحديثات» / the sensitive-change tabs with nothing changed: a clear «لا توجد تغييرات للحفظ» note, NO request, never «updated successfully»; a real change still sends.
describe('client profile-edit: saving with no changes', () => {
	let fixture: ComponentFixture<ProfileEdit>;
	let c: ProfileEdit;
	let updateTab: ReturnType<typeof vi.fn>;
	let updateProfile: ReturnType<typeof vi.fn>;

	async function mount() {
		updateTab = vi.fn(() => of({ success: true, message: 'تم', data: {} }));
		updateProfile = vi.fn(() => of({ success: true }));
		await TestBed.configureTestingModule({
			imports: [ProfileEdit],
			providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: {
					getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'Nora', lastName: 'Quest', email: 'c@x.co', phoneNumber: '0500000000', city: 'الرياض', country: 'السعودية', paypalPayoutEmail: 'p@x.co' }, latestHistory: [] } }),
					getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }), updateTab, updateProfile,
				} }],
		}).compileComponents();
		fixture = TestBed.createComponent(ProfileEdit);
		c = fixture.componentInstance;
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());
	const note = (el: HTMLElement) => el.querySelector('[data-testid="no-changes"]')?.textContent?.trim() ?? '';

	it('identity and PayPal tabs: an untouched save = the note and NO request (the name tab keeps the server\'s own «no change on the name» answer, the contact tab sends the stored value by design)', async () => {
		const el = await mount();
		for (const tab of ['identity', 'banking']) {
			c.saveTab(tab); fixture.detectChanges();
			expect(updateTab, tab).not.toHaveBeenCalled();
			expect(note(el), tab).toBe('لا توجد تغييرات للحفظ');
			expect(c.successMsg(), tab).toBe('');
		}
	});

	it('a real change in a tab is still sent, and right after it the same save is a «no changes» answer (no second request)', async () => {
		await mount();
		c.bankingForm.patchValue({ paypalEmail: 'new@x.co' });
		c.saveTab('banking');
		expect(updateTab).toHaveBeenCalledTimes(1);
		c.saveTab('banking'); fixture.detectChanges();
		expect(updateTab).toHaveBeenCalledTimes(1);
		expect(c.noChangeMsg()).toBe('لا توجد تغييرات للحفظ');
	});

	it('the main profile form: unchanged save = the note, no PUT and no «تم تحديث بيانات البروفايل بنجاح»; a change sends and succeeds', async () => {
		const el = await mount();
		c.saveProfile(); fixture.detectChanges();
		expect(updateProfile).not.toHaveBeenCalled();
		expect(note(el)).toBe('لا توجد تغييرات للحفظ');
		expect(c.successMsg()).toBe('');
		c.clientForm.patchValue({ bio: 'نبذة جديدة' });
		c.saveProfile(); fixture.detectChanges();
		expect(updateProfile).toHaveBeenCalledTimes(1);
		expect(c.noChangeMsg()).toBe('');
		expect(c.successMsg()).toContain('تم تحديث');
	});
});
