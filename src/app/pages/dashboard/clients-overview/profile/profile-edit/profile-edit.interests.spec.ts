import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

// The client's interests are written the moment they change: adding one and leaving the page used to lose it (it waited for the form's own save).
async function mount(updateProfile: (...a: any[]) => any, interests: string[] = ['تصميم']) {
	await TestBed.configureTestingModule({
		imports: [ProfileEdit],
		providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
			{ provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: { settings: {} } }), updatePreferences: vi.fn() } },
			{ provide: ProfileApiService, useValue: { getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co', phoneNumber: '+966551234567', country: 'السعودية', city: 'الرياض', interests }, latestHistory: [] } }), getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }), updateTab: vi.fn(), updateProfile }
			}],
	}).compileComponents();
	const f = TestBed.createComponent(ProfileEdit);
	f.detectChanges();
	return { f, c: f.componentInstance as any };
}
const input = (value: string) => { const el = document.createElement('input'); el.value = value; return el; };

describe('client profile-edit: interests are saved immediately', () => {
	afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

	it('adding an interest sends ONLY the interests list at once and confirms it', async () => {
		const updateProfile = vi.fn(() => of({ success: true }));
		const { c } = await mount(updateProfile);
		const box = input('برمجة');
		c.addInterest(box);
		expect(updateProfile).toHaveBeenCalledTimes(1);
		expect(updateProfile).toHaveBeenCalledWith({ interests: ['تصميم', 'برمجة'] });
		expect(c.interests()).toEqual(['تصميم', 'برمجة']);
		expect(box.value).toBe('');
		expect(c.successMsg()).toBe('تم حفظ الاهتمامات');
	});

	it('removing one is saved at once too', async () => {
		const updateProfile = vi.fn(() => of({ success: true }));
		const { c } = await mount(updateProfile, ['تصميم', 'برمجة']);
		c.removeInterest('تصميم');
		expect(updateProfile).toHaveBeenCalledWith({ interests: ['برمجة'] });
		expect(c.interests()).toEqual(['برمجة']);
	});

	it('a duplicate or empty entry sends nothing', async () => {
		const updateProfile = vi.fn(() => of({ success: true }));
		const { c } = await mount(updateProfile);
		c.addInterest(input('تصميم')); c.addInterest(input('   '));
		expect(updateProfile).not.toHaveBeenCalled();
	});

	it('a refused save puts the list back to what is stored and says why (never a silent loss)', async () => {
		const updateProfile = vi.fn(() => throwError(() => ({ status: 500, error: { message: 'خطأ في الخادم' } })));
		const { c } = await mount(updateProfile);
		c.addInterest(input('برمجة'));
		expect(c.interests()).toEqual(['تصميم']);
		expect(c.errorMsg()).not.toBe('');
		expect(c.interestsSaving()).toBe(false);
	});

	it('the form\'s own save does not report an interest that was already saved as an unsaved change', async () => {
		const updateProfile = vi.fn(() => of({ success: true }));
		const { c } = await mount(updateProfile);
		c.addInterest(input('برمجة'));
		updateProfile.mockClear();
		c.saveProfile();
		expect(updateProfile).not.toHaveBeenCalled();
		expect(c.noChangeMsg()).toBe('لا توجد تغييرات للحفظ');
	});
});
