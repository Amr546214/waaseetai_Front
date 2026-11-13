import { Component } from '@angular/core';
import { PublishedContentComponent } from './published-content.component';
import { RouterLink } from '@angular/router';
@Component({standalone:true,imports:[PublishedContentComponent,RouterLink],template:`<app-published-content slug="faq"><section dir="rtl" style="max-width:1000px;margin:40px auto;padding:24px"><h1>الأسئلة الشائعة</h1><p>تجد شرح خطوات العمل وإجابات الأسئلة الشائعة في دليل المنصة.</p><a routerLink="/how-it-works">فتح دليل كيف يعمل</a></section></app-published-content>`})
export class FaqPageComponent {}
