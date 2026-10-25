import { Component, inject, OnInit, signal } from '@angular/core';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { MarketerProfileService, ProfileRequestsSummary, ProfileChangeRequest, ChangeRequestStatus } from '../../../../../core/services/marketer-profile.service';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [WsDatePipe, CommonModule],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit {
  private profileService = inject(MarketerProfileService);
  private notify = inject(UiNotificationService);

  activeFilter = signal<string>('all');
  summary = signal<ProfileRequestsSummary | null>(null);
  isLoading = signal<boolean>(true);
  /** The read failed (401/429/5xx/network): never shown as zero counters / "no requests". */
  loadError = signal<boolean>(false);
  selectedRequest = signal<ProfileChangeRequest | null>(null);

  ChangeRequestStatus = ChangeRequestStatus;

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.profileService.getRequests().subscribe({
      next: res => {
        if (res?.success && res.data) {
          this.summary.set(res.data);
        } else {
          this.summary.set(null);
          this.loadError.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.loadError.set(true);
        this.isLoading.set(false);
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
          this.notify.success('تم سحب طلب التعديل ' + id);
          this.loadRequests();
        }
      });
    }
  }

  showDetails(msg: string) {
    this.notify.info(msg);
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
