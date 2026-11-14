export interface CmsTextEdit { key: string; original: string; value: string }
export interface CmsCopy { version: 1; edits: CmsTextEdit[] }
export interface CmsTextView { key: string; original: string; value: string; kind: 'text' | 'placeholder' }
export interface CmsBridge { getTexts(): CmsTextView[]; setCopy(copy: CmsCopy): void }
export type CmsRoot = HTMLElement & { wsCmsBridge?: CmsBridge };
export const emptyCmsCopy = (): CmsCopy => ({version:1,edits:[]});
export function isCmsCopy(value: unknown): value is CmsCopy {
 const c=value as CmsCopy|null;
 return c?.version===1&&Array.isArray(c.edits)&&c.edits.length<=1000&&c.edits.every(e=>typeof e.key==='string'&&typeof e.original==='string'&&typeof e.value==='string');
}
const IGNORED='script,style,svg,canvas,textarea,select,option,[data-ws-cms-ignore],[aria-hidden="true"]';
const hash=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(36);};
interface Slot extends CmsTextView {node:Text|HTMLElement;raw:string;last:string;wrapper?:HTMLElement}
/** Edits only text nodes / placeholder attributes. Never interprets HTML and never replaces the page layout. */
export class CmsTextSurface {
 private slots=new Map<string,Slot>();private tracked=new WeakMap<Node,Slot>();private copy=emptyCmsCopy();private observer:MutationObserver;private queued=false;private disposed=false;
 constructor(private root:HTMLElement,private preview=false){
  const View=root.ownerDocument.defaultView!;
  this.observer=new View.MutationObserver(()=>this.schedule());
  this.scan();this.observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder']});
 }
 private schedule(){if(this.queued||this.disposed)return;this.queued=true;queueMicrotask(()=>{this.queued=false;if(!this.disposed)this.scan();});}
 private owns(el:Element){return !el.closest(IGNORED)&&el.closest('[data-ws-cms-page]')===this.root;}
 private path(el:Element):string {
  const parts:string[]=[];
  while(el!==this.root&&el.parentElement){
   if(!el.hasAttribute('data-ws-cms-slot')){
    const siblings=Array.from(el.parentElement.children).filter(e=>!e.hasAttribute('data-ws-cms-slot'));
    parts.unshift(`${el.tagName.toLowerCase()}.${siblings.indexOf(el)}`);
   }
   el=el.parentElement;
  }
  return parts.join('/');
 }
 private register(node:Text|HTMLElement,kind:'text'|'placeholder',raw:string){
  const original=raw.trim();if(!original||original.length>8000)return;
  let slot=this.tracked.get(node);
  if(slot){
   if(raw===slot.last||raw===slot.raw){this.slots.set(slot.key,slot);return;}
   this.slots.delete(slot.key); // Angular rendered another tab/FAQ/role into this same node: it is a new source text.
  }
  const parent=kind==='text'?(node.parentElement?.hasAttribute('data-ws-cms-slot')?node.parentElement.parentElement:node.parentElement):node as HTMLElement;
  if(!parent)return;
  const textChildren=Array.from(parent.childNodes).filter(n=>n.nodeType===3||(n.nodeType===1&&(n as Element).hasAttribute('data-ws-cms-slot')));
  const ordinal=kind==='text'?textChildren.indexOf(slot?.wrapper??node):0;
  const key=`copy:${hash(this.path(parent))}/${kind}.${ordinal}:${hash(original)}`;
  slot={key,original,value:original,kind,node,raw,last:raw,wrapper:slot?.wrapper};
  if(this.preview&&kind==='text'&&!slot.wrapper){
   const wrap=this.root.ownerDocument.createElement('span');wrap.dataset['wsCmsSlot']='';wrap.style.cssText='display:contents;color:inherit;font:inherit';
   node.parentNode?.insertBefore(wrap,node);wrap.appendChild(node);slot.wrapper=wrap;
  }
  if(this.preview)(slot.wrapper??node as HTMLElement).setAttribute('data-ws-cms-key',key);
  this.tracked.set(node,slot);this.slots.set(key,slot);
 }
 private scan(){
  const doc=this.root.ownerDocument;const walker=doc.createTreeWalker(this.root,4);const nodes:Text[]=[];let n:Node|null;
  while((n=walker.nextNode()))if(n.parentElement&&this.owns(n.parentElement))nodes.push(n as Text);
  for(const node of nodes)this.register(node,'text',node.data);
  for(const el of Array.from(this.root.querySelectorAll<HTMLElement>('[placeholder]')))if(this.owns(el))this.register(el,'placeholder',el.getAttribute('placeholder')||'');
  for(const [key,slot]of this.slots){
   if(!this.root.contains(slot.node)){this.slots.delete(key);continue;}
   const edit=this.copy.edits.find(e=>e.key===key&&e.original===slot.original);
   const value=edit?edit.value:slot.original;
   const raw=slot.kind==='placeholder'?value:slot.raw.slice(0,slot.raw.indexOf(slot.original))+value+slot.raw.slice(slot.raw.indexOf(slot.original)+slot.original.length);
   if(slot.kind==='text'){if((slot.node as Text).data!==raw)(slot.node as Text).data=raw;}
   else if((slot.node as HTMLElement).getAttribute('placeholder')!==raw)(slot.node as HTMLElement).setAttribute('placeholder',raw);
   slot.last=raw;slot.value=value;
  }
 }
 getTexts():CmsTextView[]{this.scan();return Array.from(this.slots.values()).map(({key,original,value,kind})=>({key,original,value,kind}));}
 setCopy(copy:CmsCopy){this.copy=isCmsCopy(copy)?structuredClone(copy):emptyCmsCopy();this.scan();}
 destroy(){this.disposed=true;this.observer.disconnect();}
}
