import { afterNextRender, Component, DestroyRef, ElementRef, ViewChild, inject, input, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SKIP_LOADING } from '../../core/interceptors/loading.interceptor';
import { SKIP_GET_CACHE } from '../../core/interceptors/get-cache.interceptor';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { CmsCopy, CmsRoot, CmsTextSurface, emptyCmsCopy, isCmsCopy } from './cms-copy';
interface PublishedPage {title:string;published:string|null;publishedCopy?:CmsCopy|null}
@Component({selector:'app-published-content',standalone:true,template:`
 <div #surfaceRoot class="cms-page-root" [attr.data-ws-cms-page]="slug()" [attr.data-ws-cms-ready]="loaded()?'true':null">
 @if(published()?.published&&!preserveLayout()){<article class="published-copy" dir="rtl"><h1>{{published()?.title}}</h1><div>{{published()?.published}}</div></article>}
 <div [style.display]="published()?.published&&!preserveLayout()?'none':'contents'" [attr.data-ws-cms-ignore]="published()?.published&&!preserveLayout()?'':null"><ng-content/></div>
 </div>`,styles:[`:host,.cms-page-root{display:contents}.published-copy{max-width:1100px;margin:28px auto;padding:28px;color:var(--txt,#17243a);background:var(--crd-bg,#fff);border:1px solid var(--sec-bd,#dce5ec);border-radius:16px;line-height:2}.published-copy div{white-space:pre-wrap;overflow-wrap:anywhere}.published-copy h1{font-size:26px}`]})
export class PublishedContentComponent {
 slug=input.required<string>();preserveLayout=input(false);published=signal<PublishedPage|null>(null);loaded=signal(false);
 @ViewChild('surfaceRoot',{static:true}) root!:ElementRef<CmsRoot>;
 private http=inject(HttpClient);private destroy=inject(DestroyRef);private platform=inject(PlatformInfoService);private surface?:CmsTextSurface;private previewOverride=false;
 constructor(){
  afterNextRender(()=>this.setupSurface());
  effect(onCleanup=>{
   const slug=this.slug();this.platform.publicRevision();
   const sub=this.http.get<{data:PublishedPage|null}>(`${environment.url_api}/public/content/${encodeURIComponent(slug)}`,{context:new HttpContext().set(SKIP_LOADING,true).set(SKIP_GET_CACHE,true)}).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{this.published.set(r.data);if(!this.previewOverride)this.surface?.setCopy(isCmsCopy(r.data?.publishedCopy)?r.data!.publishedCopy!:emptyCmsCopy());this.loaded.set(true);},error:()=>this.loaded.set(true)});
   onCleanup(()=>sub.unsubscribe());
  });
  this.destroy.onDestroy(()=>this.surface?.destroy());
 }
 private setupSurface(){
  const root=this.root.nativeElement;
  if(!root.ownerDocument.defaultView?.MutationObserver)return;
  const view=root.ownerDocument.defaultView;const preview=view.parent!==view&&new URL(view.location.href).searchParams.get('cmsPreview')===this.slug();
  this.surface=new CmsTextSurface(root,preview);
  const copy=this.published()?.publishedCopy;this.surface.setCopy(isCmsCopy(copy)?copy:emptyCmsCopy());
  if(preview){root.wsCmsBridge={getTexts:()=>this.surface!.getTexts(),setCopy:copy=>{this.previewOverride=true;this.surface!.setCopy(copy);}};if(this.loaded())root.setAttribute('data-ws-cms-ready','true');}
 }
}
