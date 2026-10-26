import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { WsDateTextPipe } from '../../../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SpecialtyStatusComponent } from '../../../../../../shared/forms/specialty-status.component';
import type { RegisteredSpecialty, SpecialtyApprovalInfo } from '../../../../../../core/utils/specialty-states';
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
  rejectionReason?: string | null;
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
  imports: [WsDateTextPipe, CommonModule, RouterLink, SpecialtyStatusComponent],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export class List implements OnInit {
  private providerApi = inject(ProviderApiService);

  isLoading = signal<boolean>(true);
  samples = signal<AccreditationSampleItem[]>([]);
  registeredSpecialties = signal<(RegisteredSpecialty & SpecialtyApprovalInfo)[]>([]);

  /** Real per-status counts of the loaded samples (these tab badges used to be a fixed 0). */
  counts = computed(() => {
    const list = this.samples();
    return {
      pending: list.filter(s => s.status === 'PENDING_AI_AUDIT' || s.status === 'MANUAL_REVIEW').length,
      accepted: list.filter(s => s.status === 'AI_VERIFIED').length,
      rejected: list.filter(s => s.status === 'REJECTED').length,
    };
  });

  /** The admin's reason of a rejected sample (the backend appends it to aiFeedbackAr under a fixed marker). */
  rejectionReason(s: AccreditationSampleItem): string | null {
    const text = s.aiFeedbackAr || '';
    const mark = '[مراجعة الإدارة] سبب الرفض:';
    const i = text.lastIndexOf(mark);
    return i < 0 ? null : (text.slice(i + mark.length).trim() || null);
  }

  ngOnInit() {
    this.fetchSamples();
    this.providerApi.getPassedSpecialties().subscribe({
      next: (res: any) => this.registeredSpecialties.set(Array.isArray(res?.registered) ? res.registered : []),
      error: () => this.registeredSpecialties.set([]),
    });
  
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
