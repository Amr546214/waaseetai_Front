import { Component } from '@angular/core';
import { AdminAiRecords } from '../shared/admin-ai-records';
@Component({
  selector: 'app-sa-ai-audit',
  imports: [AdminAiRecords],
  template: '<app-admin-ai-records kind="audit" />',
})
export class SaAiAudit {}
