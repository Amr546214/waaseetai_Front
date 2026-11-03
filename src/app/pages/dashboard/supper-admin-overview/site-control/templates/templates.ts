import {Component,ViewEncapsulation,signal} from '@angular/core';
import {TokenEditor} from '../platform-tokens/token-editor';
import {PRESENTATION_GROUPS} from '../../../../../core/identity/presentation-controls';
@Component({selector:'sc-templates',standalone:true,imports:[TokenEditor],encapsulation:ViewEncapsulation.ShadowDom,templateUrl:'./templates.html',styleUrls:['../site-control-base.css','./templates.css']})
export class Templates{readonly groups=PRESENTATION_GROUPS.filter(g=>g.key==='tokens.components'&&!g.id.startsWith('level-'));readonly selected=signal('button');}
