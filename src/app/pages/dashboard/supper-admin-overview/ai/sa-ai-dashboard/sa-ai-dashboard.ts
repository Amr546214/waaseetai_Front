import { Component } from '@angular/core';
import { AdminAiRecords } from '../shared/admin-ai-records';
@Component({
  selector: 'app-sa-ai-dashboard',
  imports: [AdminAiRecords],
  template: '<app-admin-ai-records kind="overview" />',
})
export class SaAiDashboard {}
