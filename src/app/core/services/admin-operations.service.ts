import type { CmsCopy } from '../../shared/published-content/cms-copy';
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export interface Envelope<T>{success:boolean;data:T}
export interface Expense {id:string;amount:string;currency:string;category:string;description:string;reference:string|null;incurredAt:string;status:string;version:number;voidReason:string|null}
export interface Paged<T>{rows:T[];total:number;page:number;pageSize:number}
export interface OperatingResult {period:string;currency:string;asOf:string;revenue:number;affiliateCost:number;cashbackCost:number;operatingExpenses:number;expenseCount:number;net:number|null;foreignCommissions:{currency:string;amount:number}[];definition:string}
export interface Upcoming {id:string;contractId:string;projectId:string;project:string;client:string;title:string;amount:number;currency:string;frozen:boolean;dueAt:string|null;status:string}
export interface CmsPage {draftCopy?:CmsCopy|null;publishedCopy?:CmsCopy|null;slug:string;title:string;draft:string;published:string|null;version:number;publishedAt:string|null;updatedAt:string|null}
export interface Campaign {id:string;title:string;message:string;audience:string;version:number;status:string;recipientCount:number;sentCount:number;failedCount:number;createdAt:string;emailRequested:boolean;emailCounts:Record<string,number>}
export interface BroadcastCapabilities {enabled:boolean;emailEnabled:boolean;smtpConfigured:boolean;emailReady:boolean}
export interface BroadcastPreview {id:string;version:number;recipients:number;channel:string;audience:string;capabilities:BroadcastCapabilities}
export interface CashbackPending {id:string;contractId:string;projectId:string;userId:string;eligibleValue:string;level:number;ratePercent:number;paymentInput:number|null;status:string;version:number;completedAt:string}
export interface CashbackEntry {id:string;contractId:string;amount:number;level:number;ratePercent:number;ratingInput:number;paymentInput:number;createdAt:string}
export interface CashbackData {gate:string|null;formula:string;policy:string;pending:CashbackPending[];entries:CashbackEntry[];total:number;page:number;pageSize:number}
@Injectable({providedIn:'root'})
export class AdminOperationsService {
 private http=inject(HttpClient);private base=()=>`${environment.url_api}/admin/operations`;
 get<T>(path:string,silent=false){return this.http.get<Envelope<T>>(`${this.base()}/${path}`,{context:new HttpContext().set(SKIP_LOADING,silent)});}
 post<T>(path:string,body:unknown){return this.http.post<Envelope<T>>(`${this.base()}/${path}`,body);}
 put<T>(path:string,body:unknown){return this.http.put<Envelope<T>>(`${this.base()}/${path}`,body);}
}
export abstract class OperationsPage {
 protected api=inject(AdminOperationsService);private destroy=inject(DestroyRef);
 busy=signal(false);error=signal('');notice=signal('');
 request<T>(request:Observable<Envelope<T>>,done:(data:T)=>void){
  if(this.busy())return;this.busy.set(true);this.error.set('');this.notice.set('');
  request.pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{this.busy.set(false);done(r.data);},error:e=>{this.busy.set(false);this.error.set(e?.error?.message||'تعذر إتمام الطلب؛ حاول مرة أخرى');}});
 }
}
