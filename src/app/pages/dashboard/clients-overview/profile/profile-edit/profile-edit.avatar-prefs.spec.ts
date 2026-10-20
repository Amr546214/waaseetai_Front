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

// D-CM5 / K-1 / K-2: the avatar is a draft saved with the form; notification preferences and the profile are written only when they changed.
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
    await vi.waitFor(() => expect(String(component.clientForm.get('avatarUrl')!.value)).toMatch(/^data:image\//));
  };
  const png = () => new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });

  it('the preferences are loaded for display only (GET), nothing is written on open', () => {
    expect(getPreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  // K-2: the avatar is part of the form save
  it('K-2: picking an avatar only previews it: no request at all until «حفظ التحديثات»', async () => {
    await pick(png());
    expect(updateProfile).not.toHaveBeenCalled();
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(component.getCurrentAvatarUrl()).toMatch(/^data:image\/png/);
  });

  it('K-2: Save then sends the new picture with the form (one PUT), still zero preferences requests when they did not change', async () => {
    await pick(png());
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(String(updateProfile.mock.calls[0][0].avatarUrl)).toMatch(/^data:image\/png/);
    expect(updateProfile.mock.calls[0][0].firstName).toBe('سارة');
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('K-2: removing the avatar is a draft too; Save sends avatarUrl "" with the rest', () => {
    component.removeAvatar();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(component.getCurrentAvatarUrl()).toBe('');
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile.mock.calls[0][0].avatarUrl).toBe('');
    expect(updateProfile.mock.calls[0][0].firstName).toBe('سارة');
  });

  it('K-2: cancel = leaving without Save: nothing was sent, so the saved avatar is untouched', async () => {
    await pick(png());
    component.removeAvatar();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('K-2: a rejected Save keeps the draft picture (retry possible) and shows the error', async () => {
    updateProfile.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'x' } })));
    await pick(png());
    component.saveProfile();
    expect(component.errorMsg()).not.toBe('');
    expect(String(component.getCurrentAvatarUrl())).toMatch(/^data:image\//);
  });

  it('cancelling the file dialog (no file) changes nothing', () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [] });
    component.onAvatarUpload({ target: input } as unknown as Event);
    expect(component.getCurrentAvatarUrl()).toBe('https://x/old.png');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  // K-1: preferences are written only when they changed
  it('K-1: Save with nothing changed sends no preferences PATCH and no empty profile PUT, and says «لا توجد تغييرات للحفظ» (no «updated successfully» for a save that wrote nothing)', () => {
    component.saveProfile();
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(component.noChangeMsg()).toBe('لا توجد تغييرات للحفظ');
    expect(component.successMsg()).toBe('');
  });

  it('K-1: a changed toggle sends the preferences once; the next Save with no change sends nothing', () => {
    component.notifEmail.set(true);
    component.saveProfile();
    expect(updatePreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({ channel_email: true, channel_in_app: true });
    component.saveProfile();
    expect(updatePreferences).toHaveBeenCalledTimes(1);
    component.notifEmail.set(false);
    component.saveProfile();
    expect(updatePreferences).toHaveBeenCalledTimes(2);
  });

  it('K-1: a failed preferences write keeps the reference, so the next Save retries it', () => {
    updatePreferences.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    component.notifInApp.set(false);
    component.saveProfile();
    expect(component.errorMsg()).toContain('تفضيلات');
    component.saveProfile();
    expect(updatePreferences).toHaveBeenCalledTimes(2);
    component.saveProfile();
    expect(updatePreferences).toHaveBeenCalledTimes(2);
  });

  it('K-1: a changed profile field sends one PUT (and no preferences); a second Save with no change sends nothing', () => {
    component.clientForm.patchValue({ firstName: 'ليلى' });
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updatePreferences).not.toHaveBeenCalled();
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(1);
  });

  it('K-1: a failed profile PUT keeps the reference: the same Save is sent again', () => {
    updateProfile.mockReturnValueOnce(throwError(() => ({ status: 500, error: { message: 'x' } })));
    component.clientForm.patchValue({ firstName: 'ليلى' });
    component.saveProfile();
    component.saveProfile();
    expect(updateProfile).toHaveBeenCalledTimes(2);
  });
});
