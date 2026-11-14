import { Component, OnInit, OnDestroy, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OperationsPage, CmsPage } from '../../../../../core/services/admin-operations.service';
import { CmsBridge, CmsCopy, CmsRoot, CmsTextView, emptyCmsCopy, isCmsCopy } from '../../../../../shared/published-content/cms-copy';
const PATHS:Record<string,string>={terms:'/terms',privacy:'/privacy',faq:'/faq',about:'/about',how:'/how-it-works',contact:'/contact',welcome:'/'};
@Component({selector:'app-sa-content',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./sa-content.html',styleUrls:['../../../../../shared/admin-operations.css','./sa-content.css']})
export class SaContent extends OperationsPage implements OnInit,OnDestroy {
 pages=signal<CmsPage[]>([]);selected=signal<CmsPage|null>(null);copy=signal<CmsCopy>(emptyCmsCopy());
 texts=signal<CmsTextView[]>([]);selectedKey=signal<string|null>(null);frameUrl=signal<SafeResourceUrl|null>(null);frameReady=signal(false);editing=signal(true);search=signal('');
 readonly selectedText=computed(()=>this.texts().find(t=>t.key===this.selectedKey())??null);
 readonly matches=computed(()=>{const term=this.search().trim().toLocaleLowerCase();return this.texts().filter(t=>!term||t.value.toLocaleLowerCase().includes(term)||t.original.toLocaleLowerCase().includes(term));});
 readonly dirty=computed(()=>JSON.stringify(this.copy())!==JSON.stringify(this.initialCopy(this.selected())));
 private sanitizer=inject(DomSanitizer);private bridge?:CmsBridge;private observer?:MutationObserver;private doc?:Document;private queued=false;private frameTimer?:ReturnType<typeof setTimeout>;
 @ViewChild('pageFrame') frame?:ElementRef<HTMLIFrameElement>;
 ngOnInit(){this.load();}
 ngOnDestroy(){this.detach();}
 private initialCopy(p:CmsPage|null){return isCmsCopy(p?.draftCopy)?p!.draftCopy!:isCmsCopy(p?.publishedCopy)?p!.publishedCopy!:emptyCmsCopy();}
 load(){const slug=this.selected()?.slug;this.request(this.api.get<CmsPage[]>('content',true),rows=>{this.pages.set(rows);const p=rows.find(p=>p.slug===slug)||rows[0];if(p)this.choose(p);});}
 choose(p:CmsPage){
  if(this.busy()||!Object.hasOwn(PATHS,p.slug))return;
  if(this.dirty()&&!confirm('توجد تعديلات لم تُنشر. هل تتركها وتفتح الصفحة الأخرى؟'))return;
  this.detach();this.selected.set(p);this.copy.set(structuredClone(this.initialCopy(p)));this.selectedKey.set(null);this.texts.set([]);this.frameReady.set(false);this.search.set('');this.notice.set('');
  const url=new URL(PATHS[p.slug],window.location.origin);url.searchParams.set('cmsPreview',p.slug);
  this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url.pathname+url.search));
 }
 private detach(){if(this.frameTimer)clearTimeout(this.frameTimer);this.frameTimer=undefined;this.observer?.disconnect();this.observer=undefined;this.bridge=undefined;if(this.doc){this.doc.removeEventListener('click',this.onClick,true);this.doc.removeEventListener('submit',this.preventSubmit,true);}this.doc=undefined;}
 onFrameLoad(){
  this.detach();const frame=this.frame?.nativeElement;
  try{
   const doc=frame?.contentDocument;if(!doc)throw new Error();
   // A link or redirect must never turn this editor into a different site/page.
   const url=new URL(frame!.contentWindow!.location.href);
   if(url.origin!==window.location.origin||url.searchParams.get('cmsPreview')!==this.selected()?.slug)throw new Error();
   this.doc=doc;doc.addEventListener('click',this.onClick,true);doc.addEventListener('submit',this.preventSubmit,true);
   const View=doc.defaultView!;this.observer=new View.MutationObserver(()=>this.queueRefresh());
   this.observer.observe(doc.documentElement,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-ws-cms-ready']});
   this.refreshSurface();
   if(!this.frameReady())this.frameTimer=setTimeout(()=>{if(!this.frameReady())this.error.set('تعذّر تحميل الصفحة داخل المحرر. أعد التحميل وتحقق من حالة الصيانة والجلسة.');},15000);
  }catch{this.error.set('تعذّر عرض الصفحة داخل المحرر. أعد تحميل الصفحة.');}
 }
 private queueRefresh(){if(this.queued)return;this.queued=true;queueMicrotask(()=>{this.queued=false;if(this.doc)this.refreshSurface();});}
 private refreshSurface(){
  const slug=this.selected()?.slug;if(!slug||!this.doc)return;
  const root=Array.from(this.doc.querySelectorAll<CmsRoot>('[data-ws-cms-page]')).find(e=>e.dataset['wsCmsPage']===slug&&e.dataset['wsCmsReady']==='true'&&e.wsCmsBridge);
  if(!root)return;
  if(this.bridge!==root.wsCmsBridge){this.bridge=root.wsCmsBridge;this.bridge!.setCopy(this.copy());}
  this.texts.set(this.bridge!.getTexts());this.frameReady.set(true);if(this.frameTimer)clearTimeout(this.frameTimer);this.frameTimer=undefined;
 }
 private preventSubmit=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
 private onClick=(event:MouseEvent)=>{
  const target=event.target as Element|null;
  if(!target?.closest('[data-ws-cms-page]')){event.preventDefault();event.stopImmediatePropagation();return;}
  let key=target?.closest('[data-ws-cms-key]')?.getAttribute('data-ws-cms-key');
  if(!key&&this.doc){
   const doc=this.doc as Document&{caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node}|null;caretRangeFromPoint?:(x:number,y:number)=>Range|null};
   const node=doc.caretPositionFromPoint?.(event.clientX,event.clientY)?.offsetNode??doc.caretRangeFromPoint?.(event.clientX,event.clientY)?.startContainer;
   key=node?.parentElement?.closest('[data-ws-cms-key]')?.getAttribute('data-ws-cms-key');
   if(!key&&target?.querySelectorAll('[data-ws-cms-key]').length===1)key=target.querySelector('[data-ws-cms-key]')?.getAttribute('data-ws-cms-key');
  }
  if(this.editing()&&key&&this.texts().some(t=>t.key===key)){
   event.preventDefault();event.stopImmediatePropagation();this.selectedKey.set(key);return;
  }
  // In preview mode role tabs / FAQ expansion still work. Links and forms cannot navigate away or send real data.
  const link=target?.closest('a[href]');if(link&&!link.getAttribute('href')?.startsWith('#')){event.preventDefault();event.stopImmediatePropagation();}
 };
 selectText(t:CmsTextView){this.selectedKey.set(t.key);}
 updateText(value:string){
  const text=this.selectedText();if(!text||value.length>8000)return;
  const edits=this.copy().edits.filter(e=>e.key!==text.key);
  if(value!==text.original)edits.push({key:text.key,original:text.original,value});
  this.copy.set({version:1,edits:edits.sort((a,b)=>a.key.localeCompare(b.key))});this.bridge?.setCopy(this.copy());this.refreshSurface();
 }
 restoreText(){const text=this.selectedText();if(text)this.updateText(text.original);}
 discard(){this.copy.set(structuredClone(this.initialCopy(this.selected())));this.bridge?.setCopy(this.copy());this.refreshSurface();}
 publish(){
  const page=this.selected();if(!page||!this.frameReady()||!this.dirty())return;
  this.request(this.api.put<CmsPage>(`content/${page.slug}/copy`,{copy:this.copy(),version:page.version}),p=>{
   this.pages.update(rows=>rows.map(r=>r.slug===p.slug?p:r));this.selected.set(p);this.copy.set(structuredClone(this.initialCopy(p)));this.notice.set('تم نشر النصوص. تظهر التعديلات في الصفحة نفسها لكل الزوار.');
  });
 }
}
