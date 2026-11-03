import {TestBed} from '@angular/core/testing';
import {LiteralColoursRuntime,LITERAL_STYLE_ID} from './literal-colours.runtime';
import {describe,it,expect,afterEach} from 'vitest';
describe('reversible literal-colour bindings',()=>{
 let rt:LiteralColoursRuntime;let sheet:HTMLStyleElement;let host:HTMLElement;
 const setup=()=>{TestBed.resetTestingModule();rt=TestBed.inject(LiteralColoursRuntime);sheet=document.createElement('style');sheet.textContent='.colour-test{color:#2bd4c7!important;background:#123456}';document.head.appendChild(sheet);host=document.createElement('div');host.className='colour-test';host.style.color='#2bd4c7';document.body.appendChild(host);};
 afterEach(()=>{rt?.stop();sheet?.remove();host?.remove();document.body.classList.remove('theme-light');});
 it('does not alter source declarations or markup without an override',()=>{setup();const before=host.outerHTML,css=sheet.sheet!.cssRules[0].cssText;rt.setItems({});expect(host.outerHTML).toBe(before);expect(sheet.sheet!.cssRules[0].cssText).toBe(css);expect(document.getElementById(LITERAL_STYLE_ID)).toBeNull();});
 it('patches only eligible matching colour declarations and restores original priority and inline styles',()=>{setup();const before=host.style.cssText,css=(sheet.sheet!.cssRules[0] as CSSStyleRule).style.cssText;rt.setItems({'tokens.colors.dark':{value:{'--brand-teal':'#ff0000'}}});expect(host.style.color).toContain('--sc-colour');expect(document.getElementById(LITERAL_STYLE_ID)!.textContent).toContain('#ff0000');/* CSSOM priority is verified in tools/check-literal-colours-browser.cjs: JSDOM drops !important for var() in setProperty. */rt.stop();expect(host.style.cssText).toBe(before);expect((sheet.sheet!.cssRules[0] as CSSStyleRule).style.cssText).toBe(css);});
 it('restores detached inline declarations instead of retaining old page elements',()=>{setup();const before=host.style.cssText;rt.setItems({'tokens.colors.dark':{value:{'--brand-teal':'#ff0000'}}});host.remove();rt.scan();expect(host.style.cssText).toBe(before);});
 it('resets the virtual light-mode colour instead of leaking a dark-only override',()=>{setup();rt.setItems({'tokens.colors.dark':{value:{'--brand-teal':'#ff0000'}}});const css=document.getElementById(LITERAL_STYLE_ID)!.textContent!;expect(css).toContain('.theme-light');expect(css).toContain(':initial');});
 it('does not overwrite a later legitimate app colour when restoring',()=>{setup();rt.setItems({'tokens.colors.dark':{value:{'--brand-teal':'#ff0000'}}});host.style.color='#abcdef';rt.stop();expect(host.style.color).toBe('rgb(171, 205, 239)');});
});
