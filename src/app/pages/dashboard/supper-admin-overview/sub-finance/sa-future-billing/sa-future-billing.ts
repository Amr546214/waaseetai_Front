import {Component,OnInit,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {OperationsPage,Paged,Upcoming} from '../../../../../core/services/admin-operations.service';
@Component({selector:'app-sa-future-billing',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./sa-future-billing.html',styleUrl:'../../../../../shared/admin-operations.css'})
export class SaFutureBilling extends OperationsPage implements OnInit {
data=signal<Paged<Upcoming>|null>(null);page=1;
 ngOnInit(){this.load();}load(){this.request(this.api.get<Paged<Upcoming>>(`upcoming?page=${this.page}`),d=>this.data.set(d));}turn(n:number){this.page+=n;this.load();}
}
