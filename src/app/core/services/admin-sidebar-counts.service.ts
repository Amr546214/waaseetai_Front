import { Injectable, inject, signal, DestroyRef, effect } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { adminDataChanges } from './admin-data-changes';
import { filter, debounceTime } from 'rxjs';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { SKIP_GET_CACHE } from '../interceptors/get-cache.interceptor';
import { environment } from '../../../environments/environment';
import { AdminAccessService } from './admin-access.service';
import { AuthStore } from '../store/auth.store';
@Injectable({providedIn:'root'})
export class AdminSidebarCounts {
 readonly total=signal<number|undefined>(undefined);
 private http=inject(HttpClient);private auth=inject(AuthStore);private access=inject(AdminAccessService);private epoch=0;
 constructor(){
  effect(()=>{const a=this.access.access();const user=this.auth.currentUser();if(a?.userId===user?.id&&(a?.isSuperAdmin||a?.hasAnyPermission))this.refresh();else{this.epoch++;this.total.set(undefined);}});
  adminDataChanges.pipe(debounceTime(80),takeUntilDestroyed(inject(DestroyRef))).subscribe(()=>this.refresh());
  inject(Router).events.pipe(filter(e=>e instanceof NavigationEnd),takeUntilDestroyed(inject(DestroyRef))).subscribe(()=>this.refresh());
 }
 refresh(){
  const a=this.access.access();if(!a||a.userId!==this.auth.currentUser()?.id||(!a.isSuperAdmin&&!a.hasAnyPermission))return;
  const epoch=++this.epoch;
  this.http.get<{data:{total:number}}>(`${environment.url_api}/admin/team/sidebar-counts`,{context:new HttpContext().set(SKIP_LOADING,true).set(SKIP_GET_CACHE,true)}).subscribe({next:r=>{if(epoch===this.epoch)this.total.set(r.data.total>0?r.data.total:undefined);},error:()=>{if(epoch===this.epoch)this.total.set(undefined);}});
 }
}
