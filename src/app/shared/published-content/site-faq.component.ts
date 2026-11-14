import { Component, signal } from '@angular/core';
import { PublishedContentComponent } from './published-content.component';
import { SITE_FAQS } from './faq-copy';
@Component({selector:'app-site-faq',standalone:true,imports:[PublishedContentComponent],template:`
<app-published-content slug="faq"><section class="faq-copy" dir="rtl"><h1>الأسئلة الشائعة</h1><p>كل ما تريد معرفته عن استخدام المنصة</p>
@for(faq of faqs;track faq.q;let i=$index){<details [open]="opened()===i"><summary (click)="$event.preventDefault();opened.set(opened()===i?null:i)">{{faq.q}}</summary><p>{{faq.a}}</p></details>}
</section></app-published-content>`,styles:[`.faq-copy{max-width:1000px;margin:30px auto;padding:24px;color:var(--txt,#17243a)}h1{font-size:26px;margin-bottom:12px}details{border:1px solid var(--sec-bd,#cbd5e1);background:var(--crd-bg,#fff);border-radius:12px;padding:18px;margin:14px 0}summary{font-weight:700;cursor:pointer}p{line-height:1.9}`]})
export class SiteFaqComponent {readonly faqs=SITE_FAQS;opened=signal<number|null>(null);}
