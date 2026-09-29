import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerProfileService, ProfileRequestsSummary, ProfileChangeRequest, ChangeRequestStatus } from '../../../../../core/services/marketer-profile.service';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit {
  private profileService = inject(MarketerProfileService);

  activeFilter = signal<string>('all');
  summary = signal<ProfileRequestsSummary | null>(null);
  selectedRequest = signal<ProfileChangeRequest | null>(null);

  ChangeRequestStatus = ChangeRequestStatus;

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.profileService.getRequests().subscribe(res => {
      if (res.success && res.data) {
        this.summary.set(res.data);
      }
    });
  }

  setFilter(filter: string) {
    this.activeFilter.set(filter);
  }

  get filteredRequests(): ProfileChangeRequest[] {
    const sum = this.summary();
    if (!sum) return [];
    if (this.activeFilter() === 'all') return sum.items;

    return sum.items.filter(item => {
      if (this.activeFilter() === 'ai') return item.status === ChangeRequestStatus.PENDING_AI_REVIEW;
      if (this.activeFilter() === 'human') return item.status === ChangeRequestStatus.PENDING_HUMAN_APPROVAL;
      if (this.activeFilter() === 'ok') return item.status === ChangeRequestStatus.APPROVED_AND_APPLIED;
      if (this.activeFilter() === 'rej') return item.status === ChangeRequestStatus.REJECTED;
      return true;
    });
  }

  withdrawRequest(id: string) {
    if (confirm('سحب طلب التعديل ' + id + '؟ لن يتم تطبيق التغيير وتعود البيانات لقيمتها الحالية')) {
      this.profileService.withdrawRequest(id).subscribe(res => {
        if (res.success) {
          alert('تم سحب طلب التعديل ' + id);
          this.loadRequests();
        }
      });
    }
  }

  showDetails(msg: string) {
    alert(msg);
  }

  // Replaces the previous bare alert("عرض تفاصيل الطلب " + requestNumber) —
  // every field shown here was already loaded by getRequests(), just never
  // surfaced for an approved/withdrawn request's own "التفاصيل" action.
  openRequestDetails(req: ProfileChangeRequest) {
    this.selectedRequest.set(req);
  }

  closeRequestDetails() {
    this.selectedRequest.set(null);
  }
}
