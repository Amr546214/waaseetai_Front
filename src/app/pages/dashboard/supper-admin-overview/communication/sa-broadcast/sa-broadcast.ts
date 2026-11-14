import { Component, OnInit, signal, inject, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlatformInfoService } from '../../../../../core/services/platform-info.service';
import { OperationsPage, Campaign, BroadcastCapabilities } from '../../../../../core/services/admin-operations.service';
@Component({selector:'app-sa-broadcast',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./sa-broadcast.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class SaBroadcast extends OperationsPage implements OnInit {
 readonly caps=signal<BroadcastCapabilities|null>(null);
 readonly rows=signal<Campaign[]>([]);
 title='';message='';audience='ALL';private key=crypto.randomUUID();
 private info=inject(PlatformInfoService);private destroyRef=inject(DestroyRef);
 readonly audienceLabels:Record<string,string>={ALL:'كل المستخدمين النشطين',CLIENT:'العملاء',PROVIDER:'مقدمو الخدمة',MARKETER:'الوسطاء',ADMIN:'الإدارة'};
 constructor(){super();effect(()=>{this.info.publicRevision();this.loadCapabilities();});}
 ngOnInit(){this.load();}
 loadCapabilities(){this.api.get<BroadcastCapabilities>('broadcast/capabilities',true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:r=>this.caps.set(r.data),error:()=>this.caps.set(null)});}
 load(){this.request(this.api.get<Campaign[]>('broadcast',true),d=>this.rows.set(d));}
 publish(){
  if(!this.title.trim()||!this.message.trim()||!this.caps()?.enabled)return;
  this.request(this.api.post<Campaign>('broadcast/publish',{requestKey:this.key,title:this.title.trim(),message:this.message.trim(),audience:this.audience}),c=>{
   this.key=crypto.randomUUID();this.title='';this.message='';
   this.rows.update(rows=>[c,...rows.filter(r=>r.id!==c.id)].slice(0,50));
   this.notice.set(`تم نشر الإعلان وبدأ توصيله إلى ${c.recipientCount} مستخدم داخل الموقع${c.emailRequested?'، وبالبريد للمستخدمين الذين فعّلوه.':'.'}`);
  });
 }
 publishSaved(c:Campaign){if(!this.caps()?.enabled)return;this.request(this.api.post<Campaign>(`broadcast/${c.id}/publish`,{version:c.version}),row=>{this.rows.update(rows=>rows.map(r=>r.id===row.id?row:r));this.notice.set(`بدأ إرسال الإعلان إلى ${row.recipientCount} مستخدم.`);});}
 cancel(c:Campaign){if(!confirm('إلغاء الإرسال المتبقي؟ ما تم توصيله يظل موجودًا.'))return;this.request(this.api.post<Campaign>(`broadcast/${c.id}/cancel`,{version:c.version,confirm:true}),()=>this.load());}
 emailState(s:string){return ({PENDING:'بانتظار الإرسال',SENDING:'قيد المعالجة',RETRY:'إعادة محاولة',SENT:'قبله خادم البريد',FAILED:'تعذر',SKIPPED:'غير مطلوب / تفضيل المستخدم',UNKNOWN:'نتيجة غير مؤكدة؛ تحتاج مراجعة',CANCELLED:'ألغي'} as Record<string,string>)[s]||s;}
 state(s:string){return ({DRAFT:'لم يُنشر',SENDING:'جارٍ التوصيل',COMPLETED:'اكتمل',CANCELLED:'أُلغي'} as Record<string,string>)[s]||s;}
}
