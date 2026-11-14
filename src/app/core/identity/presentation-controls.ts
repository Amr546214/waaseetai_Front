import GROUPS from './presentation-controls.json';
export const PRESENTATION_GROUPS=GROUPS;
export const PRESENTATION_STYLE_ID='ws-identity-presentation';
/** top-level commas only (a comma inside `( )` or `[ ]` belongs to the selector): the PLACES of a group */
export function splitSelectors(selector:string):string[]{
 const out:string[]=[];let depth=0,cur='';
 for(const ch of selector){
  if(ch==='('||ch==='[')depth++;else if(ch===')'||ch===']')depth--;
  if(ch===','&&depth===0){out.push(cur.trim());cur='';}else cur+=ch;
 }
 if(cur.trim())out.push(cur.trim());
 return out.filter(Boolean);
}
/** the token of ONE place (zero-based index) of a multi-place group: `--x` -> `--x--p2`; it overrides the group's own token for that place only (same rule as the server's registry) */
export const placeToken=(name:string,index:number):string=>`${name}--p${index+1}`;
export function parsePlaceToken(name:string):{base:string;index:number}|null{const m=/^(.+)--p(\d+)$/.exec(name);return m?{base:m[1],index:Number(m[2])-1}:null;}
export const isPlaceToken=(name:string):boolean=>parsePlaceToken(name)!==null;
/** Source-template audit: retain their stored tokens for compatibility, but do not offer controls for unused selectors. Indices NEVER shift. */
export const UNUSED_PRESENTATION_PLACES = new Set(['.body-lg','.body-md','.body-sm','.overline','.kpi-number','[data-site-component="button"]','.project-card','.service-card','.modal-panel','.dialog-panel','.dropdown-menu','.status-pill']);
export const availablePresentationPlace = (selector:string):boolean => !UNUSED_PRESENTATION_PLACES.has(selector);
type Field={type:string;min?:number;max?:number;integer?:boolean};
export function safePresentationValue(field:Field,value:unknown):value is string {
 if(typeof value!=='string'||!value||value.length>200||/[;{}<>@\\/!\n\r]/.test(value)||/url|expression|var\(|calc\(/i.test(value))return false;
 if(field.type==='length'){const m=value.match(/^(\d+(?:\.\d{1,3})?)(px|rem)$/);return !!m && Number(m[1])>=(field.min??0)/(m[2]==='rem'?16:1)&&Number(m[1])<=(field.max??128)/(m[2]==='rem'?16:1);}
 if(field.type==='number')return /^(?:\d{1,3}(?:\.\d{1,3})?|\.\d{1,3})$/.test(value)&&Number(value)>=field.min!&&Number(value)<=field.max!&&(!field.integer||Number.isInteger(Number(value)));
 if(field.type==='spacing'){if(value==='normal')return true;const m=value.match(/^(-?\d+(?:\.\d{1,3})?)(px|em)$/);return !!m&&Number(m[1])>=(m[2]==='px'?-4:-.2)&&Number(m[1])<=(m[2]==='px'?8:.5);}
 if(field.type==='font-family')return /^(?:'[\p{L}][\p{L}\p{N} _-]{0,39}'|(?:serif|sans-serif|system-ui|monospace|cursive|fantasy))(?:,(?:'[\p{L}][\p{L}\p{N} _-]{0,39}'|(?:serif|sans-serif|system-ui|monospace|cursive|fantasy))){0,5}$/u.test(value);
 if(field.type==='color')return /^(?:#[\da-f]{3,8}|transparent|(?:rgb|rgba|hsl|hsla)\([\d.,%]+\))$/i.test(value);
 if(field.type==='paint')return /^(?:#[\da-f]{3,8}|transparent|(?:rgb|rgba|hsl|hsla)\([\d.,%]+\)|linear-gradient\([\da-f#.,()% deghrslb-]+\))$/i.test(value);
 if(field.type==='shadow')return value==='none'||/^[\d.,pxem#() rgbahslt-]+$/i.test(value);
 return false;
}
export function presentationInline(groupId:string,values:Record<string,string>|undefined,placeIndex?:number):Record<string,string>{
 const out:Record<string,string>={},group=PRESENTATION_GROUPS.find(g=>g.id===groupId);
 const places=group?splitSelectors(group.selector):[];
 const scoped=placeIndex!==undefined&&placeIndex>=0&&placeIndex<places.length&&places.length>1;
 for(const field of group?.fields??[]){const own=scoped?values?.[placeToken(field.name,placeIndex!)]:undefined;const value=safePresentationValue(field,own)?own:values?.[field.name];if(safePresentationValue(field,value))out[field.property]=value;}
 return out;
}
export function buildPresentationCss(items:Record<string,{value?:Record<string,string>}>,prefix='html:root:root:root body'):string{
 return PRESENTATION_GROUPS.map(group=>{
  const values=items[group.key]?.value,places=splitSelectors(group.selector);
  const rule=(selectors:string[],decl:Record<string,string>)=>{const d=Object.entries(decl).map(([p,v])=>`${p}:${v}!important`);return d.length?selectors.map(s=>prefix+' '+s).join(',')+'{'+d.join(';')+'}':'';};
  // the group's own value for every place, then each place's own value AFTER it (same specificity: the later rule wins, so a place's value overrides the group's for that place only)
  const all=rule(places,presentationInline(group.id,values));
  const each=places.length>1?places.map((sel,i)=>{
   const decl:Record<string,string>={};
   for(const field of group.fields){const v=values?.[placeToken(field.name,i)];if(safePresentationValue(field,v))decl[field.property]=v;}
   return rule([sel],decl);
  }).join(''):'';
  return all+each;
 }).join('');
}
