import { Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SaSpecialtiesService, AdminCategory, AdminSpecialty, AdminSpecialtyStats } from './sa-specialties.service';

// One-time catalog import: fills in categories/specialties from the design reference
// (design-reference/extracted/.../P-MK-002.html) that are missing from the live DB.
// Existing categories are matched by their real id; specialty names for design/code/
// marketing/writing are taken verbatim from that design file. The remaining categories
// (translation, consulting, data) have no real design content, so their specialties
// are reasonable placeholder content pending real ones — flagged as such in the UI.
interface CatalogSpecialty { slug: string; nameAr: string; }
interface CatalogBlock {
	existingCategoryId?: string;
	create?: { slug: string; nameAr: string; icon: string };
	specialties: CatalogSpecialty[];
}
const IMPORT_CATALOG: CatalogBlock[] = [
	{
		existingCategoryId: '8a66bcc7-f947-4028-88af-aec7a46efd7d', // design-creative
		specialties: [
			{ slug: 'social-media-design', nameAr: 'تصميم السوشيال ميديا' },
			{ slug: 'packaging-product-design', nameAr: 'تصميم التغليف والمنتج' },
		]
	},
	{
		existingCategoryId: 'd0adf84a-69ab-48e5-8b5a-6204c4263076', // development-tech
		specialties: [
			{ slug: 'backend-api-development', nameAr: 'برمجة الخوادم والـ API' },
			{ slug: 'ecommerce-stores', nameAr: 'متاجر إلكترونية' },
			{ slug: 'automation-scripting', nameAr: 'أتمتة العمليات والسكريبت' },
			{ slug: 'security-testing', nameAr: 'أمن المعلومات والاختبار' },
		]
	},
	{
		existingCategoryId: '6c57d6c5-827b-436f-9201-37a123930ba1', // digital-marketing
		specialties: [
			{ slug: 'social-media-management', nameAr: 'إدارة حسابات السوشيال ميديا' },
			{ slug: 'email-marketing', nameAr: 'تسويق البريد الإلكتروني' },
			{ slug: 'influencer-marketing', nameAr: 'التسويق عبر المؤثرين' },
			{ slug: 'marketing-strategy', nameAr: 'استراتيجية وخطة تسويقية' },
		]
	},
	{
		existingCategoryId: 'e353f7a2-4ad1-41b8-b9d6-f23065824852', // content-writing
		specialties: [
			{ slug: 'seo-articles-blogs', nameAr: 'كتابة مقالات SEO والمدونات' },
			{ slug: 'product-descriptions', nameAr: 'وصف المنتجات والمتاجر' },
			{ slug: 'video-scripts', nameAr: 'سكريبت ونصوص الفيديو' },
			{ slug: 'cv-cover-letters', nameAr: 'سيرة ذاتية وخطابات' },
			{ slug: 'academic-research', nameAr: 'أبحاث ودراسات أكاديمية' },
		]
	},
	{
		existingCategoryId: '7d86f6e2-a367-4882-8667-454d7b5dd283', // video-animation
		specialties: [
			{ slug: 'video-production-filming', nameAr: 'تصوير وإنتاج فيديو' },
			{ slug: 'promotional-ad-videos', nameAr: 'فيديوهات إعلانية وترويجية' },
			{ slug: '3d-animation', nameAr: 'رسوم متحركة ثلاثية الأبعاد' },
		]
	},
	{
		// No real design content for this category — placeholder specialties, pending real content.
		create: { slug: 'translation-linguistics', nameAr: 'ترجمة ولغويات', icon: 'languages' },
		specialties: [
			{ slug: 'general-translation-ar-en', nameAr: 'ترجمة عامة عربي-إنجليزي' },
			{ slug: 'legal-certified-translation', nameAr: 'ترجمة قانونية ومعتمدة' },
			{ slug: 'technical-scientific-translation', nameAr: 'ترجمة تقنية وعلمية' },
			{ slug: 'proofreading-editing', nameAr: 'تدقيق لغوي وتحرير' },
			{ slug: 'remote-interpretation', nameAr: 'ترجمة فورية عن بعد' },
		]
	},
	{
		// No real design content for this category — placeholder specialties, pending real content.
		create: { slug: 'business-consulting', nameAr: 'استشارات أعمال', icon: 'message-circle' },
		specialties: [
			{ slug: 'management-strategy-consulting', nameAr: 'استشارات إدارية واستراتيجية' },
			{ slug: 'financial-accounting-consulting', nameAr: 'استشارات مالية ومحاسبية' },
			{ slug: 'feasibility-studies', nameAr: 'دراسات الجدوى الاقتصادية' },
			{ slug: 'hr-consulting', nameAr: 'استشارات الموارد البشرية' },
			{ slug: 'business-legal-consulting', nameAr: 'استشارات قانونية للأعمال' },
		]
	},
	{
		// No real design content for this category — placeholder specialties, pending real content.
		create: { slug: 'data-analytics', nameAr: 'بيانات وتحليل', icon: 'bar-chart' },
		specialties: [
			{ slug: 'data-analysis-reporting', nameAr: 'تحليل البيانات وإعداد التقارير' },
			{ slug: 'dashboard-design', nameAr: 'تصميم لوحات المعلومات (Dashboards)' },
			{ slug: 'data-science-ml', nameAr: 'علوم البيانات والتعلم الآلي' },
			{ slug: 'data-entry-processing', nameAr: 'إدخال ومعالجة البيانات' },
		]
	},
];

