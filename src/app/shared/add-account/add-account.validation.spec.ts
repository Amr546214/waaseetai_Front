import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountService } from '../../core/services/account.service';
import { AuthStore } from '../../core/store/auth.store';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { AddAccount as ClientAddAccount } from '../../pages/dashboard/clients-overview/profile/add-account/add-account';
import { AddAccount as ProviderAddAccount } from '../../pages/dashboard/provider-overview/profile/add-account/add-account';
import { AddAccount as MarketerAddAccount } from '../../pages/dashboard/marketer-overview/profile/add-account/add-account';
import { AddAccountBase } from './add-account.base';

const FIXED = 'تعذر إرسال طلب إضافة الحساب. حاول مرة أخرى أو تواصل مع الدعم.';

// The same wizard exists on the client, provider and marketer dashboards: every one must behave identically.
for (const [name, Cmp] of [['client', ClientAddAccount], ['provider', ProviderAddAccount], ['marketer', MarketerAddAccount]] as const) {
  describe(`add-account wizard (${name}): shared validation`, () => {
    let fixture: ComponentFixture<AddAccountBase>;
    let c: AddAccountBase;
    let add: ReturnType<typeof vi.fn>;
    let getTypes: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      add = vi.fn(() => of({ success: true, message: 'ok', data: {} }));
      getTypes = vi.fn(() => of({ success: true, data: { ownedRoles: ['CLIENT'], activeRole: 'CLIENT' } }));
      TestBed.configureTestingModule({
        imports: [Cmp],
        providers: [
          provideRouter([]),
          { provide: AccountService, useValue: { getAvailableAccountTypes: getTypes, addAccountType: add, switchActiveRole: vi.fn() } },
          { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT'] }) } },
          { provide: NotificationEngineService, useValue: { triggerToast: vi.fn() } },
        ],
      });
      fixture = TestBed.createComponent(Cmp) as ComponentFixture<AddAccountBase>;
      c = fixture.componentInstance;
      fixture.detectChanges();
      window.scrollTo = vi.fn() as any;
    });

    const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
    const el = () => fixture.nativeElement as HTMLElement;
    const summary = () => el().querySelector('[data-testid="form-summary"]')?.textContent || '';
    const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent || '');
    const banner = () => el().querySelector('[data-testid="add-account-error"]')?.textContent || '';
    const fillProvider = () => { c.ctl.specMain.setValue('تصميم جرافيك وبصري'); c.ctl.portfolioBio.setValue('نبذة مهنية'); };
    const toStep = (type: string, idx: number) => { c.selectType(type); c.stepIdx.set(idx); render(); };

    it('Next on an empty specialties step: stays, summary names the field, inline error, focus on it', () => {
      document.body.appendChild(el());
      c.selectType('provider-ind'); render();
      c.nextStep(); render();
      expect(c.stepIdx()).toBe(1);
      expect(summary()).toContain('التخصص الرئيسي');
      expect(errors().some(t => t.length > 0)).toBe(true);
      expect(document.activeElement?.tagName).toBe('SELECT');
      el().remove();
    });

    it('the bio step blocks an empty / whitespace-only bio and a bio over 1000 characters', () => {
      c.selectType('provider-ind'); c.ctl.specMain.setValue('x'); c.nextStep(); render();
      expect(c.stepIdx()).toBe(2);
      c.ctl.portfolioBio.setValue('   '); c.nextStep(); render();
      expect(c.stepIdx()).toBe(2);
      expect(summary()).toContain('النبذة المهنية');
      c.ctl.portfolioBio.setValue('x'.repeat(1001)); c.nextStep(); render();
      expect(c.stepIdx()).toBe(2);
      expect(errors().some(t => t.includes('1000'))).toBe(true);
    });

    it('affiliate: the main channel type is required before moving on', () => {
      c.selectType('affiliate'); render();
      c.nextStep(); render();
      expect(c.stepIdx()).toBe(1);
      expect(summary()).toContain('نوع القناة الرئيسية');
      c.ctl.chType.setValue('YouTube'); c.nextStep();
      expect(c.stepIdx()).toBe(2);
      expect(c.missing()).toEqual([]);
    });

    it('affiliate: a complete wizard sends AFFILIATE', () => {
      c.selectType('affiliate'); c.ctl.chType.setValue('YouTube'); c.stepIdx.set(2);
      c.submit();
      expect(add).toHaveBeenCalledWith('AFFILIATE', expect.objectContaining({ chType: 'YouTube' }));
    });

    it('submit from the review step with an incomplete earlier step jumps back to it with the full summary; nothing is sent', () => {
      vi.useFakeTimers();
      c.selectType('provider-ind'); c.stepIdx.set(3); render();
      c.submit(); vi.advanceTimersByTime(100); render();
      expect(add).not.toHaveBeenCalled();
      expect(c.stepIdx()).toBe(1);
      expect(summary()).toContain('التخصص الرئيسي');
      vi.useRealTimers();
    });

    it('a complete wizard sends the same payload shape as before and reaches the success state', () => {
      c.selectType('provider-ind'); fillProvider(); c.stepIdx.set(3);
      c.submit();
      expect(add).toHaveBeenCalledTimes(1);
      const [role, meta] = add.mock.calls[0];
      expect(role).toBe('PROVIDER');
      expect(Object.keys(meta).sort()).toEqual(['chReach', 'chType', 'coCrn', 'coName', 'coRole', 'portfolioBio', 'skills', 'specExp', 'specMain']);
      expect(meta.specMain).toBe('تصميم جرافيك وبصري');
      expect(c.isSuccess()).toBe(true);
      expect(c.errorMessage()).toBeNull();
    });

    it('server 400 with errors[] puts the message under the field and returns to that step', () => {
      vi.useFakeTimers();
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { success: false, message: 'x', errors: [{ field: 'profileMetadata.portfolioBio', path: 'profileMetadata.portfolioBio', message: 'النبذة المهنية يجب ألا تتجاوز 1000 حرف', code: 'too_big' }] } })));
      c.selectType('provider-ind'); fillProvider(); c.stepIdx.set(3);
      c.submit(); vi.advanceTimersByTime(100); render();
      expect(c.stepIdx()).toBe(2);
      expect(c.ctl.portfolioBio.errors?.['server']).toContain('1000');
      expect(errors().some(t => t.includes('1000'))).toBe(true);
      expect(c.isSubmitting()).toBe(false);
      vi.useRealTimers();
    });

    it('409 "already owned" shows the Arabic server message, refreshes the owned roles, no English', () => {
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'أنت تمتلك هذا الحساب بالفعل' } })));
      c.selectType('provider-ind'); fillProvider(); c.stepIdx.set(3);
      getTypes.mockClear();
      c.submit(); render();
      expect(c.errorMessage()).toBe('أنت تمتلك هذا الحساب بالفعل');
      expect(banner()).toContain('تمتلك هذا الحساب');
      expect(getTypes).toHaveBeenCalledTimes(1);
      expect(c.isSubmitting()).toBe(false);
    });

    it('server 500 shows the fixed Arabic message, never "Internal Server Error"; details only in the console', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Internal Server Error' } })));
      c.selectType('provider-ind'); fillProvider(); c.stepIdx.set(3);
      c.submit(); render();
      expect(c.errorMessage()).toBe(FIXED);
      expect(banner()).toContain(FIXED);
      expect(el().textContent).not.toContain('Internal Server Error');
      expect(spy).toHaveBeenCalled();
      expect(c.isSubmitting()).toBe(false);
      spy.mockRestore();
    });

    it('a 500 whose Arabic message comes from the backend and a network failure are both Arabic', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      c.selectType('provider-ind'); fillProvider(); c.stepIdx.set(3);
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0, error: null })));
      c.submit();
      expect(c.errorMessage()).not.toMatch(/[A-Za-z]/);
      spy.mockRestore();
    });

    it('fields the backend does not store are disabled with a visible note (no fake input)', () => {
      c.selectType('provider-ind'); c.stepIdx.set(1); render();
      const disabledSelect = el().querySelector('select[disabled]');
      expect(disabledSelect).toBeTruthy();
      c.ctl.specMain.setValue('x'); c.nextStep(); render();
      expect(el().querySelector('input[type="url"]')?.hasAttribute('disabled')).toBe(true);
      expect(el().querySelector('input[type="file"]')?.hasAttribute('disabled')).toBe(true);
      expect(el().querySelectorAll('[data-testid="field-unsupported"]').length).toBeGreaterThanOrEqual(2);
    });

    it('the submit button is never disabled by validity (only while submitting)', () => {
      c.selectType('provider-ind'); c.stepIdx.set(3); render();
      const btn = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('إرسال الطلب')) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('going back clears the previous summary', () => {
      c.selectType('provider-ind'); c.nextStep();
      expect(c.missing().length).toBeGreaterThan(0);
      c.prevStep();
      expect(c.missing()).toEqual([]);
    });
  });
}
