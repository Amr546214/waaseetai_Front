import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

// D-CM5: picking / replacing / removing an avatar must never touch the notification preferences (no PATCH /notifications/preferences, no implicit row).
describe('client profile-edit: avatar actions never write notification preferences', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let updateProfile: ReturnType<typeof vi.fn>;
  let updatePreferences: ReturnType<typeof vi.fn>;
  let getPreferences: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateProfile = vi.fn(() => of({ success: true }));
    updatePreferences = vi.fn(() => of({ success: true }));
    getPreferences = vi.fn(() => of({ success: true, data: { settings: {} } }));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: NotificationPreferencesService, useValue: { getPreferences, updatePreferences } },
        { provide: ProfileApiService, useValue: {
          getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co', avatarUrl: 'https://x/old.png' }, latestHistory: [] } }),
          getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }),
          updateTab: vi.fn(() => of({ success: true })), updateProfile,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  const pick = async (file: File) => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onAvatarUpload({ target: input } as unknown as Event);
    await vi.waitFor(() => expect(updateProfile).toHaveBeenCalled());
  };

  it('the preferences are loaded for display only (GET), nothing is written on open', () => {
    expect(getPreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('picking an avatar saves ONLY the avatar and sends zero preferences requests', async () => {
    await pick(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }));
    expect(updateProfile).toHaveBeenCalledTimes(1);
    const payload = updateProfile.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['avatarUrl']);
    expect(String(payload.avatarUrl)).toMatch(/^data:image\/png/);
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('replacing the avatar twice still sends zero preferences requests', async () => {
    await pick(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }));
    updateProfile.mockClear();
    await pick(new File([new Uint8Array(12)], 'b.jpg', { type: 'image/jpeg' }));
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('removing the avatar saves only { avatarUrl: "" } and no preferences', () => {
    component.removeAvatar();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile.mock.calls[0][0]).toEqual({ avatarUrl: '' });
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('cancelling the file dialog (no file) sends nothing at all', () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [] });
    component.onAvatarUpload({ target: input } as unknown as Event);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('a rejected avatar save puts the previous picture back and writes no preferences', async () => {
    updateProfile.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'x' } })));
    await pick(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }));
    expect(component.clientForm.get('avatarUrl')!.value).toBe('https://x/old.png');
    expect(component.errorMsg()).not.toBe('');
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('the explicit Save still stores the profile AND the channel toggles', () => {
    component.notifEmail.set(true);
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({ channel_email: true, channel_in_app: true });
  });
});
