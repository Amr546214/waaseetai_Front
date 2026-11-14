import { describe, it, expect, afterEach } from 'vitest';
import { CmsTextSurface } from './cms-copy';
const surfaces:CmsTextSurface[]=[];
afterEach(()=>{surfaces.forEach(s=>s.destroy());surfaces.length=0;document.body.innerHTML='';});
function surface(preview=false){const root=document.createElement('div');root.dataset['wsCmsPage']='about';root.innerHTML='<article class="real-layout"><h1>Original <strong>heading</strong></h1><p>A paragraph</p><input placeholder="Your name"><svg><text>ignore</text></svg></article>';document.body.append(root);const s=new CmsTextSurface(root,preview);surfaces.push(s);return {s,root};}
describe('editing the actual page copy',()=>{
 it('uses identical stable keys in the preview and public page and preserves its layout',()=>{
  const preview=surface(true),publicPage=surface();
  expect(preview.s.getTexts().map(t=>t.key)).toEqual(publicPage.s.getTexts().map(t=>t.key));
  const text=preview.s.getTexts().find(t=>t.original==='heading')!;
  publicPage.s.setCopy({version:1,edits:[{key:text.key,original:text.original,value:'<script>new</script>'}]});
  expect(publicPage.root.querySelector('article.real-layout h1 strong')?.textContent).toBe('<script>new</script>');
  expect(publicPage.root.querySelector('script')).toBeNull();expect(publicPage.root.querySelector('p')?.textContent).toBe('A paragraph');
 });
 it('edits placeholders as text, never form values, HTML or SVG',()=>{
  const {s,root}=surface();const slot=s.getTexts().find(t=>t.kind==='placeholder')!;
  s.setCopy({version:1,edits:[{key:slot.key,original:slot.original,value:'اكتب اسمك'}]});
  expect(root.querySelector('input')?.placeholder).toBe('اكتب اسمك');expect(root.querySelector('input')?.value).toBe('');
  expect(s.getTexts().some(t=>t.original==='ignore')).toBe(false);
 });
 it('refuses an override whose original text no longer matches and applies later revisions without reload',()=>{
  const {s,root}=surface();const slot=s.getTexts().find(t=>t.original==='A paragraph')!;
  s.setCopy({version:1,edits:[{key:slot.key,original:'different',value:'wrong'}]});expect(root.querySelector('p')?.textContent).toBe('A paragraph');
  s.setCopy({version:1,edits:[{key:slot.key,original:slot.original,value:'Published'}]});expect(root.querySelector('p')?.textContent).toBe('Published');
  s.setCopy({version:1,edits:[]});expect(root.querySelector('p')?.textContent).toBe('A paragraph');
 });
});
