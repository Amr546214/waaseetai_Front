import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';

export interface AccreditationSampleItem {
  id: string;
  title: string;
  description: string;
  projectUrl?: string;
  githubUrl?: string;
  technologiesUsed: string[];
  attachments: string[];
  status: 'PENDING_AI_AUDIT' | 'AI_VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  aiScore?: number;
  aiQualityRating?: string;
  aiFeedbackAr?: string;
  aiStrengths: string[];
  aiRecommendations: string[];
  aiAuditedAt?: string;
  createdAt: string;
  providerSpecialty?: {
    specialty?: {
      nameAr?: string;
      nameEn?: string;
      icon?: string;
    };
  };
}

@Component({
  selector: 'app-business-models-accreditation-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export class List implements OnInit {
  private providerApi = inject(ProviderApiService);

  isLoading = signal<boolean>(true);
  samples = signal<AccreditationSampleItem[]>([]);

  ngOnInit() {
    this.fetchSamples();
  }

  fetchSamples() {
    this.isLoading.set(true);
    this.providerApi.getAccreditationSamples().subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.samples)) {
          this.samples.set(res.samples);
        } else {
          this.samples.set([]);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }
}
