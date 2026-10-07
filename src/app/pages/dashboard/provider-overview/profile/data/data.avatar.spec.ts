import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// #14 — the avatar is read from the provider profile (the user column is only a fallback) and is sent ONLY when the user changed it:
// an untouched avatar is never in the save body, and null is sent only for an explicit removal.
const PROFILE = {
	avatarUrl: 'https://res.cloudinary.com/c/image/upload/v1/waseetai/users/u1/avatar.png',
	headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: 'حي', hourlyRate: null, yearsOfExperience: null,
	completionPercentage: 90, missingItems: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [],
	user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', avatarUrl: 'https://legacy.example/user-avatar.png', idDocumentUrl: null, vatCertificateUrl: null },
	certUrls: [] as (string | null)[],
};

describe('provider profile data — avatar (#14)', () => {
	let fixture: ComponentFixture<Data>;
	let component: Data;
	let updateBasicInfo: ReturnType<typeof vi.fn>;

	const setup = (profile: any) => {
		updateBasicInfo = vi.fn(() => of({}));
		TestBed.configureTestingModule({
			imports: [Data],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } }, { provide: ProviderProfileService, useValue: {
				getProfile: vi.fn(() => of(profile)), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])), updateBasicInfo,
			} }],
		});
		fixture = TestBed.createComponent(Data);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('reads avatarUrl from the provider profile, not from the user', () => {
		setup(PROFILE);
		expect(component.avatarUrl()).toBe(PROFILE.avatarUrl);
	});

	it('falls back to the user column only when the provider profile has none', () => {
		setup({ ...PROFILE, avatarUrl: null });
		expect(component.avatarUrl()).toBe('https://legacy.example/user-avatar.png');
	});

	it('saving without touching the avatar does not send avatarUrl at all (never null)', () => {
		setup({ ...PROFILE, avatarUrl: null, user: { ...PROFILE.user, avatarUrl: null } });
		component.saveProfile();
		expect(updateBasicInfo).toHaveBeenCalledTimes(1);
		expect('avatarUrl' in updateBasicInfo.mock.calls[0][0]).toBe(false);
	});

	it('an explicit removal sends null; a newly picked image sends that image', () => {
		setup(PROFILE);
		component.removeAvatar();
		component.saveProfile();
		expect(updateBasicInfo.mock.calls[0][0].avatarUrl).toBeNull();
		component.avatarUrl.set('data:image/png;base64,AAAA');
		(component as any).avatarDirty = true;
		component.saveProfile();
		expect(updateBasicInfo.mock.calls.at(-1)![0].avatarUrl).toBe('data:image/png;base64,AAAA');
	});
});
