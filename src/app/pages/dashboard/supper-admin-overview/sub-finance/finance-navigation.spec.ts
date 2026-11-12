import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SUPPER_ADMIN_ROUTES } from '../supper-admin.routes';
import { SaSubFinance } from '../sa-sub-finance/sa-sub-finance';
import { SaInvoicesOut } from './sa-invoices-out/sa-invoices-out';
import { SaCommissions } from './sa-commissions/sa-commissions';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { LevelsService } from '../../../../core/levels/levels.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ConfirmModalComponent } from '../../../../sheards/confirm-modal/confirm-modal.component';
import { environment } from '../../../../../environments/environment';

const feeUrl=`${environment.url_api}/admin/fee-policy`;
const payload=()=>({providerCommissionByLevel:Array(15).fill(10),clientCashbackByLevel:Array(15).fill(1),marketerCommissionByLevel:Array(15).fill(2),depositFeePercent:{mada:1,visa_mastercard:1,paypal:1,international_transfer:1,other:1},marketerWithdrawalFeePercent:{bank_transfer:1,paypal:1,usdt:1},minMarketerPayout:300,minProviderPayout:0});
const policy=()=>({success:true,data:{active:{id:'v4',version:4,effectiveFrom:'2026-01-01T00:00:00Z',payload:payload(),state:'EFFECTIVE'},upcoming:[],history:[],limits:{minLeadMinutes:15,maxLeadDays:366},now:new Date().toISOString()}});
const finance=()=>({currency:'USD',totals:{escrowHeldCount:0,escrowHeldAmount:0,releasedGross:0,platformCommission:0,providerNetReleased:0,depositsCount:0,depositsAmount:0,paymentGatewayFees:0},withdrawals:{},affiliateCommissions:{},series:[]});
const input=(h:RouterTestingHarness,selector:string,value:string)=>{const el=h.routeNativeElement!.querySelector<HTMLInputElement>(selector)!;el.value=value;el.dispatchEvent(new Event('input'));h.detectChanges();};

