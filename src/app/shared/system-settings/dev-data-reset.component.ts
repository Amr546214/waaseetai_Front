import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationsPage } from '../../core/services/admin-operations.service';
interface Capability {allowed:boolean;database:string;reason:string;confirmation:string}
interface Preview {token:string;expiresAt:number;database:string;confirmation:string;tables:{table:string;rows:number}[];usersToDelete:number;adminsRetained:number;retained:string[]}
@Component({selector:'app-dev-data-reset',standalone:true,imports:[FormsModule],styles:[`
:host{display:block;border:1px solid #f8717144;border-radius:12px;padding:16px;margin:12px 0;color:inherit}button,input,textarea{font:inherit;color:inherit;background:var(--ws-surface,transparent);border:1px solid #64748b;border-radius:6px;padding:8px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}label{display:grid;gap:6px;margin:12px 0}details{max-height:260px;overflow:auto}p{line-height:1.8}.error{color:#f87171}.actions{display:flex;gap:12px;flex-wrap:wrap}
`],template:`
<h3>مسح بيانات dev التجريبية</h3>
<p>يحذف المستخدمين غير الإداريين وبيانات التشغيل، ومنها المشاريع والعقود والمحافظ والإشعارات. يحتفظ بحسابات الإدارة وجلساتها والإعدادات والتخصصات والهوية البصرية وسجل الإدارة. تُصفّر أرصدة حسابات الإدارة التجريبية. الملفات المرفوعة على التخزين لا تُحذف من هذا الإجراء.</p>
@if(capability();as c){@if(!c.allowed){<p role="status">{{c.reason}}</p>}<button type="button" [disabled]="!c.allowed||busy()" (click)="inspect()">معاينة البيانات قبل المسح</button>}
@if(error()){<p class="error" role="alert">{{error()}}</p>}@if(notice()){<p role="status">{{notice()}}</p>}
@if(preview();as p){
 <p><strong>قاعدة البيانات: {{p.database}}</strong> · مستخدمون سيُحذفون: {{p.usersToDelete}} · إداريون محفوظون: {{p.adminsRetained}}</p>
 <details><summary>الجداول التي سيُمسح محتواها</summary>@for(t of p.tables;track t.table){<div dir="ltr">{{t.table}}: {{t.rows}}</div>}</details>
 <details><summary>ما سيُحفظ</summary><p dir="ltr">{{p.retained.join(', ')}}</p></details>
 <p>المعاينة صالحة خمس دقائق. يجب تفعيل الصيانة وإلغاء الإرسال الجاري. خذ نسخة من الخادم قبل المتابعة؛ لا ينشئ هذا الزر snapshot.</p>
 <label>سبب المسح *<textarea [(ngModel)]="reason" maxlength="500"></textarea></label>
 <label>اكتب «{{p.confirmation}}» *<input [(ngModel)]="confirmation" autocomplete="off"></label>
 <label><span><input type="checkbox" [(ngModel)]="backupConfirmed">أؤكد أني احتفظت بنسخة من الخادم وأن هذه بيانات dev المقصودة.</span></label>
 <div class="actions"><button type="button" [disabled]="busy()||confirmation!==p.confirmation||reason.trim().length<5||!backupConfirmed" (click)="execute()">مسح نهائي لبيانات dev</button><button type="button" [disabled]="busy()" (click)="preview.set(null)">إلغاء</button></div>
}
`})
export class DevDataResetComponent extends OperationsPage implements OnInit {
 capability=signal<Capability|null>(null);preview=signal<Preview|null>(null);reason='';confirmation='';backupConfirmed=false;
 ngOnInit(){this.request(this.api.get<Capability>('dev-reset',true),d=>this.capability.set(d));}
 inspect(){this.preview.set(null);this.confirmation='';this.backupConfirmed=false;this.request(this.api.post<Preview>('dev-reset/preview',{}),d=>this.preview.set(d));}
 execute(){const p=this.preview();if(!p||this.confirmation!==p.confirmation||!this.backupConfirmed)return;this.request(this.api.post('dev-reset/execute',{token:p.token,confirmation:this.confirmation,reason:this.reason.trim(),backupConfirmed:true}),()=>{this.preview.set(null);this.notice.set('تم مسح بيانات dev المحددة وحفظ سجل الإجراء. الصيانة ما زالت مفعلة.');});}
}
