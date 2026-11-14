import { CmsTextSurface, CmsRoot } from '../../../../../shared/published-content/cms-copy';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe,it,expect,vi,afterEach } from 'vitest';
import { SaContent } from './sa-content';
import { AdminOperationsService } from '../../../../../core/services/admin-operations.service';
afterEach(()=>TestBed.resetTestingModule());
const row={slug:'about',title:'من نحن',draft:'',published:null,draftCopy:null,publishedCopy:null,version:3,publishedAt:null,updatedAt:null};
function mount(){const api={get:vi.fn(()=>of({success:true,data:[row]})),put:vi.fn()};TestBed.configureTestingModule({imports:[SaContent],providers:[{provide:AdminOperationsService,useValue:api}]});const f=TestBed.createComponent(SaContent);f.detectChanges();return {f,c:f.componentInstance,api};}
describe('actual-page content editing',()=>{
 it('embeds the actual internal page and publishes text overrides with its version',()=>{
  const {c,api,f}=mount();expect(f.nativeElement.querySelector('a[target="_blank"]')).toBeNull();
  expect(f.nativeElement.querySelector('iframe')?.getAttribute('src')).toBe('/about?cmsPreview=about');
  c.frameReady.set(true);c.texts.set([{key:'h1.0/text.0:abc',original:'Original',value:'Original',kind:'text'}]);c.selectedKey.set('h1.0/text.0:abc');
  c.updateText('Edited');api.put.mockReturnValue(of({success:true,data:{...row,version:4,draftCopy:c.copy(),publishedCopy:c.copy()}}));
  c.publish();expect(api.put).toHaveBeenCalledWith('content/about/copy',{version:3,copy:{version:1,edits:[{key:'h1.0/text.0:abc',original:'Original',value:'Edited'}]}});
  expect(c.dirty()).toBe(false);expect(c.notice()).toContain('تم نشر');
 });
 it('selects a text from the embedded page and updates its live preview',()=>{
  const {c,f}=mount();const frame=f.nativeElement.querySelector('iframe') as HTMLIFrameElement;
  const doc=frame.contentDocument!;doc.open();doc.write('<html><body><div data-ws-cms-page="about" data-ws-cms-ready="true"><h1>Actual page title</h1></div></body></html>');doc.close();
  const root=doc.querySelector('[data-ws-cms-page]') as CmsRoot;const surface=new CmsTextSurface(root,true);
  root.wsCmsBridge={getTexts:()=>surface.getTexts(),setCopy:copy=>surface.setCopy(copy)};
  c.onFrameLoad();expect(c.frameReady()).toBe(true);
  root.querySelector<HTMLElement>('[data-ws-cms-key]')!.click();
  expect(c.selectedText()?.original).toBe('Actual page title');c.updateText('Changed in the page');
  expect(root.querySelector('h1')?.textContent).toBe('Changed in the page');surface.destroy();
 });
 it('keeps edits on a version conflict instead of replacing them with defaults',()=>{
  const {c,api}=mount();c.frameReady.set(true);c.copy.set({version:1,edits:[{key:'p.0',original:'original',value:'unsaved'}]});
  api.put.mockReturnValue(throwError(()=>({error:{message:'تغيرت الصفحة'}})));c.publish();
  expect(c.error()).toBe('تغيرت الصفحة');expect(c.copy().edits[0].value).toBe('unsaved');expect(c.selected()?.version).toBe(3);
 });
});
