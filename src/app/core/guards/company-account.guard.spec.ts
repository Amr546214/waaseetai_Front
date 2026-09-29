import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { companyAccountGuard } from './company-account.guard';
import { AuthStore } from '../store/auth.store';
import { AccountType } from '../models/auth.model';

describe('companyAccountGuard', () => {
  const currentUser = signal<any>(null);

  function setup(accountType: AccountType | null, platform = 'browser') {
    currentUser.set(accountType ? { accountType } : null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AuthStore, useValue: { isInitialized$: new BehaviorSubject(true), currentUser } },
      ],
    });
  }

  function run(data: Record<string, unknown> = { companyFallback: '/provider-overview/marketing/center' }) {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => companyAccountGuard(route, {} as RouterStateSnapshot));
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('lets a PROVIDER_COMPANY account through', async () => {
    setup(AccountType.PROVIDER_COMPANY);
    expect(await run()).toBe(true);
  });

  it('redirects a PROVIDER_INDIVIDUAL account to the configured fallback', async () => {
    setup(AccountType.PROVIDER_INDIVIDUAL);
    const result = await run();
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/provider-overview/marketing/center');
  });

  it('redirects when no user is loaded, defaulting to /provider-overview', async () => {
    setup(null);
    const result = await run({});
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/provider-overview');
  });

  it('does not block during server-side rendering', async () => {
    setup(AccountType.PROVIDER_INDIVIDUAL, 'server');
    expect(await run()).toBe(true);
  });
});
