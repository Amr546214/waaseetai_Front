import {Component,OnInit,inject,input,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin,map} from 'rxjs';
import {OperationsPage,OperatingResult,Paged,Expense} from '../../../../../core/services/admin-operations.service';
import {AdminAccessService} from '../../../../../core/services/admin-access.service';
import {ReportPrintService} from '../../../../../core/reports/report-print.service';
import {ReportDocument} from '../../../../../core/reports/report-document';
@Component({selector:'app-operating-finance',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./operating-finance.component.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class OperatingFinanceComponent extends OperationsPage implements OnInit {
 mode=input<'expenses'|'profit'>('expenses');access=inject(AdminAccessService);private printer=inject(ReportPrintService);
 result=signal<OperatingResult|null>(null);ledger=signal<Paged<Expense>|null>(null);page=1;key=crypto.randomUUID();addOpen=false;amount:number|null=null;category='OPERATIONS';description='';reference='';incurredAt=new Date().toISOString().slice(0,10);confirmed=false;voidTarget=signal<Expense|null>(null);voidReason='';
 readonly categories:Record<string,string>={HOSTING:'استضافة وخوادم',AI:'خدمات الذكاء الاصطناعي',SOFTWARE:'برامج واشتراكات',OPERATIONS:'تشغيل',OTHER:'أخرى'};
 ngOnInit(){this.load();}
 load(){this.request(forkJoin([this.api.get<OperatingResult>('result'),this.api.get<Paged<Expense>>(`expenses?page=${this.page}`)]).pipe(map(([r,l])=>({success:true,data:{result:r.data,ledger:l.data}}))),d=>{this.result.set(d.result);this.ledger.set(d.ledger);});}
 add(){if(this.amount==null||this.amount<=0||!this.description.trim()||!this.confirmed)return;this.request(this.api.post<Expense>('expenses',{requestKey:this.key,amount:this.amount,category:this.category,description:this.description,reference:this.reference,incurredAt:new Date(`${this.incurredAt}T00:00:00Z`).toISOString()}),()=>{this.key=crypto.randomUUID();this.addOpen=false;this.amount=null;this.description='';this.reference='';this.confirmed=false;this.load();});}
 voidExpense(){const r=this.voidTarget();if(!r||!this.voidReason.trim())return;this.request(this.api.post<Expense>(`expenses/${r.id}/void`,{version:r.version,reason:this.voidReason}),()=>{this.voidTarget.set(null);this.load();});}
 turn(n:number){this.page+=n;this.load();}
 document():ReportDocument|null{const r=this.result(),l=this.ledger();if(!r||!l||this.busy()||this.error())return null;return {title:this.mode()==='expenses'?'سجل المصروفات التشغيلية':'صافي النتيجة التشغيلية المسجلة',metadata:[['الفترة','تراكمي منذ بدء السجلات'],['وقت الاستخراج',new Date(r.asOf)],['العملة','USD'],['نطاق جدول المصروفات',`صفحة ${this.page} — ${l.rows.length} من ${l.total}`]],sections:[{title:'النتيجة التشغيلية',text:r.definition,facts:[['إيرادات عمولة المنصة',r.revenue],['تكلفة عمولات الوسطاء',r.affiliateCost],['الكاش باك المقيد',r.cashbackCost],['مصروفات التشغيل',r.operatingExpenses],['صافي النتيجة',r.net]]},{title:'سجل المصروفات — الصفحة المحملة',columns:['التاريخ','الفئة','البيان','القيمة USD','الحالة','مرجع','سبب الإلغاء'],rows:l.rows.map(x=>[x.incurredAt,this.categories[x.category],x.description,Number(x.amount),x.status==='VOIDED'?'ملغى محاسبيًا':'مسجل',x.reference,x.voidReason])}]};}
 print(){const d=this.document();if(d)this.printer.print(d);}
 exportCsv(){const d=this.document();if(!d)return;const cell=(x:unknown)=>{let s=String(x??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const result=this.result()!;const rows:unknown[][]=[['التقرير','تراكمي من السجلات','USD'],['عمولة المنصة',result.revenue],['عمولات الوسطاء',result.affiliateCost],['الكاش باك',result.cashbackCost],['المصروفات',result.operatingExpenses],['صافي النتيجة',result.net??'غير متاح بسبب عملات مختلفة'],['صفحة المصروفات',this.page],...d.sections.slice(1).flatMap(s=>[s.columns||[],...(s.rows||[])])];const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=`operating-finance-page-${this.page}.csv`;a.click();URL.revokeObjectURL(url);}
}
