import { Component } from '@angular/core';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';
import { InfraActionsComponent } from '../../../../../shared/infra-actions.component';
@Component({selector:'app-sa-backups',standalone:true,imports:[InfraPanelComponent,InfraActionsComponent],template:'<app-infra-panel endpoint="backups" title="النسخ الاحتياطي"><app-infra-actions kind="backups" /></app-infra-panel>'})
export class SaBackups {}
