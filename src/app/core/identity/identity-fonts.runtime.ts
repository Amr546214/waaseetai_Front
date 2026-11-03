import {DOCUMENT,isPlatformBrowser} from '@angular/common';
import {Injectable,PLATFORM_ID,inject,signal} from '@angular/core';
import FONTS from './approved-fonts.json';
export const APPROVED_FONTS=FONTS;
export function selectedFontResources(items:Record<string,{value?:Record<string,string>}>):Array<{name:string;href:string}>{
 const values=Object.entries(items['tokens.typography']?.value??{}).filter(([name])=>name==='--font-family'||name.endsWith('-family')).map(([,v])=>v);
 const families=new Map<string,number[]>();for(const row of FONTS){if(!values.some(v=>v.split(',').some(p=>p.trim().replace(/^['"]|['"]$/g,'')===row.googleFamily)))continue;if(row.googleFamily!=='Tajawal')families.set(row.googleFamily,row.weights);if(values.some(v=>v.includes("'"+row.latinPartner+"'"))&&row.latinPartner!=='Tajawal')families.set(row.latinPartner,row.latinPartnerWeights);}
 return [...families].map(([name,weights])=>({name,href:'https://fonts.googleapis.com/css2?family='+encodeURIComponent(name)+':wght@'+[...weights].sort((a,b)=>a-b).join(';')+'&display=swap'}));
}
/** Only repository-approved Google font resources; no user URL, CSS or font binary is executed. Defaults add no requests. */
@Injectable({providedIn:'root'})
export class IdentityFontsRuntime{
 private readonly doc=inject(DOCUMENT);private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));private readonly links=new Map<string,HTMLLinkElement>();readonly failed=signal<string[]>([]);
 setItems(items:Record<string,{value?:Record<string,string>}>){if(!this.browser)return;const wanted=selectedFontResources(items);const names=new Set(wanted.map(f=>f.name));for(const[name,link]of this.links)if(!names.has(name)){link.remove();this.links.delete(name);}this.failed.update(xs=>xs.filter(n=>names.has(n)));for(const font of wanted){if(this.links.has(font.name))continue;const link=this.doc.createElement('link');link.rel='stylesheet';link.href=font.href;link.dataset['identityFont']=font.name;link.onerror=()=>this.failed.update(xs=>xs.includes(font.name)?xs:[...xs,font.name]);link.onload=()=>this.failed.update(xs=>xs.filter(n=>n!==font.name));this.doc.head.appendChild(link);this.links.set(font.name,link);}}
}
