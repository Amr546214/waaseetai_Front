import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

// D-CM5 (marketer page): an avatar pick / removal saves only the marketing profile and never touches the alert / notification settings.
describe('marketer profile data: avatar actions never write notification settings', () => {
  const SETTINGS = { inApp: true, email: false, newReferral: true, newCommission: true, communicationLanguage: 'ar', timezone: null };
  let updateMarketingInfo: ReturnType<typeof vi.fn>;
  let updateMarketerSettings: ReturnType<typeof vi.fn>;
  let updatePreferences: ReturnType<typeof vi.fn>;
  let component: Data;

  beforeEach(async () => {
    updateMarketingInfo = vi.fn(() => of({ success: true }));
    updateMarketerSettings = vi.fn(() => of({ success: true, data: SETTINGS }));
    updatePreferences = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: NotificationPreferencesService, useValue: { getPreferences: vi.fn(), updatePreferences } },
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }), getSettings: () => of({ success: true, data: SETTINGS }), updateMarketerSettings } },
        { provide: MarketerProfileService, useValue: { getProfile: () => of({ success: true, data: { avatarUrl: 'https://x/old.png', bio: '', user: {} } }), updateMarketingInfo } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('picking an avatar sends one marketing-info save and no settings / preferences write', async () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })] });
    component.onAvatarChange({ target: input } as unknown as Event);
    await vi.waitFor(() => expect(updateMarketingInfo).toHaveBeenCalledTimes(1));
    expect(updateMarketerSettings).not.toHaveBeenCalled();
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('removing the avatar and cancelling the dialog write no settings / preferences either', () => {
    component.removeAvatar();
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [] });
    component.onAvatarChange({ target: input } as unknown as Event);
    expect(updateMarketingInfo).toHaveBeenCalledTimes(1);
    expect(updateMarketerSettings).not.toHaveBeenCalled();
    expect(updatePreferences).not.toHaveBeenCalled();
  });
});
