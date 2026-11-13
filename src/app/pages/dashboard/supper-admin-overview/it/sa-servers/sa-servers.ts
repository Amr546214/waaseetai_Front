import { Component } from '@angular/core';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';

// Real measurements from GET /api/admin/infrastructure/servers (SUPER_ADMIN, official deployment): every block names its source, scope and time; no source = «غير متاح» + the named requirement.
@Component({
  selector: 'app-sa-servers',
  standalone: true,
  imports: [InfraPanelComponent],
  template: '<app-infra-panel endpoint="servers" title="الخوادم والصحة" />',
})
export class SaServers {}
