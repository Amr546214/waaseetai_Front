import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminAiService } from './admin-ai.service';
import { AdminConsoleApiService } from './admin-console-api.service';
import { LoadingService } from './loading.service';
import { loadingInterceptor } from '../interceptors/loading.interceptor';

describe('admin audit page: background analysis does not block navigation', () => {
  it('keeps the global overlay off with the AI response pending while audit data returns', () => {
    TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([loadingInterceptor])),provideHttpClientTesting()]});
    const http=TestBed.inject(HttpTestingController), loading=TestBed.inject(LoadingService);
    const ai=TestBed.inject(AdminAiService), api=TestBed.inject(AdminConsoleApiService);
    ai.getAnomalySummary().subscribe(); api.getAuditLog({page:1}).subscribe(); api.getAdmins().subscribe();
    const analysis=http.expectOne(r=>r.url.endsWith('/anomaly-summary'));
    http.expectOne(r=>r.url.endsWith('/audit-log')).flush({success:true,data:{items:[]}});
    http.expectOne(r=>r.url.endsWith('/admins')).flush({success:true,data:[]});
    expect(loading.isLoading()).toBe(false);
    analysis.flush({success:true,data:{status:'READY'}}); http.verify();
  });
});
