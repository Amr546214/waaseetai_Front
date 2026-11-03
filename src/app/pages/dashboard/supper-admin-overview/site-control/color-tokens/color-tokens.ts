import {Component,signal,ViewEncapsulation} from '@angular/core';
import {TokenEditor} from '../platform-tokens/token-editor';
@Component({selector:'sc-color-tokens',standalone:true,imports:[TokenEditor],templateUrl:'./color-tokens.html',encapsulation:ViewEncapsulation.ShadowDom,styleUrls:['../site-control-base.css','./color-tokens.css']})
export class ColorTokens {
 readonly section=signal<'core'|'palette'|'layout'>('core');
 readonly mode=signal<'dark'|'light'>('dark');
 readonly sections=[{id:'core' as const,label:'ألوان الهوية'},{id:'palette' as const,label:'ألوان مواضع الموقع'},{id:'layout' as const,label:'الأبعاد'}];
 keys():string[]{return this.section()==='layout'?['tokens.layout']:[this.section()==='core'?'tokens.colors.'+this.mode():'tokens.palette.'+this.mode()];}
}
