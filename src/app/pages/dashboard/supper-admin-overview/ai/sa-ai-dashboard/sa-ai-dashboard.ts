import { Component } from '@angular/core';

// AI Cleanup Batch 3: this page used to render a fully hardcoded set of "AI models"
// (invented names, accuracy %, request volumes, training dates) and dead
// "export"/"retrain" buttons. No model registry, accuracy tracking or retraining
// pipeline exists in the backend, so the page now shows an honest
// "not available" state instead of operational-looking fake data.
@Component({
  selector: 'app-sa-ai-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './sa-ai-dashboard.html',
  styleUrl: './sa-ai-dashboard.css',
})
export class SaAiDashboard {}
