import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountService } from '../../core/services/account.service';
import { AuthStore } from '../../core/store/auth.store';
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
    const fillProvider = () => { c.ctl.chType.setValue('YouTube'); }; // a flow with a panel of its own (the provider flow has none: its wizard collects the rest)
    const toStep = (type: string, idx: number) => { c.selectType(type); c.stepIdx.set(idx); render(); };

    it('adding a provider account sends it straight away and moves into the provider panel (its wizard does the rest)', () => {
      const switchActiveRole = TestBed.inject(AccountService).switchActiveRole as ReturnType<typeof vi.fn>;
      switchActiveRole.mockReturnValue(of({ success: true }));
      c.selectType('provider-ind'); c.stepIdx.set(1);
      c.submit();
      expect(add).toHaveBeenCalledTimes(1);
      expect(add.mock.calls[0][0]).toBe('PROVIDER');
      expect(switchActiveRole).toHaveBeenCalledWith('PROVIDER');
    });

    it('the provider flow is two steps (type, send): the specialties, skills and models are collected by the provider wizard, not here', () => {
      c.selectType('provider-ind'); render();
      expect(c.flow().map(f => f.id)).toEqual(['panel-1', 'panel-review']);
    });

    it('affiliate: the flow is two steps and sending it adds the marketer account and moves into its panel (its setup page collects the channel)', () => {
      (TestBed.inject(AccountService).switchActiveRole as ReturnType<typeof vi.fn>).mockReturnValue(of({ success: true }));
      c.selectType('affiliate'); render();
      expect(c.flow().map(f => f.id)).toEqual(['panel-1', 'panel-review']);
      c.stepIdx.set(1); c.submit();
      expect(add).toHaveBeenCalledWith('AFFILIATE', expect.anything());
      expect(TestBed.inject(AccountService).switchActiveRole).toHaveBeenCalledWith('AFFILIATE');
    });

    it('409 "already owned" shows the Arabic server message, refreshes the owned roles, no English', () => {
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'أنت تمتلك هذا الحساب بالفعل' } })));
      c.selectType('affiliate'); fillProvider(); c.stepIdx.set(1);
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
      c.selectType('affiliate'); fillProvider(); c.stepIdx.set(1);
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
      c.selectType('affiliate'); fillProvider(); c.stepIdx.set(1);
      add.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0, error: null })));
      c.submit();
      expect(c.errorMessage()).not.toMatch(/[A-Za-z]/);
      spy.mockRestore();
    });

    it('the submit button is never disabled by validity (only while submitting)', () => {
      c.selectType('affiliate'); c.stepIdx.set(1); render();
      const btn = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('إرسال الطلب')) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

  });
}
