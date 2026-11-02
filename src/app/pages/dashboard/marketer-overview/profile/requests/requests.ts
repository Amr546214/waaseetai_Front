import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { MarketerProfileService, ProfileRequestsSummary, ProfileChangeRequest, ChangeRequestStatus } from '../../../../../core/services/marketer-profile.service';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [WsDatePipe, CommonModule],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests implements OnInit, OnDestroy {
  private profileService = inject(MarketerProfileService);
  private notify = inject(UiNotificationService);
  private platformId = inject(PLATFORM_ID);
  private previouslyFocused: HTMLElement | null = null;
  private previousBodyOverflow: string | null = null;

  @ViewChild('requestDialog') private requestDialog?: ElementRef<HTMLElement>;
  @ViewChild('requestDialogClose') private requestDialogClose?: ElementRef<HTMLButtonElement>;

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
    if (isPlatformBrowser(this.platformId) && !this.selectedRequest()) {
      this.previouslyFocused = document.activeElement as HTMLElement;
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    this.selectedRequest.set(req);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.requestDialogClose?.nativeElement.focus(), 0);
    }
  }

  closeRequestDetails() {
    this.selectedRequest.set(null);
    this.restoreModalEnvironment();
  }

  ngOnDestroy() {
    this.restoreModalEnvironment();
  }

  @HostListener('document:keydown', ['$event'])
  onDialogKeydown(event: KeyboardEvent) {
    if (!this.selectedRequest()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeRequestDetails();
      return;
    }

    if (event.key !== 'Tab' || !this.requestDialog) return;
    const focusable = this.requestDialog.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) {
      event.preventDefault();
      this.requestDialog.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private restoreModalEnvironment() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.previousBodyOverflow !== null) {
      document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = null;
    }
    const target = this.previouslyFocused;
    this.previouslyFocused = null;
    if (target?.isConnected) target.focus();
  }
}
