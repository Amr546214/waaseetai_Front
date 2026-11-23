import { inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SebBrowserProofService } from '../services/seb-browser-proof.service';
import { IdentityGateState } from '../services/identity-gate.service';
import { SKIP_GET_CACHE } from '../interceptors/get-cache.interceptor';

/** The unchanged SEB file opens specialties. Onboarding's test lives in the setup
 * wizard instead. Resolve that from fresh server data, never this browser's draft.
 * Browser detection selects a screen only; all exam APIs still require server proof. */
export const sebEntryGuard: CanActivateFn = () => {
  if (!inject(SebBrowserProofService).isSebBrowser()) return true;
  const http = inject(HttpClient); const router = inject(Router);
  const setup = () => router.parseUrl('/provider-overview/profile/setup?prepareExam=1');
  const context = new HttpContext().set(SKIP_GET_CACHE, true);
  return forkJoin({
    profile: http.get<{data: {isProfileSetupComplete?: boolean; setupTestStatus?: string}}>(`${environment.url_api}/provider/profile/setup`, {context}),
    identity: http.get<{data: IdentityGateState}>(`${environment.url_api}/provider/profile/setup/identity`, {context}),
  }).pipe(map(({profile, identity}) => profile.data?.isProfileSetupComplete === true && profile.data?.setupTestStatus === 'COMPLETED' && identity.data?.canAdvance === true ? true : setup()), catchError(() => of(setup())));
};
