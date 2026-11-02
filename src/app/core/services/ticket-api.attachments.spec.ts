import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TicketApiService } from './ticket-api.service';
import { environment } from '../../../environments/environment';
describe('ticket attachment contract', () => {
  it('sends actual files and fields together; the no-file JSON contract remains supported', () => {
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    const api=TestBed.inject(TicketApiService), http=TestBed.inject(HttpTestingController);
    const payload={subject:'مشكلة',category:'دعم',description:'تفاصيل المشكلة',submissionKey:crypto.randomUUID()};
    const file=new File(['%PDF-1.4'],'proof.pdf',{type:'application/pdf'});
    api.createTicket('provider',payload,[file]).subscribe(); const r=http.expectOne(`${environment.url_api}/provider/tickets`);
    expect(r.request.body instanceof FormData).toBe(true); expect(r.request.body.get('description')).toBe(payload.description);
    expect(r.request.body.get('submissionKey')).toBe(payload.submissionKey); expect(r.request.body.get('attachments').name).toBe('proof.pdf');
    r.flush({success:true,data:{id:'t1'}});
    api.createTicket('client',payload).subscribe(); const plain=http.expectOne(`${environment.url_api}/client/tickets`); expect(plain.request.body).toEqual(payload); plain.flush({success:true,data:{id:'t2'}});http.verify();
  });
});
