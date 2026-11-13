import { Component, DestroyRef, inject, input, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Component({selector:'app-published-content',standalone:true,template:`@if(published();as p){<article class="published-copy" dir="rtl"><h1>{{p.title}}</h1><div>{{p.published}}</div></article>}@else{<ng-content/>}`,styles:[`.published-copy{max-width:1100px;margin:28px auto;padding:28px;color:var(--txt,#17243a);background:var(--crd-bg,#fff);border:1px solid var(--sec-bd,#dce5ec);border-radius:16px;line-height:2}.published-copy div{white-space:pre-wrap;overflow-wrap:anywhere}.published-copy h1{font-size:26px}`]})
export class PublishedContentComponent {
 slug=input.required<string>();published=signal<{title:string;published:string}|null>(null);private http=inject(HttpClient);private destroy=inject(DestroyRef);
 constructor(){effect(onCleanup=>{const slug=this.slug();this.published.set(null);const s=this.http.get<{data:{title:string;published:string|null}|null}>(`${environment.url_api}/public/content/${encodeURIComponent(slug)}`).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{if(r.data?.published)this.published.set({title:r.data.title,published:r.data.published});},error:()=>{}});onCleanup(()=>s.unsubscribe());});}
}
