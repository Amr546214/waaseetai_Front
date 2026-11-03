import {DOCUMENT,isPlatformBrowser} from '@angular/common';
import {Injectable,PLATFORM_ID,inject} from '@angular/core';
import PALETTE_NAMES from './colour-palette-names.generated.json';
import {Colour,COLOUR_LITERAL,colourCss,colourId,coreColourCandidates,paintContext,paintProperty,parseColour,stableColourName} from './colour-model';

type Item={value?:Record<string,string>};
type Saved={original:string;priority:string;applied:string;planned:string};
const paletteNames=new Set(PALETTE_NAMES);
const PAINT_KEYS=new Set(['--grad','--surface']);
export const LITERAL_STYLE_ID='ws-identity-literal-colours';
/** Reversible runtime binding. Does not rewrite application source, selectors, markup or declarations without an explicit colour override. */
@Injectable({providedIn:'root'})
export class LiteralColoursRuntime {
 private readonly doc=inject(DOCUMENT);private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
 private modes:{dark:Record<string,string>;light:Record<string,string>}={dark:{},light:{}};
 private readonly saved=new Map<CSSStyleDeclaration,Map<string,Saved>>();private observer:MutationObserver|null=null;private timer:ReturnType<typeof setTimeout>|null=null;private variables=new Map<string,{dark?:string;light?:string}>();
 private readonly signatures=new WeakMap<Element,string>();
 private extra:HTMLStyleElement|null=null;private scanning=false;
 setItems(items:Record<string,Item>):void {
  if(!this.browser)return;
  this.modes={dark:{...items['tokens.colors.dark']?.value,...items['tokens.palette.dark']?.value},light:{...items['tokens.colors.light']?.value,...items['tokens.palette.light']?.value}};
  const active=Object.values(this.modes).some(values=>Object.values(values).some(v=>!!parseColour(v)||/^(?:linear-gradient)\(/.test(v)));
  if(!active){this.stop();return;}
  this.scan();
  if(!this.observer){this.observer=new MutationObserver(records=>{if(records.some(r=>{
   if(r.target instanceof Element && r.target.id.startsWith('ws-identity'))return false;
   if(r.type==='attributes'&&r.target instanceof Element){const signature=this.signature(r.target);if(this.signatures.get(r.target)===signature)return false;this.signatures.set(r.target,signature);return true;}
   return true;
  }))this.schedule();});this.observer.observe(this.doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});}
 }
 private signature(node:Element):string {const style=(node as HTMLElement).style;if(!style)return '';return Array.from(style).filter(p=>paintProperty(p)).map(p=>p+':'+style.getPropertyValue(p)+':'+style.getPropertyPriority(p)).join(';');}
 private schedule():void {if(this.timer!==null)return;this.timer=setTimeout(()=>{this.timer=null;this.scan();},80);}
 private replacement(raw:string,property:string):string {
  const original=parseColour(raw);if(!original)return raw;const context=paintContext(property),palette=stableColourName(context,colourId(original));
  const targets:{dark?:string;light?:string}={};
  for(const mode of ['dark','light'] as const){const values=this.modes[mode];const candidate=coreColourCandidates(original,context).find(name=>parseColour(values[name]??''));const selected=candidate??(paletteNames.has(palette)&&parseColour(values[palette]??'')?palette:undefined);if(!selected)continue;const target=parseColour(values[selected])!;
   // Brand tints retain their source alpha, but honour a transparent/custom-alpha brand.
   const out:Colour=[target[0],target[1],target[2],candidate&&original[3]<1?target[3]*original[3]:target[3]];targets[mode]=colourCss(out);
  }
  if(!targets.dark&&!targets.light)return raw;
  const hex=original.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');const variable=`--sc-colour-${context}-${hex}-${Math.round(original[3]*1000)}`;
  this.variables.set(variable,targets);return `var(${variable},${raw})`;
 }
 private rewrite(value:string,property:string):string {if(!paintProperty(property)||property.startsWith('--sc-')||/url\s*\(|var\s*\(/i.test(value))return value;return value.replace(COLOUR_LITERAL,raw=>this.replacement(raw,property));}
 private process(style:CSSStyleDeclaration):void {
  let tracked=this.saved.get(style);const properties=new Set([...Array.from(style),...(tracked?.keys()??[])]);
  for(const property of properties){if(!paintProperty(property)||property.startsWith('--sc-'))continue;const current=style.getPropertyValue(property),old=tracked?.get(property);let original=old?.original??current,priority=old?.priority??style.getPropertyPriority(property);
   // A legitimate app update wins over our prior snapshot and becomes the new restoration target.
   if(old&&current!==old.applied){original=current;priority=style.getPropertyPriority(property);}
   const next=this.rewrite(original,property);
   if(next===original){if(old&&current===old.applied)style.setProperty(property,original,priority);tracked?.delete(property);continue;}
   if(!tracked){tracked=new Map();this.saved.set(style,tracked);}
   if(!(old&&current===old.applied&&old.planned===next))style.setProperty(property,next,priority);tracked.set(property,{original,priority,applied:style.getPropertyValue(property),planned:next});
  }
  if(tracked&&!tracked.size)this.saved.delete(style);
 }
 scan():void {
  if(!this.browser||this.scanning)return;this.scanning=true;this.variables.clear();
  try{
   const seen=new Set<CSSStyleDeclaration>();
   const walk=(rules:CSSRuleList)=>{for(const rule of Array.from(rules)){const r=rule as CSSStyleRule&CSSGroupingRule;if(r.style){seen.add(r.style);this.process(r.style);}if(r.cssRules)walk(r.cssRules);}};
   for(const sheet of Array.from(this.doc.styleSheets)){const owner=sheet.ownerNode as Element|null;if(owner?.id?.startsWith('ws-identity'))continue;try{walk(sheet.cssRules);}catch{/* cross-origin sheets cannot be inspected; never modify or refetch them */}}
   for(const node of Array.from(this.doc.querySelectorAll<HTMLElement>('[style]'))){if(node.id.startsWith('ws-identity')||node.closest('[data-site-control-isolated]'))continue;seen.add(node.style);this.process(node.style);this.signatures.set(node,this.signature(node));}
   // Route changes must not retain detached components or their stylesheet declarations.
   for(const[style,fields]of this.saved)if(!seen.has(style)){for(const[property,s]of fields)if(style.getPropertyValue(property)===s.applied)style.setProperty(property,s.original,s.priority);this.saved.delete(style);}
   const declarations=(mode:'dark'|'light')=>[...this.variables].map(([name,values])=>`${name}:${values[mode]??'initial'}`).join(';');
   const dark=declarations('dark'),light=declarations('light');const css=dark?`:root{${dark}}html.theme-light,html.light-theme,body.theme-light,body.light-theme,.theme-light,.light-theme{${light}}`:'';
   if(!css){this.extra?.remove();this.extra=null;}else{if(!this.extra){this.extra=this.doc.createElement('style');this.extra.id=LITERAL_STYLE_ID;this.doc.head.appendChild(this.extra);}if(this.extra.textContent!==css)this.extra.textContent=css;}
  }finally{this.scanning=false;}
 }
 stop():void {
  this.observer?.disconnect();this.observer=null;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
  for(const[style,fields]of this.saved)for(const[property,s]of fields)if(style.getPropertyValue(property)===s.applied)style.setProperty(property,s.original,s.priority);
  this.saved.clear();this.variables.clear();this.extra?.remove();this.extra=null;this.modes={dark:{},light:{}};
 }
}
