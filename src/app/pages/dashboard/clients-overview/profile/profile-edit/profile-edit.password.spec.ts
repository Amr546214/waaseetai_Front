import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client security tab: a password change is a REQUEST for the admin (the password does not change now). Real validation, live strength, pending state.
describe('client profile-edit: password change request', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let c: ProfileEdit;
  let requestPasswordChange: ReturnType<typeof vi.fn>;
  let pendingRows: any[];

  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const type = (id: string, value: string) => { const i = el().querySelector<HTMLInputElement>(id)!; i.value = value; i.dispatchEvent(new Event('input')); render(); };
  const blur = (id: string) => { el().querySelector<HTMLInputElement>(id)!.dispatchEvent(new Event('blur')); render(); };
  const submit = () => { (q('[data-testid="pw-submit"]') as HTMLButtonElement).click(); render(); };

  async function setup(opts: { api?: any; pending?: any[] } = {}) {
    pendingRows = opts.pending ?? [];
    requestPasswordChange = vi.fn(opts.api ?? (() => of({ success: true, data: { id: 'req-1' } })));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: ProfileApiService, useValue: {
          getMyProfile: () => of({ success: true, data: { currentProfileData: {}, latestHistory: [] } }),
          getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: pendingRows }),
          updateTab: vi.fn(() => of({ success: true })), updateProfile: vi.fn(() => of({ success: true })), requestPasswordChange,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    c = fixture.componentInstance;
    fixture.detectChanges();
    c.switchTab('security'); c.isChangingPassword.set(true); render();
  }
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });
  const fillValid = () => { type('#pw-current', 'OldPass123'); type('#pw-new', 'NewPass456'); type('#pw-confirm', 'NewPass456'); };

  it('the checklist and the strength bar change live: weak -> rules fail, strong -> all pass', async () => {
    await setup();
    expect(q('[data-testid="pw-rules"]')).not.toBeNull();
    type('#pw-new', 'abc');
    expect(Array.from(el().querySelectorAll('[data-testid="pw-rules"] li')).map(li => li.getAttribute('data-ok'))).toEqual(['false', 'false', 'false']);
    expect(Number(q('[data-testid="pw-strength-bar"]')!.getAttribute('data-score'))).toBeLessThanOrEqual(1);
    expect(q('[data-testid="pw-strength-label"]')!.textContent).toContain('ضعيفة');
    type('#pw-new', 'Abcdefg1');
    expect(Array.from(el().querySelectorAll('[data-testid="pw-rules"] li')).every(li => li.getAttribute('data-ok') === 'true')).toBe(true);
    const mid = Number(q('[data-testid="pw-strength-bar"]')!.getAttribute('data-score'));
    type('#pw-new', 'Abcdefg1!xyz');
    expect(Number(q('[data-testid="pw-strength-bar"]')!.getAttribute('data-score'))).toBeGreaterThan(mid - 1);
    expect(Number(q('[data-testid="pw-strength-bar"]')!.getAttribute('data-score'))).toBe(4);
    expect(q('[data-testid="pw-strength-label"]')!.textContent).toContain('قوية');
  });

  it('a weak password is blocked: the field names the problem after blur/submit and the API is never called', async () => {
    await setup();
    type('#pw-current', 'OldPass123'); type('#pw-new', 'weak'); type('#pw-confirm', 'weak');
    expect(q('[data-testid="pw-new-error"]')).toBeNull();              // typing alone shows nothing
    blur('#pw-new');
    expect(q('[data-testid="pw-new-error"]')!.textContent).toContain('لا تستوفي الشروط');
    submit();
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it('a mismatching confirmation shows its error and sends nothing; a missing current password too', async () => {
    await setup();
    type('#pw-new', 'NewPass456'); type('#pw-confirm', 'Different123');
    submit();
    expect(q('[data-testid="pw-confirm-error"]')!.textContent).toContain('غير مطابق');
    expect(q('[data-testid="pw-current-error"]')!.textContent).toContain('مطلوبة');
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it('the new password equal to the current one is refused locally', async () => {
    await setup();
    type('#pw-current', 'SamePass123'); type('#pw-new', 'SamePass123'); type('#pw-confirm', 'SamePass123');
    submit();
    expect(q('[data-testid="pw-new-error"]')!.textContent).toContain('تختلف عن الحالية');
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it('a valid submit calls the endpoint, shows "تم إرسال طلب تغيير كلمة المرور للمراجعة", clears the fields only now and switches to the pending state', async () => {
    await setup();
    fillValid();
    submit();
    expect(requestPasswordChange).toHaveBeenCalledWith({ currentPassword: 'OldPass123', newPassword: 'NewPass456', confirmPassword: 'NewPass456' });
    expect(q('[data-testid="pw-success"]')!.textContent).toContain('تم إرسال طلب تغيير كلمة المرور للمراجعة');
    expect(q('[data-testid="pw-pending"]')!.textContent).toContain('قيد المراجعة');
    expect(c.passwordForm.value).toEqual({ currentPassword: '', newPassword: '', confirmPassword: '' });
    expect((q('[data-testid="pw-submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el().querySelector('a[href$="/client-overview/profile/requests"]')).not.toBeNull();
  });

  it('a pending request loaded from the server disables sending (no duplicate) and says so', async () => {
    await setup({ pending: [{ id: 'p1', category: 'CLIENT_PASSWORD_CHANGE', status: 'PENDING_HUMAN_REVIEW' }] });
    expect(q('[data-testid="pw-pending"]')!.textContent).toContain('طلب تغيير كلمة المرور قيد المراجعة');
    expect((q('[data-testid="pw-submit"]') as HTMLButtonElement).disabled).toBe(true);
    fillValid(); c.submitPasswordChange();
    expect(requestPasswordChange).not.toHaveBeenCalled();
  });

  it('a failed request keeps the typed fields and shows no success; a wrong current password lands on the current-password field', async () => {
    await setup({ api: () => throwError(() => new HttpErrorResponse({ status: 400, error: { success: false, message: 'كلمة المرور الحالية غير صحيحة' } })) });
    fillValid(); submit();
    expect(q('[data-testid="pw-success"]')).toBeNull();
    expect(q('[data-testid="pw-pending"]')).toBeNull();
    expect(q('[data-testid="pw-current-error"]')!.textContent).toContain('الحالية غير صحيحة');
    expect(c.passwordForm.value.newPassword).toBe('NewPass456');          // not cleared
  });

  it('a 409 (already pending) shows the pending state, never a success', async () => {
    await setup({ api: () => throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'طلب تغيير كلمة المرور قيد المراجعة بالفعل' } })) });
    fillValid(); submit();
    expect(q('[data-testid="pw-success"]')).toBeNull();
    expect(q('[data-testid="pw-pending"]')!.textContent).toContain('قيد المراجعة');
    expect((q('[data-testid="pw-submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('typing is never blocked: the fields keep what is typed and there is no always-disabled "coming soon" button', async () => {
    await setup();
    type('#pw-new', 'a');
    expect((el().querySelector('#pw-new') as HTMLInputElement).value).toBe('a');
    expect(q('[data-testid="security-disabled-reason"]')).toBeNull();
  });
});
