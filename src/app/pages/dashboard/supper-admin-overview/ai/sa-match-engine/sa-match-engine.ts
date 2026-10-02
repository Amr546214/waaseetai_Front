import { Component } from '@angular/core';

// AI Cleanup Batch 3: this page used to render fully hardcoded matching data — invented
// factor weights, a fake "live match" score, an invented model name and
// training-set size, fabricated decision rows
// and an "explainability" drill-down about named providers — plus dead
// "export"/"adjust weights" buttons. None of it came from the backend, so the page
// now shows an honest "not available" state instead.
@Component({
  selector: 'app-sa-match-engine',
  standalone: true,
  imports: [],
  templateUrl: './sa-match-engine.html',
  styleUrl: './sa-match-engine.css',
})
export class SaMatchEngine {}