@Component({
  selector: 'app-sa-specialties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-specialties.html'
})
export class SaSpecialties implements OnInit {
  private service = inject(SaSpecialtiesService);

  searchQuery = signal('');
  isAddModalOpen = signal(false);
  isAddCategoryModalOpen = signal(false);
  
  editCategoryId = signal<string | null>(null);
  newCategoryName = signal('');
  newCategorySlug = signal('');
  
  editSpecId = signal<string | null>(null);
  newSpecName = signal('');
  newSpecSlug = signal('');
  newSpecCatId = signal('');
  newSpecReq = signal('');

  // Confirmation Modal Signal State
  isConfirmModalOpen = signal(false);
  confirmTitle = signal('');
  confirmMessage = signal('');
  confirmItemName = signal('');
  confirmWarning = signal('');
  confirmActionType = signal<'delete_spec' | 'delete_category' | null>(null);
  confirmTargetId = signal<string | null>(null);
  isConfirmLoading = signal(false);

  // Catalog import state
  isImporting = signal(false);
  importProgress = signal('');

  // Toast Notification Signal State
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  isToastOpen = signal(false);

  categories = signal<AdminCategory[]>([]);
  stats = signal<AdminSpecialtyStats>({
    totalSpecialties: 0,
    totalCategories: 0,
    activeSpecialtiesCount: 0,
    activeProvidersCount: 0,
    monthlyAccreditationRequests: 0,
  });

  filteredCategories = computed(() => this.categories());

  activeSpecsPercentage = computed(() => {
    const s = this.stats();
    if (s.totalSpecialties === 0) return 0;
    return Math.round((s.activeSpecialtiesCount / s.totalSpecialties) * 100);
  });

  constructor() {
    effect((onCleanup) => {
      const q = this.searchQuery();
      const timer = setTimeout(() => {
        this.loadTree(q);
      }, 300);
      onCleanup(() => clearTimeout(timer));
    });
  }

  ngOnInit() {
    this.loadStats();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.isToastOpen.set(true);
    setTimeout(() => this.isToastOpen.set(false), 3500);
  }

  loadStats() {
    this.service.getStats().subscribe({
      next: (res) => {
        if (res.success) this.stats.set(res.data);
      },
      error: (err) => console.error('Error fetching specialty stats', err)
    });
  }

  loadTree(search: string = '') {
    this.service.getTree(search).subscribe({
      next: (res) => {
        if (res.success) {
          this.categories.set(res.data);
          if (res.data.length > 0 && !this.newSpecCatId()) {
            this.newSpecCatId.set(res.data[0].id);
          }
        }
      },
      error: (err) => console.error('Error fetching specialties tree', err)
    });
  }

  // --- Category Actions ---
  toggleCategory(cat: AdminCategory) {
    const targetStatus = cat.isActive !== undefined ? !cat.isActive : false;

    // Optimistic UI update
    this.categories.update(cats =>
      cats.map(c => c.id === cat.id ? { ...c, isActive: targetStatus } : c)
    );

    this.service.toggleCategoryStatus(cat.id).subscribe({
      next: () => {
        this.showToast(targetStatus ? 'تم تفعيل القسم بنجاح' : 'تم تعطيل القسم بنجاح', 'success');
        this.loadStats();
      },
      error: (err) => {
        this.loadTree(this.searchQuery());
        this.showToast(err.error?.message || 'حدث خطأ أثناء تغيير حالة القسم', 'error');
      }
    });
  }

