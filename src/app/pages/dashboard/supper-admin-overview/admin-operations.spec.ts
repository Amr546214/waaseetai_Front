import {AdminAccessService} from '../../../core/services/admin-access.service';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of,throwError} from 'rxjs';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {SaBroadcast} from './communication/sa-broadcast/sa-broadcast';
import {SaCashback} from './sub-finance/sa-cashback/sa-cashback';
import {AdminOperationsService} from '../../../core/services/admin-operations.service';
import {PublishedContentComponent} from '../../../shared/published-content/published-content.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
afterEach(()=>TestBed.resetTestingModule());
function setup<T>(component:new (...args:any[])=>T,data:unknown){const api={get:vi.fn(()=>of({success:true,data})),post:vi.fn(()=>of({success:true,data:{status:'PENDING'}}))};TestBed.configureTestingModule({imports:[component],providers:[{provide:AdminAccessService,useValue:{isSuperAdmin:()=>true}},provideRouter([]),{provide:AdminOperationsService,useValue:api}]});const f=TestBed.createComponent(component);f.detectChanges();return {c:f.componentInstance,api,f};}
describe('operations confirmation boundaries',()=>{
 it('broadcast drafting sends no notifications; sending requires preview and consent',()=>{const {c,api}=setup(SaBroadcast,[]);c.send();expect(api.post).not.toHaveBeenCalled();c.title='notice';c.message='body';c.draft();expect(api.post).toHaveBeenCalledWith('broadcast',expect.objectContaining({title:'notice',message:'body'}));api.post.mockClear();c.preview.set({id:'b',version:2,recipients:5,channel:'IN_APP',audience:'ALL'});c.send();expect(api.post).not.toHaveBeenCalled();c.confirmed=true;c.send();expect(api.post).toHaveBeenCalledWith('broadcast/b/send',{version:2,recipients:5,confirm:true});});
 it('cashback retains same review version and inputs after a rejected score attempt',()=>{const {c,api}=setup(SaCashback,{pending:[],entries:[],total:0,gate:null,policy:'policy'});const row={id:'r',contractId:'c',projectId:'p',userId:'u',eligibleValue:'3000',level:1,ratePercent:1,paymentInput:null,status:'WAITING_PAYMENT_SCORE',version:2,completedAt:'2026-11-13'};c.edit(row);c.score=80;c.reason='actual recorded grade';c.save();expect(api.post).not.toHaveBeenCalled();c.confirmed=true;api.post.mockReturnValue(throwError(()=>({error:{message:'تعذر'}})) as any);c.save();expect(api.post).toHaveBeenCalledWith('cashback/c/score',{version:2,score:80,note:'actual recorded grade'});expect(c.selected()).toEqual(row);expect(c.score).toBe(80);});
 it('published public text is escaped and does not expose draft fields or execute HTML',()=>{TestBed.configureTestingModule({imports:[PublishedContentComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});const f=TestBed.createComponent(PublishedContentComponent);f.componentRef.setInput('slug','about');f.detectChanges();TestBed.inject(HttpTestingController).expectOne(r=>r.url.endsWith('/public/content/about')).flush({data:{title:'About',published:'<script>alert(1)</script>',draft:'private draft'}});f.detectChanges();expect(f.nativeElement.querySelector('script')).toBeNull();expect(f.nativeElement.textContent).toContain('<script>');expect(f.nativeElement.textContent).not.toContain('private draft');});
});
