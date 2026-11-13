import {AdminAccessService} from '../../../../../core/services/admin-access.service';
import {Component,OnInit,signal,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {OperationsPage,CashbackData,CashbackPending} from '../../../../../core/services/admin-operations.service';
@Component({selector:'app-sa-cashback',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./sa-cashback.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class SaCashback extends OperationsPage implements OnInit {
 readonly access=inject(AdminAccessService);
 data=signal<CashbackData|null>(null);page=1;selected=signal<CashbackPending|null>(null);score:number|null=null;reason='';confirmed=false;
 ngOnInit(){this.load();}
 load(){this.request(this.api.get<CashbackData>(`cashback?page=${this.page}`),d=>this.data.set(d));}
 edit(row:CashbackPending){this.selected.set(row);this.score=row.paymentInput;this.reason='';this.confirmed=false;this.error.set('');}
 save(){const r=this.selected();if(!r||this.score==null||!this.reason.trim()||!this.confirmed)return;this.request(this.api.post<{status:string}>(`cashback/${r.contractId}/score`,{version:r.version,score:this.score,note:this.reason}),d=>{this.selected.set(null);this.load();});}
 turn(delta:number){this.page+=delta;this.load();}
 state(s:string){return ({WAITING_PAYMENT_SCORE:'بانتظار درجة السداد',WAITING_RATING:'بانتظار تقييم حقيقي',CREDITED:'أضيف للمحفظة'} as Record<string,string>)[s]||s;}

}
