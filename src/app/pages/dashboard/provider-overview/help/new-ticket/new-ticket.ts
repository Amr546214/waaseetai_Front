
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  signal,
  inject,
  computed
} from '@angular/core';

import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, reportProblems } from '../../../../../shared/forms/form-error-focus';
import {
  clearTicketField,
  reportTicketError,
  ticketProblems
} from '../ticket-form';

@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    WsSelectComponent
  ],
  templateUrl: './new-ticket.html',
  styleUrls: ['./new-ticket.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewTicketComponent {

  private router = inject(Router);
  private authStore = inject(AuthStore);
  private ticketApi = inject(TicketApiService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  category = signal<string>('');
  priority = signal<string>('عادية');
  subject = signal<string>('');
  description = signal<string>('');
  relatedOrder = signal<string>('');
  relatedProject = signal<string>('');
  relatedMember = signal<string>('');
  ccEmail = signal<string>('');
  submitting = signal<boolean>(false);

  categories = [
    'العقود والضمان',
    'المحفظة والمدفوعات',
    'النزاعات',
    'حسابي وأماني',
    'المشاريع والتسليم',
    'أخرى'
  ];

  companyCategories = [
    'مالية — محفظة أو سحب أو فواتير',
    'مشاريع — مراحل أو تسليم أو أوامر تغيير',
    'فريق — أعضاء أو أدوار أو صلاحيات',
    'سوق — نماذج أو اعتماد أو طلبات',
    'تقني — خطأ في اللوحة',
    'أخرى'
  ];

  // No company team/project-link source is wired to this form yet.
  companyProjects = [
    'بدون ربط'
  ];

  companyMembers = [
    'بدون تحديد'
  ];

  priorities = ['عادية', 'عالية', 'عاجلة'];

  companyPriorities = [
    {
      id: 'low',
      label: 'منخفضة',
      desc: 'استفسار عام لا يعطّل العمل'
    },
    {
      id: 'medium',
      label: 'متوسطة',
      desc: 'يؤثر على مشروع أو مبلغ محدد'
    },
    {
      id: 'high',
      label: 'عالية',
      desc: 'يعطّل تسليماً أو عملية مالية'
    }
  ];

  selectedPriorityId = signal<string>('medium');

  errors = signal<{ [k: string]: string }>({});

  get activeCategories() {
    return this.isCompanyMode()
      ? this.companyCategories
      : this.categories;
  }

  pickPriority(id: string) {
    this.selectedPriorityId.set(id);

    const p = this.companyPriorities.find(
      x => x.id === id
    );

    if (p) {
      this.priority.set(p.label);
    }
  }

  /** Clear field errors after editing. */
  edited(name: string) {
    clearTicketField(this.host.nativeElement, name);
  }

  // =========================================
  // Attachments - New Fix
  // =========================================

  selectedAttachments: File[] = [];

  attachmentError = signal<string>('');

  private readonly maxAttachmentSize =
    10 * 1024 * 1024;

  private readonly allowedAttachmentTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ];

  onAttachmentsSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) {
      return;
    }

    for (const file of files) {

      if (!this.allowedAttachmentTypes.includes(file.type)) {
        this.attachmentError.set(
          `نوع الملف «${file.name}» غير مسموح. اختر JPG أو PNG أو PDF.`
        );
        input.value = '';
        return;
      }

      if (file.size > this.maxAttachmentSize) {
        this.attachmentError.set(
          `حجم الملف «${file.name}» أكبر من 10MB.`
        );
        input.value = '';
        return;
      }
    }

    this.selectedAttachments = [
      ...this.selectedAttachments,
      ...files
    ];

    this.attachmentError.set('');

    // Allow selecting the same file again.
    input.value = '';
  }

  removeAttachment(index: number) {
    this.selectedAttachments =
      this.selectedAttachments.filter(
        (_, i) => i !== index
      );

    this.attachmentError.set('');
  }

  // =========================================
  // Submit Ticket
  // =========================================

  async submit() {

    // Prevent multiple submissions.
    if (this.submitting() || this.guard.busy) {
      return;
    }

    const root = this.host.nativeElement;

    const problems = ticketProblems(
      root,
      {
        subject: this.subject(),
        category: this.category(),
        description: this.description()
      },
      ['category', 'subject', 'description']
    );

    const errs: { [k: string]: string } = {};

    for (const p of problems) {
      errs[
        ({
          category: 'cat',
          subject: 'subj',
          description: 'desc'
        } as Record<string, string>)[p.field!]
      ] = p.message;
    }

    this.errors.set(errs);

    if (problems.length > 0) {
      await reportProblems(root, problems);
      return;
    }

    // Do not create a ticket silently without its selected attachments.
    // TicketApiService currently has no confirmed attachments contract.
    if (this.selectedAttachments.length > 0) {
      const message =
        'تم اختيار المرفقات، لكن إرسال الملفات إلى السيرفر غير مربوط بعد. لن يتم فتح التذكرة بدون المرفقات المختارة.';

      this.attachmentError.set(message);
      this.notify.error(message);
      return;
    }

    this.attachmentError.set('');

    if (!this.guard.enter()) {
      return;
    }

    this.submitting.set(true);

    this.ticketApi.createTicket('provider', {
      subject: this.subject().trim(),
      category: this.category(),
      priority: this.priority(),
      description: this.description().trim(),
      relatedOrder:
        this.relatedOrder().trim() || undefined,
      relatedProject:
        this.relatedProject() || undefined,
      relatedMember:
        this.relatedMember() || undefined,
      ccEmail:
        this.ccEmail().trim() || undefined
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.guard.release();

        if (res.success && res.data) {
          this.notify.success(
            'تم فتح تذكرتك بنجاح'
          );

          setTimeout(() => {
            this.router.navigate([
              '/provider-overview/help/tickets',
              res.data!.id
            ]);
          }, 1200);

        } else {
          this.notify.error(
            res.message || 'تعذر فتح التذكرة'
          );
        }
      },

      error: (err) => {
        this.submitting.set(false);
        this.guard.release();

        void reportTicketError(
          root,
          err,
          this.notify,
          'تعذر فتح التذكرة، حاول مرة أخرى'
        );
      }
    });
  }
}
