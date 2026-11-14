import {Component,computed,effect,input,signal,untracked,ViewEncapsulation} from '@angular/core';
import {TokenEditor} from '../platform-tokens/token-editor';
@Component({selector:'sc-color-tokens',standalone:true,imports:[TokenEditor],templateUrl:'./color-tokens.html',encapsulation:ViewEncapsulation.ShadowDom,styleUrls:['../site-control-base.css','./color-tokens.css']})
export class ColorTokens {
 /** which part of the old page this instance is: the colours (identity + site places, dark and light) or the dimensions (radius, container) */
 readonly part=input<'colors'|'layout'>('colors');
 readonly section=signal<'core'|'palette'|'layout'>('core');
 readonly mode=signal<'dark'|'light'>('dark');
 readonly sections=computed(()=>this.part()==='layout'?[{id:'layout' as const,label:'الأبعاد'}]:[{id:'core' as const,label:'ألوان الهوية'},{id:'palette' as const,label:'ألوان مواضع الموقع'}]);
 constructor(){effect(()=>{const p=this.part();untracked(()=>this.section.set(p==='layout'?'layout':'core'));});}
 keys():string[]{return this.section()==='layout'?['tokens.layout']:[this.section()==='core'?'tokens.colors.'+this.mode():'tokens.palette.'+this.mode()];}
}
