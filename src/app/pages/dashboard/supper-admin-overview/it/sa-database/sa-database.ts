import { Component } from '@angular/core';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';

// Real measurements from GET /api/admin/infrastructure/database (SUPER_ADMIN, official deployment): every block names its source, scope and time; no source = «غير متاح» + the named requirement.
@Component({
  selector: 'app-sa-database',
  standalone: true,
  imports: [InfraPanelComponent],
  template: '<app-infra-panel endpoint="database" title="قاعدة البيانات" />',
})
export class SaDatabase {}
