export type Colour=[number,number,number,number];
export function parseColour(value:string):Colour|null {
 const v=value.trim().toLowerCase();if(v==='transparent')return[0,0,0,0];if(v==='white')return[255,255,255,1];if(v==='black')return[0,0,0,1];
 let m=v.match(/^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/);if(m){let hex=m[1];if(hex.length<5)hex=[...hex].map(x=>x+x).join('');return[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),hex.length===8?parseInt(hex.slice(6,8),16)/255:1];}
 m=v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/);
 if(m){const c:Colour=[Number(m[1]),Number(m[2]),Number(m[3]),m[4]===undefined?1:Number(m[4])/(m[5]?100:1)];return c.every(Number.isFinite)&&c.slice(0,3).every(n=>n>=0&&n<=255)&&c[3]>=0&&c[3]<=1?c:null;}
 m=v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/);
 if(m){const h=Number(m[1])%360/360,s=Number(m[2])/100,l=Number(m[3])/100,a=m[4]===undefined?1:Number(m[4])/(m[5]?100:1);if(![h,s,l,a].every(Number.isFinite)||s<0||s>1||l<0||l>1||a<0||a>1)return null;const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const f=(t:number)=>{if(t<0)t++;if(t>1)t--;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};return[Math.round((s?f(h+1/3):l)*255),Math.round((s?f(h):l)*255),Math.round((s?f(h-1/3):l)*255),a];}
 return null;
}
export function colourId(c:Colour):string{return c.slice(0,3).map(Math.round).join(',')+','+Math.round(c[3]*1000)/1000;}
export function colourCss(c:Colour):string {return c[3]===1?'#'+c.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join(''):`rgba(${c.slice(0,3).map(Math.round).join(',')},${String(Math.round(c[3]*1000)/1000).replace(/^0\./,'.')})`;}
export const COLOUR_LITERAL=/#(?:[a-f\d]{8}|[a-f\d]{6}|[a-f\d]{4}|[a-f\d]{3})\b|(?:rgba?|hsla?)\([^()]*\)|\b(?:white|black|transparent)\b/gi;
export function paintContext(property:string):string{return /border|outline/.test(property)?'border':/background/.test(property)?'background':/shadow/.test(property)?'shadow':/color|fill|stroke/.test(property)?'text':'detail';}
export function paintProperty(property:string):boolean{return property.startsWith('--')||/^(?:-webkit-)?(?:color|background(?:-[a-z-]+)?|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|box-shadow|text-shadow|fill|stroke|stop-color|flood-color|caret-color|accent-color|text-decoration(?:-color)?|text-fill-color|filter)$/.test(property);}
export function coreColourCandidates(c:Colour,context:string):string[]{
 const rgb=c.slice(0,3).map(Math.round).join(',');
 const families:Record<string,string[]>={'43,212,199':['--brand-teal','--teal'],'15,138,127':['--brand-teal','--teal'],'43,127,255':['--brand-blue','--blue'],'29,111,224':['--brand-blue','--blue'],'123,47,190':['--brand-ai','--ai'],'107,39,165':['--brand-ai','--ai'],'15,169,154':['--green'],'10,111,100':['--green'],'217,138,11':['--kahr'],'154,103,0':['--kahr'],'255,140,105':['--red'],'180,35,24':['--red']};
 if(families[rgb])return families[rgb];if(context==='text'&&c[3]===1){if(rgb==='255,255,255'||rgb==='15,23,42')return['--txt'];if(rgb==='168,178,209'||rgb==='71,85,105')return['--txt-2'];if(rgb==='107,118,153'||rgb==='91,100,114')return['--txt-3'];if(rgb==='165,107,224')return['--ai-txt'];}
 if(context==='background'&&c[3]===1&&rgb==='7,13,36')return['--pg'];return[];
}
export function stableColourName(context:string,id:string):string{let n=2166136261;for(const ch of context+'|'+id)n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;return'--palette-'+context.slice(0,2)+'-'+n.toString(16).padStart(8,'0');}