  promptDeleteCategory(cat: AdminCategory) {
    this.confirmTitle.set('تأكيد حذف القسم');
    this.confirmItemName.set(cat.nameAr);
    this.confirmTargetId.set(cat.id);
    this.confirmActionType.set('delete_category');

    if (cat.specialties && cat.specialties.length > 0) {
      this.confirmMessage.set(`هذا القسم يحتوي على ${cat.specialties.length} تخصصات.`);
      this.confirmWarning.set('لا يمكن حذف القسم حتى يتم حذف أو نقل جميع التخصصات التابعة له.');
    } else {
      this.confirmMessage.set('هل أنت متأكد من رغبتك في حذف هذا القسم نهائياً؟');
      this.confirmWarning.set('سيتم إزالة هذا القسم بشكل دائم من المنصة.');
    }

    this.isConfirmModalOpen.set(true);
  }

  openCategoryModal(cat?: AdminCategory) {
    if (cat) {
      this.editCategoryId.set(cat.id);
      this.newCategoryName.set(cat.nameAr);
      this.newCategorySlug.set((cat as any).slug || '');
    } else {
      this.editCategoryId.set(null);
      this.newCategoryName.set('');
      this.newCategorySlug.set('');
    }
    this.isAddCategoryModalOpen.set(true);
  }

  closeCategoryModal() {
    this.isAddCategoryModalOpen.set(false);
    this.editCategoryId.set(null);
    this.newCategoryName.set('');
    this.newCategorySlug.set('');
  }

  addCategory() {
    const name = this.newCategoryName().trim();
    const slug = this.newCategorySlug().trim();
    if (!name || !slug) {
      this.showToast('يرجى ادخال اسم القسم والرابط (Slug)', 'error');
      return;
    }

    const request$ = this.editCategoryId()
      ? this.service.updateCategory(this.editCategoryId()!, { nameAr: name, slug })
      : this.service.createCategory({ nameAr: name, slug });

    request$.subscribe({
      next: () => {
        this.showToast(this.editCategoryId() ? 'تم تحديث اسم القسم بنجاح' : 'تم إضافة القسم بنجاح', 'success');
        this.closeCategoryModal();
        this.loadTree(this.searchQuery());
        this.loadStats();
      },
      error: (err) => this.showToast(err.error?.message || 'حدث خطأ أثناء حفظ القسم', 'error')
    });
  }

  // --- Specialty Actions ---
  toggleSpec(id: string) {
    // Optimistic UI update
    this.categories.update(cats => cats.map(c => ({
      ...c,
      specialties: c.specialties.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s)
    })));

