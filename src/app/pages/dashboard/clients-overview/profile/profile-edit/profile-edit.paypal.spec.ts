import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client profile/edit, PayPal tab: PayPal is the only receiving method and the backend stores it (PUT /profiles/update/banking).
describe('client profile-edit: PayPal-only receiving method', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let http: HttpTestingController;
  let updateTab: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateTab = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        {
          provide: ProfileApiService,
          useValue: {
            getMyProfile: () => of({ success: true, data: { currentProfileData: {}, latestHistory: [] } }),
            getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }),
            updateTab,
            updateProfile: vi.fn(() => of({ success: true })),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    component.switchTab('banking');
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('a saved address (GET returns paypalPayoutEmail) prefills the field', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: ProfileApiService, useValue: {
          getMyProfile: () => of({ success: true, data: { currentProfileData: { paypalPayoutEmail: 'saved@example.com' }, latestHistory: [] } }),
          getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }), updateTab, updateProfile: vi.fn(() => of({ success: true })),
        } },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(ProfileEdit);
    f.detectChanges();
    expect(f.componentInstance.bankingForm.get('paypalEmail')!.value).toBe('saved@example.com');
  });

  it('a server error is shown in Arabic and the form keeps the typed value', () => {
    updateTab.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Internal Server Error' } })));
    component.bankingForm.get('paypalEmail')!.setValue('name@example.com');
    component.saveTab('banking');
    expect(component.errorMsg()).not.toMatch(/Internal Server Error/);
    expect(component.bankingForm.get('paypalEmail')!.value).toBe('name@example.com');
  });

  it('an invalid email is rejected before anything else', () => {
    component.bankingForm.get('paypalEmail')!.setValue('nope');
    component.saveTab('banking');
    expect(updateTab).not.toHaveBeenCalled();
    expect(component.errorMsg()).toContain('PayPal');
  });
});