describe('finance navigation and commission structure workflow',()=>{
  let http:HttpTestingController;
  let ops:any;
  beforeEach(()=>{
    ops={financeOverview:vi.fn(()=>of({success:true,data:finance()})),financeTransactions:vi.fn(()=>of({success:true,data:{items:[]}})),financeInvoices:vi.fn(()=>of({success:true,data:{currency:'USD',summary:{totalCount:0,paidCount:0,dueCount:0,paidTotal:0,dueTotal:0,platformCommission:0},items:[],pagination:{page:1,total:0,totalPages:1}}})),financeCommissions:vi.fn(()=>of({success:true,data:null}))};
    TestBed.configureTestingModule({providers:[provideRouter([{path:'supper-admin-overview',children:SUPPER_ADMIN_ROUTES}]),provideHttpClient(),provideHttpClientTesting(),{provide:AdminOpsApiService,useValue:ops},{provide:LevelsService,useValue:{payload:signal(null),ensureLoaded:()=>{}}}]});
    http=TestBed.inject(HttpTestingController);setAccess(true,[]);
  });
  afterEach(()=>{TestBed.inject(ConfirmModalService).reject();http.verify({ignoreCancelled:true});TestBed.resetTestingModule();document.body.style.overflow='';vi.restoreAllMocks();});
  function setAccess(superAdmin:boolean,permissions:string[]){const a=TestBed.inject(AdminAccessService);a.access.set({userId:'qa',isSuperAdmin:superAdmin,staffStatus:'ACTIVE',roleName:'QA',permissions,hasAnyPermission:true,state:superAdmin?'SUPER_ADMIN':'ACTIVE',displayRole:'QA'});a.status.set('ready');}

  it('clicking View invoices on the empty-child dashboard opens the real guarded invoice page',async()=>{
    const h=await RouterTestingHarness.create();await h.navigateByUrl('/supper-admin-overview/sub-finance',SaSubFinance);
    const link=h.routeNativeElement!.querySelector<HTMLAnchorElement>('[data-testid=sf-invoices-link]')!;
    expect(link.getAttribute('href')).toBe('/supper-admin-overview/sub-finance/invoices-out');
    link.click();await h.fixture.whenStable();h.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/supper-admin-overview/sub-finance/invoices-out');expect(h.routeNativeElement!.querySelector('h1')!.textContent).toContain('الفواتير الصادرة');expect(ops.financeInvoices).toHaveBeenCalledOnce();
  });
  it('the old bookmarked URL redirects to the canonical invoice page and keeps query parameters',async()=>{
    const h=await RouterTestingHarness.create();await h.navigateByUrl('/supper-admin-overview/invoices-out?source=bookmark',SaInvoicesOut);
    expect(TestBed.inject(Router).url).toBe('/supper-admin-overview/sub-finance/invoices-out?source=bookmark');expect(ops.financeInvoices).toHaveBeenCalledOnce();
  });
  it('the invoice redirect cannot bypass finance.read',async()=>{
    setAccess(false,['team.view']);const h=await RouterTestingHarness.create();await h.navigateByUrl('/supper-admin-overview/invoices-out');
    expect(TestBed.inject(Router).url).toContain('/supper-admin-overview/no-access');expect(ops.financeInvoices).not.toHaveBeenCalled();
  });
  async function openEditor(){
    const h=await RouterTestingHarness.create();await h.navigateByUrl('/supper-admin-overview/sub-finance/commissions',SaCommissions);
    h.routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid=cm-edit]')!.click();h.detectChanges();http.expectOne(feeUrl).flush(policy());await h.fixture.whenStable();h.detectChanges();
    return h;
  }
  it('the structure button edits actual rates, previews them in the real confirmation dialog, then schedules only the change',async()=>{
    const h=await openEditor();const modal=TestBed.createComponent(ConfirmModalComponent);modal.detectChanges();
    input(h,'input[aria-label="عمولة مقدم الخدمة المستوى 1"]','9.5');input(h,'[data-testid=fp-note]','تحديث العمولة للعمليات الجديدة');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid=fp-submit]')!.click();h.detectChanges();modal.detectChanges();
    http.expectNone(r=>r.method==='POST');expect(modal.nativeElement.textContent).toContain('المستوى 1');expect(modal.nativeElement.textContent).toContain('9.5');
    modal.nativeElement.querySelector('button.cm-btn-primary').click();await Promise.resolve();
    const req=http.expectOne(r=>r.url===feeUrl&&r.method==='POST');expect(req.request.body.changes).toEqual({providerCommissionByLevel:[9.5,...Array(14).fill(10)]});expect(req.request.body.baseVersion).toBe(4);expect(req.request.body.confirmSensitive).toBe(true);expect(Number.isNaN(new Date(req.request.body.effectiveFrom).getTime())).toBe(false);
    req.flush({success:true,data:{id:'v5',version:5,effectiveFrom:req.request.body.effectiveFrom,diff:[]}});await Promise.resolve();
    http.expectOne(feeUrl).flush(policy());await h.fixture.whenStable();h.detectChanges();expect(h.routeNativeElement!.textContent).toContain('جُدولت النسخة 5');
  });
  it('declining the structure confirmation writes nothing',async()=>{
    const h=await openEditor();input(h,'input[aria-label="عمولة مقدم الخدمة المستوى 1"]','9.5');input(h,'[data-testid=fp-note]','اختبار التراجع عن التعديل');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid=fp-submit]')!.click();TestBed.inject(ConfirmModalService).reject();await Promise.resolve();http.expectNone(r=>r.method==='POST');
  });
  it('read-only financial access does not expose the structure edit button',async()=>{
    setAccess(false,['finance.read']);const h=await RouterTestingHarness.create();await h.navigateByUrl('/supper-admin-overview/sub-finance/commissions',SaCommissions);
    expect(h.routeNativeElement!.querySelector('[data-testid=cm-edit]')).toBeNull();http.expectNone(feeUrl);
  });
});
