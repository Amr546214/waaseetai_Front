import {describe,it,expect} from 'vitest';
import {PRESENTATION_GROUPS,presentationInline,buildPresentationCss,isPlaceToken,parsePlaceToken,placeToken,safePresentationValue,splitSelectors} from './presentation-controls';
describe('shared site presentation contract',()=>{
 it('does not add any rule for the original or restored state',()=>{expect(buildPresentationCss({})).toBe('');expect(buildPresentationCss({'tokens.typography':{value:{'--type-h1-size':'inherit'}}})).toBe('');});
 it('binds headings/components/role-level badges without touching business data',()=>{
  const css=buildPresentationCss({'tokens.typography':{value:{'--type-h1-size':'40px'}},'tokens.components':{value:{'--comp-button-radius':'24px','--comp-level-provider-3-color':'#ff0000'}}});
  expect(css).toContain('font-size:40px!important');expect(css).toContain('border-radius:24px!important');expect(css).toContain('[data-role="PROVIDER"][data-level-index="3"]');expect(css).not.toContain('content:');expect(PRESENTATION_GROUPS.length).toBe(73);
 });
 it('a place of a multi-place group has its own token: it overrides the group value for that place only, and never leaks to the others',()=>{
  const p=(css:string)=>css.split('}').filter(Boolean).map(r=>r+'}');
  const css=buildPresentationCss({'tokens.components':{value:{'--comp-button-height':'40px','--comp-button-height--p2':'56px'}}});
  const rules=p(css);
  expect(rules.length).toBe(2);
  expect(rules[0]).toContain('html:root:root:root body button,html:root:root:root body .btn,html:root:root:root body [data-site-component="button"]{min-height:40px!important}');
  expect(rules[1]).toBe('html:root:root:root body .btn{min-height:56px!important}'); // AFTER the group rule: the later rule of equal specificity wins for `.btn` only
  expect(buildPresentationCss({'tokens.components':{value:{'--comp-button-height--p1':'48px'}}})).toBe('html:root:root:root body button{min-height:48px!important}');
  expect(buildPresentationCss({'tokens.components':{value:{'--comp-button-height--p2':'url(x)'}}})).toBe('');
  expect(buildPresentationCss({'tokens.components':{value:{'--comp-button-height--p9':'48px'}}})).toBe(''); // no such place
  expect(parsePlaceToken(placeToken('--comp-button-height',1))).toEqual({base:'--comp-button-height',index:1});expect(isPlaceToken('--comp-button-height')).toBe(false);
  expect(splitSelectors('.a,[data-x="1,2"] b, :is(.c,.d)')).toEqual(['.a','[data-x="1,2"] b',':is(.c,.d)']);
 });
 it('inline samples use the same per-place value as the published rule, and restoring one place falls back to the shared value',()=>{
  const active={'--comp-button-height':'40px','--comp-button-height--p2':'48px'};
  const desired={...active,'--comp-button-height--p2':'56px'};
  expect(presentationInline('button',active,1)).toEqual({'min-height':'48px'});
  expect(presentationInline('button',desired,1)).toEqual({'min-height':'56px'});
  expect(presentationInline('button',desired,0)).toEqual({'min-height':'40px'});
  expect(presentationInline('button',{'--comp-button-height':'40px'},1)).toEqual({'min-height':'40px'});
  expect(presentationInline('button',{'--comp-button-height--p2':'url(x)'},1)).toEqual({});
 });
 it('rejects CSS injection and unsafe dimensions',()=>{
  for(const v of ['999px','0px','url(x)','var(--x)','20px;color:red'])expect(safePresentationValue({type:'length',min:8,max:128},v)).toBe(false);
  expect(safePresentationValue({type:'number',min:.1,max:1},'0')).toBe(false);expect(safePresentationValue({type:'font-family'},"'X';display:none")).toBe(false);
 });
});