    this.service.toggleSpecialtyStatus(id).subscribe({
      next: () => {
        this.showToast('تم تحديث حالة التخصص بنجاح', 'success');
        this.loadStats();
      },
      error: (err) => {
        this.loadTree(this.searchQuery());
        this.showToast(err.error?.message || 'حدث خطأ أثناء تغيير حالة التخصص', 'error');
      }
    });
  }

  promptDeleteSpec(spec: AdminSpecialty) {
    this.confirmTitle.set('تأكيد حذف التخصص');
    this.confirmItemName.set(spec.nameAr);
    this.confirmTargetId.set(spec.id);
    this.confirmActionType.set('delete_spec');

    if (spec.providersCount > 0) {
      this.confirmMessage.set(`هذا التخصص مرتبط بـ ${spec.providersCount} مقدم خدمة معتمد.`);
      this.confirmWarning.set('لا يمكن حذف تخصص مرتبط بمقدمي خدمة نشطين لتفادي تعطيل حساباتهم.');
    } else {
      this.confirmMessage.set('هل أنت متأكد من رغبتك في حذف هذا التخصص؟');
      this.confirmWarning.set('سيتم إزالة هذا التخصص بشكل دائم.');
    }

    this.isConfirmModalOpen.set(true);
  }

  executeConfirmAction() {
    const action = this.confirmActionType();
    const id = this.confirmTargetId();
    if (!action || !id) return;

    this.isConfirmLoading.set(true);

    if (action === 'delete_category') {
      this.service.deleteCategory(id).subscribe({
        next: () => {
          this.isConfirmLoading.set(false);
          this.closeConfirmModal();
          this.showToast('تم حذف القسم بنجاح', 'success');
          this.loadTree(this.searchQuery());
          this.loadStats();
        },
        error: (err) => {
          this.isConfirmLoading.set(false);
          this.showToast(err.error?.message || 'تعذر حذف القسم', 'error');
        }
      });
    } else if (action === 'delete_spec') {
      this.service.deleteSpecialty(id).subscribe({
        next: () => {
          this.isConfirmLoading.set(false);
          this.closeConfirmModal();
          this.showToast('تم حذف التخصص بنجاح', 'success');
          this.loadTree(this.searchQuery());
          this.loadStats();
        },
        error: (err) => {
          this.isConfirmLoading.set(false);
          this.showToast(err.error?.message || 'تعذر حذف التخصص', 'error');
        }
      });
    }
  }

  closeConfirmModal() {
    this.isConfirmModalOpen.set(false);
    this.confirmTitle.set('');
    this.confirmMessage.set('');
    this.confirmItemName.set('');
    this.confirmWarning.set('');
    this.confirmActionType.set(null);
    this.confirmTargetId.set(null);
    this.isConfirmLoading.set(false);
  }

  openModal(spec?: any, catId?: string) {
    if (spec) {
      this.editSpecId.set(spec.id);
      this.newSpecName.set(spec.nameAr || '');
      this.newSpecSlug.set(spec.slug || '');
      this.newSpecReq.set(spec.description || '');
      if (catId) this.newSpecCatId.set(catId);
    } else {
      this.editSpecId.set(null);
      this.newSpecName.set('');
      this.newSpecSlug.set('');
      this.newSpecReq.set('');
      if (catId) this.newSpecCatId.set(catId);
    }
    this.isAddModalOpen.set(true);
  }

  closeModal() {
    this.isAddModalOpen.set(false);
  }

  addSpec() {
    const name = this.newSpecName().trim();
    const slug = this.newSpecSlug().trim();
    const catId = this.newSpecCatId();
    if (!name || !slug || !catId) {
      this.showToast('الرجاء تعبئة البيانات المطلوبة', 'error');
      return;
    }

    const data = {
      categoryId: catId,
      nameAr: name,
      slug: slug,
      description: this.newSpecReq()
    };

    const request$ = this.editSpecId()
      ? this.service.updateSpecialty(this.editSpecId()!, data)
      : this.service.createSpecialty(data);

    request$.subscribe({
      next: () => {
        this.showToast(this.editSpecId() ? 'تم تعديل التخصص بنجاح' : 'تم إضافة التخصص بنجاح', 'success');
        this.closeModal();
        this.loadTree(this.searchQuery());
        this.loadStats();
      },
      error: (err) => this.showToast(err.error?.message || 'حدث خطأ أثناء حفظ التخصص', 'error')
    });
  }

  // --- Catalog Import (one-time, run from the browser under the logged-in admin session) ---
  async importCatalog() {
    if (this.isImporting()) return;
    this.isImporting.set(true);

    let createdCategories = 0;
    let createdSpecs = 0;
    let skipped = 0;
    let failed = 0;

    for (const block of IMPORT_CATALOG) {
      let categoryId = block.existingCategoryId;

      if (!categoryId && block.create) {
        this.importProgress.set(`إنشاء قسم: ${block.create.nameAr}...`);
        try {
          const res: any = await firstValueFrom(this.service.createCategory(block.create));
          categoryId = res?.data?.id;
          if (categoryId) createdCategories++;
        } catch (err: any) {
          console.error(`Failed to create category ${block.create.nameAr}`, err);
          failed++;
          continue; // can't add its specialties without a category id
        }
      }

      if (!categoryId) continue;

      for (const spec of block.specialties) {
        this.importProgress.set(`إضافة تخصص: ${spec.nameAr}...`);
        try {
          await firstValueFrom(this.service.createSpecialty({ categoryId, slug: spec.slug, nameAr: spec.nameAr }));
          createdSpecs++;
        } catch (err: any) {
          // Most common case: slug already exists (already imported before) — skip silently.
          if (err?.status === 409 || err?.status === 400) {
            skipped++;
          } else {
            console.error(`Failed to create specialty ${spec.nameAr}`, err);
            failed++;
          }
        }
      }
    }

    this.isImporting.set(false);
    this.importProgress.set('');
    this.loadTree(this.searchQuery());
    this.loadStats();

    const summary = `تم الاستيراد: ${createdCategories} قسم جديد، ${createdSpecs} تخصص جديد` +
      (skipped ? `، ${skipped} موجود مسبقاً` : '') +
      (failed ? `، ${failed} فشل` : '');
    this.showToast(summary, failed ? 'error' : 'success');
  }
}
