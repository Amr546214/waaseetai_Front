import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CaseAttachments } from './case-attachments';
import { environment } from '../../../environments/environment';

describe('case files: real API confirmation and private access', () => {
  let http: HttpTestingController;
  let c: CaseAttachments;
  const base = `${environment.url_api}/provider/disputes/d1/attachments`;
  const row = { id:'f1',name:'دليل.pdf',mimeType:'application/pdf',bytes:80,ownerId:'u1',createdAt:'2026-11-02' };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports:[CaseAttachments], providers:[provideHttpClient(),provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(CaseAttachments); c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController); c.path = 'provider/disputes/d1'; c.writable = true;
    c.ngOnChanges(); http.expectOne(base).flush({success:true,data:[]});
  });
  afterEach(() => http.verify());
  const choose = (files: File[]) => c.select({ target: { files, value:'chosen' } } as unknown as Event);
  it('waits for saved server metadata; double click is one request and selections clear only on confirmed success', () => {
    choose([new File(['%PDF-1.4'],'دليل.pdf',{type:'application/pdf'})]);
    c.upload(); c.upload(); expect(c.saved()).toBe(false); expect(c.selected.length).toBe(1);
    const req = http.expectOne(base); expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.getAll('attachments').length).toBe(1); expect(req.request.body.get('requestKey')).toMatch(/^[a-f\d-]{36}$/);
    req.flush({success:true,data:[row]}); expect(c.files()).toEqual([row]); expect(c.saved()).toBe(true); expect(c.selected).toEqual([]);
  });
  it('failed save preserves files and the retry key, without a fake success', () => {
    choose([new File(['%PDF-1.4'],'proof.pdf',{type:'application/pdf'})]); c.upload();
    const first = http.expectOne(base); const key = first.request.body.get('requestKey');
    first.flush({message:'تعذر التخزين'},{status:500,statusText:'Error'});
    expect(c.selected.length).toBe(1); expect(c.saved()).toBe(false); expect(c.actionError()).toContain('تعذر التخزين');
    c.upload(); const retry = http.expectOne(base); expect(retry.request.body.get('requestKey')).toBe(key); retry.flush({success:true,data:[row]});
  });
  it('rejects invalid types, size, count and zero bytes before sending; read-only never posts', () => {
    choose([new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})]); expect(c.selected).toEqual([]);
    choose([new File([],'empty.pdf',{type:'application/pdf'})]); expect(c.selected).toEqual([]);
    choose(Array.from({length:6},()=>new File(['a'],'a.pdf',{type:'application/pdf'}))); expect(c.selected).toEqual([]);
    choose([new File([new Uint8Array(10485761)],'large.pdf',{type:'application/pdf'})]); expect(c.selected).toEqual([]);
    choose([new File(['x'],'valid.pdf',{type:'application/pdf'})]); c.writable=false; c.upload(); http.expectNone(base);
  });
  it('refetches stored files after navigation and displays load failure separately from empty state', () => {
    c.load(); http.expectOne(base).flush({success:true,data:[row]}); expect(c.files()).toEqual([row]);
    c.load(); http.expectOne(base).flush({}, {status:503,statusText:'Unavailable'});
    expect(c.loadError()).not.toBe(''); expect(c.files()).toEqual([row]);
  });
  it('a closed/unauthorised response keeps the selected evidence and does not report success', () => {
    choose([new File(['x'],'proof.pdf',{type:'application/pdf'})]); c.upload();
    http.expectOne(base).flush({message:'لا يمكن إضافة أدلة إلى نزاع مغلق'},{status:409,statusText:'Conflict'});
    expect(c.saved()).toBe(false); expect(c.selected.length).toBe(1); expect(c.actionError()).toContain('مغلق');
  });
  it('requests a short-lived download through the authorised case endpoint, never a token in the URL', () => {
    const replace = vi.fn(); const close = vi.fn(); const popup = vi.spyOn(window,'open').mockReturnValue({opener:null,location:{replace},close} as unknown as Window);
    c.open(row); const req = http.expectOne(`${base}/f1/download`);
    req.flush({success:true,data:{url:'https://res.cloudinary.com/test/image/authenticated/proof.pdf',expiresAt:123}});
    expect(replace).toHaveBeenCalledWith('https://res.cloudinary.com/test/image/authenticated/proof.pdf'); popup.mockRestore();
  });
});
