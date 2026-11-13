import {Component,OnInit,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {OperationsPage,Campaign,BroadcastPreview} from '../../../../../core/services/admin-operations.service';
@Component({selector:'app-sa-broadcast',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./sa-broadcast.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class SaBroadcast extends OperationsPage implements OnInit {
 rows=signal<Campaign[]>([]);title='';message='';audience='ALL';key=crypto.randomUUID();preview=signal<BroadcastPreview|null>(null);target=signal<Campaign|null>(null);confirmed=false;
 readonly audienceLabels:Record<string,string>={ALL:'كل المستخدمين النشطين',CLIENT:'العملاء',PROVIDER:'مقدمو الخدمة',MARKETER:'الوسطاء',ADMIN:'الإدارة'};
 ngOnInit(){this.load();}load(){this.request(this.api.get<Campaign[]>('broadcast'),d=>this.rows.set(d));}
 draft(){if(!this.title.trim()||!this.message.trim())return;this.request(this.api.post<Campaign>('broadcast',{requestKey:this.key,title:this.title,message:this.message,audience:this.audience}),d=>{this.key=crypto.randomUUID();this.title='';this.message='';this.load();});}
 inspect(c:Campaign){this.target.set(c);this.preview.set(null);this.confirmed=false;this.request(this.api.get<BroadcastPreview>(`broadcast/${c.id}/preview`),d=>this.preview.set(d));}
 send(){const p=this.preview();if(!p||!this.confirmed)return;this.request(this.api.post<Campaign>(`broadcast/${p.id}/send`,{version:p.version,recipients:p.recipients,confirm:true}),()=>{this.preview.set(null);this.target.set(null);this.load();});}
 cancel(c:Campaign){if(!confirm('إلغاء الإرسال المتبقي؟ الإشعارات التي وصلت تظل موجودة.'))return;this.request(this.api.post<Campaign>(`broadcast/${c.id}/cancel`,{version:c.version,confirm:true}),()=>this.load());}
 state(s:string){return ({DRAFT:'مسودة',SENDING:'جارٍ الإرسال',COMPLETED:'اكتمل',CANCELLED:'أُلغي'} as Record<string,string>)[s]||s;}

}
