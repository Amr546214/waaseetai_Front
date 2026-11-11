import { Component } from '@angular/core';
import { AdminAiRecords } from '../shared/admin-ai-records';
@Component({
  selector: 'app-sa-match-engine',
  imports: [AdminAiRecords],
  template: '<app-admin-ai-records kind="matching" />',
})
export class SaMatchEngine {}
