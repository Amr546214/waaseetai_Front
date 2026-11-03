import {Component,OnInit,ViewEncapsulation,computed,inject,signal} from '@angular/core';
import {TokenEditor} from '../platform-tokens/token-editor';
import {LevelsService,LevelRow} from '../../../../../core/levels/levels.service';
import {LevelBadgeComponent} from '../../../../../shared/levels/level-badge.component';
import {levelDisplayFromInfo} from '../../../../../core/levels/level-display';
type Role='PROVIDER'|'CLIENT'|'MARKETER';
@Component({selector:'sc-accounts',standalone:true,imports:[TokenEditor,LevelBadgeComponent],encapsulation:ViewEncapsulation.ShadowDom,templateUrl:'./accounts.html',styleUrls:['../site-control-base.css','./accounts.css']})
export class Accounts implements OnInit{
 readonly levels=inject(LevelsService);readonly role=signal<Role>('PROVIDER');readonly index=signal(1);readonly error=signal('');readonly busy=signal(false);
 readonly roles:{id:Role;label:string}[]=[{id:'PROVIDER',label:'مقدّم الخدمة'},{id:'CLIENT',label:'العميل'},{id:'MARKETER',label:'المسوّق'}];
 readonly rows=computed(()=>this.levels.payload()?.roles[this.role()]?.levels??[]);
 readonly prefix=computed(()=>'--comp-level-'+this.role().toLowerCase()+'-'+this.index()+'-');
 ngOnInit(){this.reload();}
 reload(){this.busy.set(true);this.error.set('');this.levels.load().subscribe({next:()=>this.busy.set(false),error:()=>{this.busy.set(false);this.error.set('تعذّر تحميل المستويات الفعلية من الخادم.');}});}
 display(row:LevelRow){return levelDisplayFromInfo({role:this.role(),index:row.level,total:15,name:row.name,percent:row.percent,percentKind:this.role()==='PROVIDER'?'PLATFORM_COMMISSION':this.role()==='CLIENT'?'CASHBACK':'EARNED_COMMISSION',color:row.color});}
}
