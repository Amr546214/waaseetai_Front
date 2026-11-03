import GROUPS from './presentation-controls.json';
export const PRESENTATION_GROUPS=GROUPS;
export const PRESENTATION_STYLE_ID='ws-identity-presentation';
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
export function presentationInline(groupId:string,values:Record<string,string>|undefined):Record<string,string>{
 const out:Record<string,string>={},group=PRESENTATION_GROUPS.find(g=>g.id===groupId);
 for(const field of group?.fields??[]){const value=values?.[field.name];if(safePresentationValue(field,value))out[field.property]=value;}
 return out;
}
export function buildPresentationCss(items:Record<string,{value?:Record<string,string>}>,prefix='html:root:root:root body'):string{
 return PRESENTATION_GROUPS.map(group=>{
  const declarations=Object.entries(presentationInline(group.id,items[group.key]?.value)).map(([p,v])=>`${p}:${v}!important`);
  return declarations.length?group.selector.split(',').map(s=>prefix+' '+s).join(',')+'{'+declarations.join(';')+'}':'';
 }).join('');
}
