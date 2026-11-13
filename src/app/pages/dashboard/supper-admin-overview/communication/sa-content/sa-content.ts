import {Component,OnInit,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {OperationsPage,CmsPage} from '../../../../../core/services/admin-operations.service';
@Component({selector:'app-sa-content',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./sa-content.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class SaContent extends OperationsPage implements OnInit {
 pages=signal<CmsPage[]>([]);selected=signal<CmsPage|null>(null);body='';reason='';confirmed=false;preview=signal(false);
 ngOnInit(){this.load();}
 load(){const slug=this.selected()?.slug;this.request(this.api.get<CmsPage[]>('content'),d=>{this.pages.set(d);this.choose(d.find(p=>p.slug===slug)||d[0]);});}
 choose(p:CmsPage){if(this.busy())return;if(this.selected()&&this.body!==this.selected()!.draft&&!confirm('يوجد تعديل غير محفوظ. هل تنتقل وتتركه؟'))return;this.selected.set(p);this.body=p.draft;this.reason='';this.confirmed=false;this.preview.set(false);}
 save(action:'DRAFT'|'PUBLISH'|'UNPUBLISH'){const p=this.selected();if(!p||!this.reason.trim()||(action!=='DRAFT'&&!this.confirmed))return;this.request(this.api.put<CmsPage>(`content/${p.slug}`,{body:this.body,version:p.version,action,reason:this.reason}),d=>{this.pages.update(rows=>rows.map(x=>x.slug===d.slug?d:x));this.selected.set(d);this.body=d.draft;this.confirmed=false;this.notice.set(action==='DRAFT'?'حُفظت المسودة على الخادم':'حُدث النشر لكل زوار المنصة');});}
 publicPath(slug:string){return ({terms:'/terms',privacy:'/privacy',faq:'/faq',about:'/about',how:'/how-it-works',contact:'/contact',welcome:'/'} as Record<string,string>)[slug];}

}
