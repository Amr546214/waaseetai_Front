import { Component } from '@angular/core';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';

// Real measurements from GET /api/admin/infrastructure/apis (SUPER_ADMIN, official deployment): every block names its source, scope and time; no source = «غير متاح» + the named requirement.
@Component({
  selector: 'app-sa-apis',
  standalone: true,
  imports: [InfraPanelComponent],
  template: '<app-infra-panel endpoint="apis" title="إدارة APIs" />',
})
export class SaApis {}
