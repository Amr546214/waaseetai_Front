import {Component,ViewEncapsulation,signal} from '@angular/core';
import {TokenEditor} from '../platform-tokens/token-editor';
import {PRESENTATION_GROUPS} from '../../../../../core/identity/presentation-controls';
@Component({selector:'sc-typography',standalone:true,imports:[TokenEditor],encapsulation:ViewEncapsulation.ShadowDom,templateUrl:'./typography.html',styleUrls:['../site-control-base.css','./typography.css']})
export class Typography{readonly roles=PRESENTATION_GROUPS.filter(g=>g.key==='tokens.typography');readonly prefix=signal('--font-family');}
