import {TestBed} from '@angular/core/testing';
import {IdentityFontsRuntime,selectedFontResources} from './identity-fonts.runtime';
import {describe,it,expect,afterEach} from 'vitest';
describe('published font resources',()=>{
 afterEach(()=>{document.querySelectorAll('[data-identity-font]').forEach(n=>n.remove());TestBed.resetTestingModule();});
 it('adds no resources for default or unapproved names/URLs',()=>{expect(selectedFontResources({})).toEqual([]);expect(selectedFontResources({'tokens.typography':{value:{'--font-family':"'Unregistered',sans-serif",'--type-h1-family':'https://evil.invalid/font.css'}}})).toEqual([]);});
 it('loads an approved family for a role and removes the resource on restore',()=>{const rt=TestBed.inject(IdentityFontsRuntime);rt.setItems({'tokens.typography':{value:{'--type-h1-family':"'Cairo',sans-serif"}}});const link=document.querySelector<HTMLLinkElement>('[data-identity-font="Cairo"]')!;expect(link.href).toMatch(/^https:\/\/fonts.googleapis.com\/css2\?family=Cairo:/);rt.setItems({});expect(document.querySelector('[data-identity-font]')).toBeNull();});
 it('reports stylesheet failure without replacing site content',()=>{const rt=TestBed.inject(IdentityFontsRuntime);rt.setItems({'tokens.typography':{value:{'--font-family':"'Cairo',sans-serif"}}});document.querySelector('[data-identity-font="Cairo"]')!.dispatchEvent(new Event('error'));expect(rt.failed()).toEqual(['Cairo']);rt.setItems({});expect(rt.failed()).toEqual([]);});
});
