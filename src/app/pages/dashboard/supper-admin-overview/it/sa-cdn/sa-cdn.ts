import { Component } from '@angular/core';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';
import { InfraActionsComponent } from '../../../../../shared/infra-actions.component';
@Component({selector:'app-sa-cdn',standalone:true,imports:[InfraPanelComponent,InfraActionsComponent],template:'<app-infra-panel endpoint="cdn" title="الأصول وCDN"><app-infra-actions kind="cdn" /></app-infra-panel>'})
export class SaCdn {}
