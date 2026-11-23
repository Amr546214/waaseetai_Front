import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { SebBrowserProofService } from '../services/seb-browser-proof.service';
import { sebEntryGuard } from './seb-entry.guard';

function setup(native: boolean) {
  TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),{provide:SebBrowserProofService,useValue:{isSebBrowser:()=>native}}]});
  const result=TestBed.runInInjectionContext(()=>sebEntryGuard({} as any,{} as any));
  return {result:isObservable(result)?firstValueFrom(result):Promise.resolve(result),http:TestBed.inject(HttpTestingController),router:TestBed.inject(Router)};
}
afterEach(()=>{TestBed.inject(HttpTestingController).verify();TestBed.resetTestingModule();});
it('ordinary browser can prepare its profile and specialties without SEB',async()=>{const s=setup(false);expect(await s.result).toBe(true);s.http.expectNone(()=>true);});
it.each([
 [true,'PENDING',true], [false,'PENDING',true], [true,'COMPLETED',false],
])('native entry resolves incomplete preparation or setup test from the server (%s/%s/%s)',async(complete,status,canAdvance)=>{
 const s=setup(true);
 s.http.expectOne(r=>r.url.endsWith('/provider/profile/setup')).flush({data:{isProfileSetupComplete:complete,setupTestStatus:status}});
 s.http.expectOne(r=>r.url.endsWith('/setup/identity')).flush({data:{canAdvance}});
 expect(s.router.serializeUrl(await s.result as any)).toBe('/provider-overview/profile/setup?prepareExam=1');
});
it('a completed profile with current identity may enter specialty exams; proof is still enforced by APIs',async()=>{
 const s=setup(true);
 s.http.expectOne(r=>r.url.endsWith('/provider/profile/setup')).flush({data:{isProfileSetupComplete:true,setupTestStatus:'COMPLETED'}});
 s.http.expectOne(r=>r.url.endsWith('/setup/identity')).flush({data:{canAdvance:true}});
 expect(await s.result).toBe(true);
});
