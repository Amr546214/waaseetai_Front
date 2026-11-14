import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting,HttpTestingController } from '@angular/common/http/testing';
import { afterEach,describe,it,expect } from 'vitest';
import { PublishedContentComponent } from './published-content.component';
import { CmsTextSurface } from './cms-copy';
import { PlatformInfoService } from '../../core/services/platform-info.service';
@Component({standalone:true,imports:[PublishedContentComponent],template:'<app-published-content slug="about"><article class="original-design"><h1>Original title</h1><p>Existing content</p></article></app-published-content>'})class Host{}
afterEach(()=>TestBed.resetTestingModule());
describe('public page copies retain the real default page',()=>{
 it('starts with the existing designed content and updates text in place from the published document',async()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  const f=TestBed.createComponent(Host);f.detectChanges();
  const root=f.nativeElement.querySelector('[data-ws-cms-page]') as HTMLElement;
  expect(root.querySelector('.original-design h1')?.textContent).toBe('Original title');
  const scan=new CmsTextSurface(root);const slot=scan.getTexts().find(t=>t.original==='Original title')!;scan.destroy();
  const http=TestBed.inject(HttpTestingController);
  http.expectOne(r=>r.url.endsWith('/public/content/about')).flush({data:{title:'About',published:null,publishedCopy:{version:1,edits:[{key:slot.key,original:slot.original,value:'New published title'}]}}});
  f.detectChanges();await Promise.resolve();
  expect(root.querySelector('.original-design h1')?.textContent).toBe('New published title');
  expect(root.querySelector('.original-design p')?.textContent).toBe('Existing content');
  TestBed.inject(PlatformInfoService).publicRevision.set(4);f.detectChanges();
  http.expectOne(r=>r.url.endsWith('/public/content/about')).flush({data:{title:'About',published:null,publishedCopy:{version:1,edits:[{key:slot.key,original:slot.original,value:'Live revision'}]}}});
  f.detectChanges();await Promise.resolve();expect(root.querySelector('h1')?.textContent).toBe('Live revision');
  http.verify();
 });
});
