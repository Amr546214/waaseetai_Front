import { Component, ElementRef, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { SpecialtyService } from '../../../../core/services/specialty.service';
import { ClientRequestPayload } from '../../../../core/models/api.model';
import { mapHttpError } from '../../../../core/forms/http-error';
import { focusInvalidControls } from '../../../../shared/forms/form-error-focus';
import { backendBannerMessage, genericBanner } from '../../../../shared/forms/submit-feedback';

/** Server field name -> id of the control in the template. */
const REQUEST_FIELD_IDS: Record<string, string> = {
  title: 'req-title', specialtyId: 'req-cat', specialty: 'req-cat', description: 'req-desc',
  minBudget: 'req-budget', maxBudget: 'req-budget', budget: 'req-budget',
  expectedDurationDays: 'req-deadline', deliveryDays: 'req-deadline',
};

interface Category {
  id: string;
  name: string;
}

@Component({
  selector: 'app-custom-request',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './custom-request.html',
  styleUrls: ['../components/checkout-tokens.css', './custom-request.css'],
})
export class CustomRequestComponent implements OnInit {
  private projectApi = inject(ProjectApiService);
  private specialtyService = inject(SpecialtyService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  categories = signal<Category[]>([]);
  categoriesLoading = signal(false);

  title = signal('');
  selectedCategoryId = signal('');
  description = signal('');
  budget = signal<number | null>(null);
  deliveryDays = signal<number | null>(null);
  additionalNotes = signal('');
  attachments = signal<File[]>([]);

  isSubmitting = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);

  touched = signal({
    title: false,
    category: false,
    description: false,
    budget: false,
    deliveryDays: false,
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.specialtyService.getCategories().subscribe({
      next: (res: any) => {
        const list = res && res.success && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        const mapped: Category[] = list.map((cat: any) => ({
          id: cat.id || cat.name,
          name: cat.nameAr || cat.name,
        }));
        this.categories.set(mapped);
        this.categoriesLoading.set(false);
      },
      error: () => {
        this.categoriesLoading.set(false);
      },
    });
  }

  titleError = computed(() => {
    if (!this.touched().title && !this.isSubmitting()) return '';
    if (!this.title().trim()) return 'العنوان مطلوب';
    if (this.title().trim().length < 3) return 'العنوان قصير جداً';
    return '';
  });

  categoryError = computed(() => {
    if (!this.touched().category && !this.isSubmitting()) return '';
    if (!this.selectedCategoryId()) return 'التخصص مطلوب';
    return '';
  });

  descriptionError = computed(() => {
    if (!this.touched().description && !this.isSubmitting()) return '';
    if (!this.description().trim()) return 'الوصف مطلوب';
    if (this.description().trim().length < 10) return 'الوصف قصير جداً (10 أحرف على الأقل)';
    return '';
  });

  budgetError = computed(() => {
    if (!this.touched().budget && !this.isSubmitting()) return '';
    if (this.budget() === null || this.budget()! <= 0) return 'الميزانية يجب أن تكون رقماً موجباً';
    return '';
  });

  deliveryDaysError = computed(() => {
    if (!this.touched().deliveryDays && !this.isSubmitting()) return '';
    if (this.deliveryDays() === null || this.deliveryDays()! <= 0) return 'مدة التنفيذ يجب أن تكون رقماً موجباً';
    return '';
  });

  isFormValid = computed(() => {
    return !!this.title().trim() &&
      this.title().trim().length >= 3 &&
      !!this.selectedCategoryId() &&
      !!this.description().trim() &&
      this.description().trim().length >= 10 &&
      this.budget() !== null && this.budget()! > 0 &&
      this.deliveryDays() !== null && this.deliveryDays()! > 0;
  });

  canSubmit = computed(() => this.isFormValid() && !this.isSubmitting());

  markTouched(field: 'title' | 'category' | 'description' | 'budget' | 'deliveryDays'): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  handleFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
      input.value = '';
    }
  }

  // P-BF-007 file-upload drag & drop
  isDragging = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files?.length) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  private addFiles(files: FileList): void {
    const newFiles = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    this.attachments.update(f => [...f, ...newFiles].slice(0, 5));
  }

  removeFile(index: number): void {
    this.attachments.update(f => f.filter((_, i) => i !== index));
  }

  async submitRequest(): Promise<void> {
    this.touched.set({
      title: true, category: true, description: true, budget: true, deliveryDays: true,
    });

    if (this.isSubmitting()) return;
    if (!this.isFormValid()) {
      // Every problem has its message under the field (the *Error signals); here the first one gets focus, below the header.
      const missing = [
        { id: 'req-title', msg: this.titleError() },
        { id: 'req-cat', msg: this.categoryError() },
        { id: 'req-desc', msg: this.descriptionError() },
        { id: 'req-budget', msg: this.budgetError() },
        { id: 'req-deadline', msg: this.deliveryDaysError() },
      ].filter(x => x.msg).map(x => ({ path: x.id, message: x.msg }));
      void focusInvalidControls(this.host.nativeElement, missing);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    let uploadedUrls: string[] = [];

    if (this.attachments().length > 0) {
      try {
        const uploadRes: any = await this.projectApi.uploadAttachments(this.attachments()).toPromise();
        if (uploadRes && Array.isArray(uploadRes.urls)) {
          uploadedUrls = uploadRes.urls;
        } else if (uploadRes && uploadRes.data && Array.isArray(uploadRes.data)) {
          uploadedUrls = uploadRes.data.map((a: any) => a.fileUrl || a.url || a);
        }
      } catch {
        this.isSubmitting.set(false);
        this.errorMessage.set('تعذر رفع الملفات. تحقق من الاتصال وحاول مرة أخرى.');
        return;
      }
    }

    const cat = this.categories().find(c => c.id === this.selectedCategoryId());

    const payload: ClientRequestPayload = {
      specialtyId: this.selectedCategoryId(),
      specialty: cat?.name || 'عام',
      title: this.title().trim(),
      description: this.description().trim(),
      budgetType: 'FIXED',
      minBudget: this.budget(),
      maxBudget: this.budget(),
      expectedDurationDays: this.deliveryDays(),
      preferredProviderType: 'ANY',
      requiresNda: false,
      attachments: uploadedUrls,
      customConditions: this.additionalNotes().trim() || undefined,
      allowNegotiation: true,
    };

    this.projectApi.createProject(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showSuccess.set(true);
      },
      error: async (err) => {
        const mapped = mapHttpError(err, { fallback: 'حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى' });
        // 400/422 with field names -> under the field; network / 429 / 5xx / 403 / 409 stay one honest banner.
        const banner = genericBanner(mapped) ?? await backendBannerMessage(this.host.nativeElement, mapped, { resolve: REQUEST_FIELD_IDS });
        this.isSubmitting.set(false);
        this.errorMessage.set(banner || null);
      },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/client-overview']);
  }
}
