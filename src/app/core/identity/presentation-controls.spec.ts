import {describe,it,expect} from 'vitest';
import {PRESENTATION_GROUPS,buildPresentationCss,safePresentationValue} from './presentation-controls';
describe('shared site presentation contract',()=>{
 it('does not add any rule for the original or restored state',()=>{expect(buildPresentationCss({})).toBe('');expect(buildPresentationCss({'tokens.typography':{value:{'--type-h1-size':'inherit'}}})).toBe('');});
 it('binds headings/components/role-level badges without touching business data',()=>{
  const css=buildPresentationCss({'tokens.typography':{value:{'--type-h1-size':'40px'}},'tokens.components':{value:{'--comp-button-radius':'24px','--comp-level-provider-3-color':'#ff0000'}}});
  expect(css).toContain('font-size:40px!important');expect(css).toContain('border-radius:24px!important');expect(css).toContain('[data-role="PROVIDER"][data-level-index="3"]');expect(css).not.toContain('content:');expect(PRESENTATION_GROUPS.length).toBe(73);
 });
 it('rejects CSS injection and unsafe dimensions',()=>{
  for(const v of ['999px','0px','url(x)','var(--x)','20px;color:red'])expect(safePresentationValue({type:'length',min:8,max:128},v)).toBe(false);
  expect(safePresentationValue({type:'number',min:.1,max:1},'0')).toBe(false);expect(safePresentationValue({type:'font-family'},"'X';display:none")).toBe(false);
 });
});
