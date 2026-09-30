import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

describe('Data', () => {
  let component: Data;
  let fixture: ComponentFixture<Data>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: {
          getSummary: () => of({ success: true, data: {} }),
          getChannelPerformance: () => of({ success: true, data: [] }),
          getRecentCommissions: () => of({ success: true, data: [] }),
        } },
        { provide: MarketerProfileService, useValue: { getProfile: () => of({ success: true, data: {} }) } },
        { provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: {} }), updatePreferences: () => of({ success: true, data: {} }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    component.activeTab.set('security');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regression coverage (Batch 3): the MFA row used to show a hardcoded
  // green "مفعلة" (enabled) badge with zero backend behind it (no
  // MFA/2FA/TOTP capability exists anywhere in the backend). It must now
  // render a truthful, non-interactive "unavailable" state instead, and
  // never a toggle/checkbox that could fake a successful enable/disable.
  describe('MFA — truthful unavailable state (no fake success)', () => {
    it('A) no longer claims "مفعّلة" for MFA', () => {
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).not.toContain('مفعلة');
      expect(text).toContain('غير متاح حاليًا');
    });

    it('B) has no interactive control (checkbox/switch/button) that could produce a fake success for MFA', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const badge = Array.from(el.querySelectorAll('span'))
        .find(node => node.textContent?.trim() === 'غير متاح حاليًا');
      expect(badge).toBeTruthy();
      // The row containing the badge (its immediate flex-container parent)
      // must have no checkbox/switch/button — only static text + the badge.
      const row = badge!.parentElement;
      expect(row?.querySelector('input[type="checkbox"]')).toBeNull();
      expect(row?.querySelector('button')).toBeNull();
    });
  });
});
