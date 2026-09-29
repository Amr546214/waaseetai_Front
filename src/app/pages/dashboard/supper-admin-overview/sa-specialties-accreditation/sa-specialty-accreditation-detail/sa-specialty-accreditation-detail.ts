import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ACCREDITATION_REQUESTS, AccreditationRequest, ReqStatus } from '../sa-specialties-accreditation.data';

@Component({
  selector: 'app-sa-specialty-accreditation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-specialty-accreditation-detail.html',
  styleUrls: ['../sa-specialties-accreditation.css', './sa-specialty-accreditation-detail.css'],
})
export class SaSpecialtyAccreditationDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  toast = signal('');
  reviewerNote = signal('');
  selectedId = signal<string | null>(null);

  // MOCK — see sa-specialties-accreditation.data.ts. Approve/reject only
  // update this local signal (no backend endpoint yet); nothing is persisted.
  requests = signal<AccreditationRequest[]>(ACCREDITATION_REQUESTS);

  selected = computed(() => this.requests().find((r) => String(r.id) === this.selectedId()) ?? null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.selectedId.set(params.get('id'));
      this.reviewerNote.set('');
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/specialties-accreditation']);
  }

  approveRequest(req: AccreditationRequest) {
    this.requests.update((list) => list.map((r) => (r.id === req.id ? { ...r, status: 'approved' as ReqStatus } : r)));
    this.showToast(`تم قبول اعتماد ${req.provider} في تخصص ${req.specialty}`);
  }

  rejectRequest(req: AccreditationRequest) {
    this.requests.update((list) => list.map((r) => (r.id === req.id ? { ...r, status: 'rejected' as ReqStatus } : r)));
    this.showToast(`تم رفض طلب اعتماد ${req.provider}`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
