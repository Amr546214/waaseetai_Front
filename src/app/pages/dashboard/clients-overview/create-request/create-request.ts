import { Component, computed, effect, signal, OnDestroy, OnInit, inject, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { SpecialtyService } from '../../../../core/services/specialty.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../../environments/environment';

import { Step1Specialty } from './components/step1-specialty/step1-specialty';
import { Step2Conditions } from './components/step2-conditions/step2-conditions';
import { Step3Details } from './components/step3-details/step3-details';
import { Step4Budget } from './components/step4-budget/step4-budget';
import { Step5Files } from './components/step5-files/step5-files';
import { Step6Review } from './components/step6-review/step6-review';
interface Specialty {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: string;
  subs?: string[];
}

interface Milestone { name: string; pct: number; }

// Versioned sessionStorage draft shape. Bump DRAFT_VERSION (and the key
// suffix) if this shape ever changes incompatibly — loadDraft() rejects any
// stored value whose version doesn't match, rather than guessing at
// migrating an old shape.
const DRAFT_STORAGE_KEY = 'waseetai:create-request:draft:v1';
const DRAFT_VERSION = 1;

// Lightweight marker (no form data) set only once the backend has confirmed
// publish and the draft has already been cleared. Its sole purpose is
// surviving a refresh of the post-submit success screen — without it, a
// refresh right after submitting finds no draft (already cleared) and falls
// back to step 1, looking like the request was lost. Cleared on component
// destroy (i.e. as soon as the user navigates away from this page) so a
// later, genuinely new visit to this page always starts clean, and bounded
// to 24h so it can never outlive a reasonable session even if that somehow
// didn't run.
const SUBMITTED_STORAGE_KEY = 'waseetai:create-request:submitted:v1';
const SUBMITTED_MARKER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface SubmittedMarker {
  at: number;
}

interface CreateRequestDraftV1 {
  version: 1;
  currentStep: number;
  step1: {
    selectedSpec: string | null;
    selectedSubs: string[];
    otherText: string;
  };
  step2: {
    ndaType: string;
    ipRights: string;
    provLevel: string;
    provRating: string;
    provLang: string;
    provLocation: string;
    customConditions: string;
  };
  step3: {
    title: string;
    description: string;
    requirements: string[];
    outputs: string;
    deliveryDays: number | null;
  };
  step4: {
    budgetType: string;
    budgetMin: number | null;
    budgetMax: number | null;
    budgetFixed: number | null;
    budgetHourly: number | null;
    allowNegotiation: boolean;
    splitMilestones: boolean;
    milestones: Milestone[];
  };
  // Step 5 (files) is intentionally NOT persisted: browser File objects
  // cannot be serialized/restored from sessionStorage, and there is no
  // "already uploaded" intermediate state in the current architecture —
  // uploadAttachments() only runs at final submit. Pretending a file is
  // still attached after a refresh would be actively misleading, so Step 5
  // always restores empty and the user re-selects files if needed.
  // Step 6 has no draft fields of its own beyond what Steps 1–4 already
  // provide; its own local acknowledgement checkboxes are intentionally
  // reset on refresh rather than silently restored.
}

@Component({
  selector: 'app-create-request',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Step1Specialty, Step2Conditions, Step3Details, Step4Budget, Step5Files, Step6Review],
  templateUrl: './create-request.html',
  styleUrl: './create-request.css',
  encapsulation: ViewEncapsulation.None
})
export class CreateRequest implements OnInit, OnDestroy {
  private socket?: Socket;
  private specialtyService = inject(SpecialtyService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private authStore = inject(AuthStore);

  /** Company-mode requests are submitted on behalf of the company and need
   *  manager approval before publishing — see P-SK-002-شركة. */
  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;
  readonly requesterName = () => {
    const u = this.authStore.currentUser();
    return u ? `${u.firstName} ${u.lastName}`.trim() : '';
  };

  constructor(
    private router: Router,
    private projectApi: ProjectApiService
  ) {
    // Centralized autosave: reads every persisted field on each run, so any
    // signal write across Steps 1–4 (including in-place-safe milestone
    // updates) schedules exactly one coalesced save via Angular's effect
    // scheduling — no need to scatter sessionStorage calls per field/step.
    effect(() => this.saveDraft());
  }

  // Multi-step State
  currentStep = signal(1);
  toast = signal<{ msg: string, type: string } | null>(null);

  steps = [
    { num: 1, label: 'التخصص' },
    { num: 2, label: 'الشروط' },
    { num: 3, label: 'التفاصيل' },
    { num: 4, label: 'الميزانية' },
    { num: 5, label: 'الملفات' },
    { num: 6, label: 'المراجعة' },
  ];

  // ==============================
  // STEP 1: Specialty
  // ==============================
  searchQuery = signal('');
  selectedSpec = signal<string | null>(null);
  selectedSubs = signal<Set<string>>(new Set());
  otherText = signal('');
  showAIBanner = signal(true);
  MAX_SUBS = 5;

  specialties = signal<Specialty[]>([
  ]);

  filteredSpecs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.specialties();
    return this.specialties().filter(s => s.name.toLowerCase().includes(q));
  });

  currentSpec = computed(() => {
    const id = this.selectedSpec();
    return this.specialties().find(s => s.id === id);
  });

  ngOnInit(): void {
    this.restoreDraft();
    this.restoreSubmittedState();
    this.loadSpecialtiesFromDatabase();
  }

  // ==============================
  // Draft persistence (sessionStorage) — survives refresh/reload within the
  // same tab, cleared on successful publish or explicit cancel. See
  // CreateRequestDraftV1 above for exactly what is (and deliberately isn't)
  // persisted.
  // ==============================

  private buildDraftSnapshot(): CreateRequestDraftV1 {
    return {
      version: DRAFT_VERSION,
      currentStep: this.currentStep(),
      step1: {
        selectedSpec: this.selectedSpec(),
        selectedSubs: Array.from(this.selectedSubs()),
        otherText: this.otherText()
      },
      step2: {
        ndaType: this.ndaType(),
        ipRights: this.ipRights(),
        provLevel: this.provLevel(),
        provRating: this.provRating(),
        provLang: this.provLang(),
        provLocation: this.provLocation(),
        customConditions: this.customConditions()
      },
      step3: {
        title: this.title(),
        description: this.description(),
        requirements: this.requirements(),
        outputs: this.outputs(),
        deliveryDays: this.deliveryDays()
      },
      step4: {
        budgetType: this.budgetType(),
        budgetMin: this.budgetMin(),
        budgetMax: this.budgetMax(),
        budgetFixed: this.budgetFixed(),
        budgetHourly: this.budgetHourly(),
        allowNegotiation: this.allowNegotiation(),
        splitMilestones: this.splitMilestones(),
        milestones: this.milestones()
      }
    };
  }

  private saveDraft(): void {
    if (!this.isBrowser) return;
    const snapshot = this.buildDraftSnapshot();
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota exceeded / private-browsing storage denial — draft persistence
      // is a convenience, never allowed to break the wizard itself.
    }
  }

  private clearDraft(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore — nothing to clean up if storage isn't accessible.
    }
  }

  private restoreDraft(): void {
    if (!this.isBrowser) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!this.isValidDraft(parsed)) {
        this.clearDraft();
        return;
      }
      this.applyDraft(parsed);
    } catch {
      // Malformed JSON — never let a corrupt draft crash the page.
      this.clearDraft();
    }
  }

  private markSubmitted(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify({ at: Date.now() } satisfies SubmittedMarker));
    } catch {
      // Storage unavailable — a refresh right after submit will fall back to
      // step 1 instead of the success screen, but the request itself was
      // already published server-side either way.
    }
  }

  private clearSubmittedMarker(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(SUBMITTED_STORAGE_KEY);
    } catch {
      // Ignore — nothing to clean up if storage isn't accessible.
    }
  }

  private restoreSubmittedState(): void {
    if (!this.isBrowser) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(SUBMITTED_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const isValid = parsed && typeof parsed === 'object' && typeof parsed.at === 'number'
        && Date.now() - parsed.at < SUBMITTED_MARKER_MAX_AGE_MS;
      if (isValid) {
        this.showSuccessOverlay.set(true);
      } else {
        this.clearSubmittedMarker();
      }
    } catch {
      this.clearSubmittedMarker();
    }
  }

  private isValidDraft(value: any): value is CreateRequestDraftV1 {
    if (!value || typeof value !== 'object') return false;
    if (value.version !== DRAFT_VERSION) return false;
    if (typeof value.currentStep !== 'number' || value.currentStep < 1 || value.currentStep > 6) return false;
    if (!value.step1 || typeof value.step1 !== 'object') return false;
    if (!value.step2 || typeof value.step2 !== 'object') return false;
    if (!value.step3 || typeof value.step3 !== 'object') return false;
    if (!value.step4 || typeof value.step4 !== 'object') return false;
    if (!Array.isArray(value.step4.milestones)) return false;
    return true;
  }

  private applyDraft(draft: CreateRequestDraftV1): void {
    this.currentStep.set(draft.currentStep);

    this.selectedSpec.set(draft.step1.selectedSpec ?? null);
    this.selectedSubs.set(new Set(Array.isArray(draft.step1.selectedSubs) ? draft.step1.selectedSubs : []));
    this.otherText.set(draft.step1.otherText ?? '');

    this.ndaType.set(draft.step2.ndaType ?? 'standard');
    this.ipRights.set(draft.step2.ipRights ?? 'client');
    this.provLevel.set(draft.step2.provLevel ?? '');
    this.provRating.set(draft.step2.provRating ?? '4');
    this.provLang.set(draft.step2.provLang ?? 'ar');
    this.provLocation.set(draft.step2.provLocation ?? 'sa');
    this.customConditions.set(draft.step2.customConditions ?? '');

    this.title.set(draft.step3.title ?? '');
    this.description.set(draft.step3.description ?? '');
    this.requirements.set(Array.isArray(draft.step3.requirements) ? draft.step3.requirements : []);
    this.outputs.set(draft.step3.outputs ?? '');
    this.deliveryDays.set(typeof draft.step3.deliveryDays === 'number' ? draft.step3.deliveryDays : null);

    const asNumberOrNull = (v: unknown): number | null => typeof v === 'number' ? v : null;
    this.budgetType.set(draft.step4.budgetType ?? 'range');
    this.budgetMin.set(asNumberOrNull(draft.step4.budgetMin));
    this.budgetMax.set(asNumberOrNull(draft.step4.budgetMax));
    this.budgetFixed.set(asNumberOrNull(draft.step4.budgetFixed));
    this.budgetHourly.set(asNumberOrNull(draft.step4.budgetHourly));
    this.allowNegotiation.set(draft.step4.allowNegotiation !== false);
    this.splitMilestones.set(draft.step4.splitMilestones === true);
    this.milestones.set(
      draft.step4.milestones
        .filter((m: any) => m && typeof m === 'object')
        .map((m: any) => ({ name: typeof m.name === 'string' ? m.name : '', pct: typeof m.pct === 'number' ? m.pct : 0 }))
    );
    // canProceed() is a computed() reading these same signals, so it
    // automatically reflects the restored values on next read — no
    // separate "recompute validation" step is needed.
  }

  private loadSpecialtiesFromDatabase(): void {
    this.projectApi.getMeta().subscribe({
      next: (res: any) => {
        const categories = res && res.data && Array.isArray(res.data.categories) ? res.data.categories : [];
        if (categories.length > 0) {
          const mapped: Specialty[] = categories.map((cat: any) => {
            const subs = Array.isArray(cat.specialties)
              ? cat.specialties.map((s: any) => s.name)
              : [];

            const { iconPath, colorClass } = this.resolveCategoryIconAndColor(cat.icon || cat.name);

            return {
              id: cat.id || cat.name,
              name: cat.name,
              count: `+${cat.totalProviders || 50} مقدم`,
              icon: iconPath,
              color: colorClass,
              subs: subs
            };
          });

          // mapped.push({
          //   id: 'other',
          //   name: 'أخرى',
          //   count: 'اقترح تخصصا',
          //   icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M12 22A10 10 0 1 1 12 2a10 10 0 0 1 0 20z',
          //   color: 'text-waseet-txt-2',
          //   subs: []
          // });

          this.specialties.set(mapped);
        }
      },
      error: (err: any) => {
        console.warn('[CreateRequest] Falling back to specialtyService:', err);
        this.fallbackLoadSpecialties();
      }
    });
  }

  private fallbackLoadSpecialties(): void {
    this.specialtyService.getCategories().subscribe({
      next: (res: any) => {
        const catList = res && res.success && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        if (catList.length > 0) {
          const mapped: Specialty[] = catList.map((cat: any) => {
            const subs = Array.isArray(cat.specialties) && cat.specialties.length > 0
              ? cat.specialties.map((s: any) => s.nameAr || s.name)
              : (cat.subs || []);

            const totalProviders = Array.isArray(cat.specialties)
              ? cat.specialties.reduce((acc: number, s: any) => acc + (s._count?.providerSpecialties || 0), 0)
              : 0;

            const countText = totalProviders > 0 ? `+${totalProviders} مقدم` : (cat.count || `+${subs.length * 25 || 100} مقدم`);
            const { iconPath, colorClass } = this.resolveCategoryIconAndColor(cat.icon || cat.nameAr || cat.name);

            return {
              id: cat.id || cat.name,
              name: cat.nameAr || cat.name,
              count: countText,
              icon: iconPath,
              color: colorClass,
              subs: subs
            };
          });

          this.specialties.set(mapped);
        }
      }
    });
  }

  private resolveCategoryIconAndColor(iconOrName: string): { iconPath: string; colorClass: string } {
    if (iconOrName && iconOrName.startsWith('M') && iconOrName.length > 10) {
      return { iconPath: iconOrName, colorClass: 'text-[var(--color-waseet-teal)]' };
    }

    const val = (iconOrName || '').toLowerCase();

    if (val.includes('code') || val.includes('تقنية') || val.includes('برمجة') || val.includes('tech')) {
      return { iconPath: 'M16 18l6-6-6-6M8 6l-6 6 6 6', colorClass: 'text-[var(--color-waseet-teal)]' };
    }
    if (val.includes('palette') || val.includes('تصميم') || val.includes('إبداع') || val.includes('design')) {
      return { iconPath: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z', colorClass: 'text-[var(--color-waseet-teal)]' };
    }
    if (val.includes('feather') || val.includes('كتابة') || val.includes('محتوى') || val.includes('writing')) {
      return { iconPath: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', colorClass: 'text-[var(--color-waseet-blue)]' };
    }
    if (val.includes('trending') || val.includes('تسويق') || val.includes('marketing')) {
      return { iconPath: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6', colorClass: 'text-[var(--color-waseet-amber)]' };
    }
    if (val.includes('قانون') || val.includes('استشار') || val.includes('legal')) {
      return { iconPath: 'M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM9 12l2 2 4-4', colorClass: 'text-[var(--color-waseet-teal)]' };
    }
    if (val.includes('video') || val.includes('فيديو') || val.includes('موشن')) {
      return { iconPath: 'M15 10l5-3v10l-5-3v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3z', colorClass: 'text-[var(--color-waseet-amber)]' };
    }
    if (val.includes('إدارة') || val.includes('أعمال') || val.includes('business')) {
      return { iconPath: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M2 7h20v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z', colorClass: 'text-[var(--color-waseet-blue)]' };
    }

    return { iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', colorClass: 'text-[var(--color-waseet-teal)]' };
  }

  selectSpec(id: string) {
    this.selectedSpec.set(id);
    this.selectedSubs.set(new Set());
    this.otherText.set('');
  }

  toggleSub(sub: string) {
    const subs = new Set(this.selectedSubs());
    if (subs.has(sub)) {
      subs.delete(sub);
    } else {
      if (subs.size >= this.MAX_SUBS) {
        this.showToast('الحد الأقصى 5 تخصصات فرعية', 'toast-warn');
        return;
      }
      subs.add(sub);
    }
    this.selectedSubs.set(subs);
  }

  isSubSelected(sub: string): boolean {
    return this.selectedSubs().has(sub);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  applyAISuggestion() {
    const payload = {
      title: this.title(),
      description: this.description(),
      specialtyName: this.currentSpec()?.name || 'تقنية المعلومات',
      subSpecialties: Array.from(this.selectedSubs())
    };

    this.projectApi.aiSuggest(payload).subscribe({
      next: (res: any) => {
        if (res && res.success && res.data) {
          const data = res.data;
          if (data.suggestedTitle && !this.title()) this.title.set(data.suggestedTitle);
          if (data.suggestedDescription && !this.description()) this.description.set(data.suggestedDescription);
          if (data.recommendedMinBudget) this.budgetMin.set(data.recommendedMinBudget);
          if (data.recommendedMaxBudget) this.budgetMax.set(data.recommendedMaxBudget);
          if (data.suggestedDurationDays && !this.deliveryDays()) this.deliveryDays.set(data.suggestedDurationDays);

          if (Array.isArray(data.suggestedSubSpecialties)) {
            const newSet = new Set(this.selectedSubs());
            // Only suggestions that exist as chips of the chosen specialty are applied: every counted sub-specialty is a visible, selected chip.
            const listed = new Set(this.currentSpec()?.subs ?? []);
            data.suggestedSubSpecialties.filter((s: string) => listed.has(s)).slice(0, this.MAX_SUBS).forEach((s: string) => {
              if (newSet.size < this.MAX_SUBS) newSet.add(s);
            });
            this.selectedSubs.set(newSet);
          }

          this.showAIBanner.set(false);
          this.showToast(data.personalizedNote || 'تم تطبيق توصيات وسيط AI الذكية بنجاح!', 'toast-ok');
        }
      },
      error: () => {
        // AI Cleanup Batch 2: this used to auto-select a hardcoded "tech" specialty and
        // toast it as an applied AI suggestion even though the AI call had failed.
        this.showToast('تعذر الحصول على اقتراح وسيط AI حاليا، يمكنك اختيار التخصص يدويا', 'toast-warn');
      }
    });
  }

  // ==============================
  // STEP 2: Conditions (الشروط)
  // ==============================
  ndaType = signal('standard');
  ipRights = signal('client');
  provLevel = signal('');
  provRating = signal('4');
  provLang = signal('ar');
  provLocation = signal('sa');
  customConditions = signal('');
  showStrikeBanner = signal(false);

  setNda(type: string) { this.ndaType.set(type); }
  setIpRights(type: string) { this.ipRights.set(type); }

  // ==============================
  // STEP 3: Details (التفاصيل)
  // ==============================
  title = signal('');
  description = signal('');
  requirements = signal<string[]>([]);
  newRequirement = signal('');
  outputs = signal('');
  deliveryDays = signal<number | null>(14);
  showAiSuggest = signal(false);

  addRequirement() {
    const req = this.newRequirement().trim();
    if (req) {
      this.requirements.update(r => [...r, req]);
      this.newRequirement.set('');
    }
  }

  removeRequirement(index: number) {
    this.requirements.update(r => r.filter((_, i) => i !== index));
  }

  useAiSuggest() {
    const text = this.aiStreamText().trim();
    if (!text) {
      this.showToast('⚠️ لا يوجد نص مقترح لتطبيقه حالياً', 'toast-warn');
      return;
    }
    this.description.set(text);
    this.showAiSuggest.set(false);
    this.isAiStreaming.set(false);
    this.showToast('🚀 تم اعتماد الوصف الاحترافي في حقل التفاصيل بنجاح!', 'toast-ok');
  }

  dismissAiSuggest() {
    this.showAiSuggest.set(false);
    this.isAiStreaming.set(false);
  }

  // Real-Time AI Description Generator & Refiner (Socket.IO Token Streaming)
  isAiStreaming = signal(false);
  aiStreamText = signal('');
  aiMode = signal<'generate' | 'refine' | null>(null);
  aiPhase = signal<'idle' | 'validating' | 'generating'>('idle');

  triggerAiDescription() {
    const projTitle = this.title().trim();
    if (!this.isMeaningfulProjectTitle(projTitle)) {
      this.showToast('اكتب عنواناً واضحاً ومحدداً، مثل: تطوير متجر إلكتروني لبيع الملابس. العناوين العامة مثل «تجربة» لا تكفي للصياغة.', 'toast-warn');
      return;
    }

    if (!this.socket) {
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
        if (!token && typeof document !== 'undefined') {
          token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || null;
        }
      }
      this.socket = io(environment.socketUrl, { withCredentials: true, auth: { token } });
    }

    const currentDesc = this.description().trim();
    const mode = currentDesc.length > 5 ? 'refine' : 'generate';

    this.aiMode.set(mode);
    this.aiStreamText.set('');
    this.isAiStreaming.set(true);
    this.aiPhase.set('validating');
    this.showAiSuggest.set(true);

    this.socket.off('ai:description_validation_start');
    this.socket.off('ai:description_validation_passed');
    this.socket.off('ai:description_start');
    this.socket.off('ai:description_chunk');
    this.socket.off('ai:description_complete');
    this.socket.off('ai:description_error');

    this.socket.on('ai:description_validation_start', () => {
      this.isAiStreaming.set(true);
      this.aiPhase.set('validating');
    });

    this.socket.on('ai:description_validation_passed', (data: { message?: string }) => {
      this.aiPhase.set('generating');
      if (data?.message) this.showToast(data.message, 'toast-ok');
    });

    this.socket.on('ai:description_start', (data: any) => {
      this.isAiStreaming.set(true);
      this.aiPhase.set('generating');
      if (data?.mode) {
        this.aiMode.set(data.mode);
      }
    });

    this.socket.on('ai:description_chunk', (data: { chunk: string; mode: string }) => {
      if (data?.chunk) {
        this.aiStreamText.update(text => text + data.chunk);
      }
    });

    this.socket.on('ai:description_complete', (data: { fullText?: string; message?: string; mode: string }) => {
      this.isAiStreaming.set(false);
      this.aiPhase.set('idle');
      if (data?.fullText && !this.aiStreamText()) {
        this.aiStreamText.set(data.fullText);
      }
      this.showToast(data?.message || 'اكتملت صياغة المسودة، راجعها وعدّلها قبل استخدامها', 'toast-ok');
    });

    this.socket.on('ai:description_error', (data: { message?: string }) => {
      this.isAiStreaming.set(false);
      this.aiPhase.set('idle');
      this.showAiSuggest.set(false);
      this.aiStreamText.set('');
      this.showToast(data?.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي حالياً. حاول مرة أخرى لاحقاً.', 'toast-warn');
    });

    this.socket.emit('ai:generate_description', {
      projectTitle: projTitle,
      specialtyId: this.selectedSpec() || undefined,
      specialtyName: this.selectedSpec() === 'other' ? this.otherText().trim() : this.currentSpec()?.name,
      subSpecialties: Array.from(this.selectedSubs()),
      existingDescription: currentDesc
    });
  }

  private isMeaningfulProjectTitle(title: string): boolean {
    const normalized = title.replace(/[\p{P}\p{S}_]+/gu, ' ').replace(/\s+/g, ' ').trim();
    const genericTitles = new Set([
      'تجربة', 'اختبار', 'مشروع', 'مشروع جديد', 'طلب', 'طلب جديد', 'خدمة', 'خدمة جديدة',
      'test', 'testing', 'project', 'new project', 'request', 'service'
    ]);
    const words = normalized.split(' ').filter(word => word.length > 1);
    return normalized.length >= 8 && words.length >= 2 && !genericTitles.has(normalized.toLowerCase());
  }

  // ==============================
  // STEP 4: Budget (الميزانية)
  // ==============================
  budgetType = signal('range');
  budgetMin = signal<number | null>(0);
  budgetMax = signal<number | null>(0);
  budgetFixed = signal<number | null>(0);
  budgetHourly = signal<number | null>(0);
  allowNegotiation = signal(true);
  splitMilestones = signal(false);
  milestones = signal<Milestone[]>([
    // { name: 'التصميم والتخطيط', pct: 25 },
    // { name: 'التطوير الأساسي', pct: 40 },
    // { name: 'الاختبار والتسليم', pct: 35 }
  ]);

  addMilestone() {
    this.milestones.update(m => [...m, { name: '', pct: 0 }]);
  }

  removeMilestone(index: number) {
    this.milestones.update(m => m.filter((_, i) => i !== index));
  }

  // Milestone fields are edited via [ngModel]+(ngModelChange) rather than
  // [(ngModel)] directly on the array-item objects: mutating ms.name/ms.pct
  // in place would never call milestones.set()/.update(), so the
  // `milestones` signal would never mark itself dirty and the `canProceed`
  // computed (which gates the Next button) would stay stale at whatever it
  // was right after the milestone was added — leaving Next permanently
  // disabled even once every field is filled in correctly.
  updateMilestoneName(index: number, name: string) {
    this.milestones.update(m => m.map((ms, i) => i === index ? { ...ms, name } : ms));
  }

  updateMilestonePct(index: number, pct: number | null) {
    this.milestones.update(m => m.map((ms, i) => i === index ? { ...ms, pct: pct ?? 0 } : ms));
  }

  get milestoneTotalPct() {
    return this.milestones().reduce((sum, m) => sum + (m.pct || 0), 0);
  }

  get milestoneNameError(): boolean {
    return this.milestones().some(m => !m.name || m.name.trim().length < 2);
  }

  // ==============================
  // STEP 5: Files (الملفات)
  // ==============================
  files = signal<File[]>([]);

  handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      const invalid = newFiles.find(file => file.size > 10 * 1024 * 1024);
      if (invalid) {
        this.showToast(`الملف "${invalid.name}" يتجاوز الحد الأقصى 10MB`, 'toast-warn');
      }
      const validFiles = newFiles.filter(file => file.size <= 10 * 1024 * 1024);
      this.files.update(f => [...f, ...validFiles].slice(0, 5));
      input.value = '';
    }
  }

  addSuggestedFile(name: string) {
    const requirement = `توفير ${name}`;
    if (!this.requirements().includes(requirement)) {
      this.requirements.update(r => [...r, requirement]);
    }
    this.showToast(`تمت إضافة "${name}" إلى قائمة المتطلبات الإلزامية`, 'toast-ok');
  }

  // ==============================
  // Navigation & Validation
  // ==============================

  canProceed = computed(() => {
    const step = this.currentStep();
    if (step === 1) {
      const spec = this.currentSpec();
      if (!spec) return false;
      if (spec.id === 'other') return this.otherText().trim().length >= 5;
      return true;
    }
    if (step === 2) {
      return true; // All fields have defaults
    }
    if (step === 3) {
      return this.title().trim().length >= 3 && this.description().trim().length >= 10 && !!this.deliveryDays();
    }
    if (step === 4) {
      if (this.budgetType() === 'fixed') {
        if (!this.budgetFixed() || this.budgetFixed()! <= 0) return false;
      } else if (this.budgetType() === 'hourly') {
        if (!this.budgetHourly() || this.budgetHourly()! <= 0) return false;
      } else if (this.budgetType() === 'range') {
        if (!this.budgetMin() || !this.budgetMax() || (this.budgetMin()! > this.budgetMax()!)) return false;
      }

      if (this.splitMilestones()) {
        if (this.milestones().length < 2) return false;
        if (this.milestoneTotalPct !== 100) return false;
        for (const m of this.milestones()) {
          if (!m.name || m.name.trim().length < 2) return false;
          if (!m.pct || m.pct <= 0 || m.pct > 100) return false;
        }
      }
      return true;
    }
    return true; // Step 5 and 6
  });

  goNext() {
    if (!this.canProceed()) return;
    const step = this.currentStep();
    if (step < 6) {
      this.currentStep.set(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.submitRequest();
    }
  }

  goBack() {
    const step = this.currentStep();
    if (step > 1) {
      this.currentStep.set(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.handleCancel();
    }
  }

  handleCancel() {
    if (confirm('هل تريد إلغاء إنشاء الطلب؟ سيتم فقدان ما أدخلته.')) {
      this.clearDraft();
      this.router.navigate(['/client-overview']);
    }
  }

  isSubmitting = signal(false);
  showSuccessOverlay = signal(false);

  async submitRequest() {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);

    let uploadedFileUrls: string[] = [];

    // Handle file upload if files attached
    if (this.files().length > 0) {
      try {
        const uploadRes: any = await this.projectApi.uploadAttachments(this.files()).toPromise();
        if (uploadRes && uploadRes.urls) {
          uploadedFileUrls = uploadRes.urls;
        }
      } catch (uploadErr) {
        console.error('File upload failed:', uploadErr);
        this.isSubmitting.set(false);
        this.showToast('تعذر رفع الملفات. تحقق من الاتصال وحاول مرة أخرى.', 'toast-warn');
        return;
      }
    }

    let minB = this.budgetMin();
    let maxB = this.budgetMax();
    if (this.budgetType() === 'fixed') {
      minB = this.budgetFixed();
      maxB = this.budgetFixed();
    } else if (this.budgetType() === 'hourly') {
      minB = this.budgetHourly();
      maxB = this.budgetHourly();
    }

    const payload = {
      specialtyId: this.currentSpec()?.id,
      specialty: this.selectedSpec() === 'other' ? this.otherText() : (this.currentSpec()?.name || 'عام'),
      title: this.title(),
      description: this.description(),
      subSpecialties: Array.from(this.selectedSubs()),
      requiredSkills: this.requirements().length > 0 ? this.requirements() : Array.from(this.selectedSubs()),
      budgetType: (this.budgetType() || 'FIXED').toUpperCase(),
      minBudget: minB,
      maxBudget: maxB,
      expectedDurationDays: this.deliveryDays(),
      preferredProviderType: 'ANY',
      requiresNda: this.ndaType() === 'standard' || this.ndaType() === 'custom',
      attachments: uploadedFileUrls,
      outputs: this.outputs(),
      customConditions: this.customConditions(),
      providerPreferences: {
        level: this.provLevel() || null,
        minRating: this.provRating() ? Number(this.provRating()) : null,
        language: this.provLang(),
        location: this.provLocation() || null
      },
      ipRights: this.ipRights(),
      allowNegotiation: this.allowNegotiation(),
      splitMilestones: this.splitMilestones(),
      milestones: this.splitMilestones() ? this.milestones() : []
    };

    this.projectApi.createProject(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        // Only clear the draft once the backend has actually confirmed the
        // request was published — never on error, never before this point.
        this.clearDraft();
        this.markSubmitted();
        // Stay on the success overlay until the user explicitly picks
        // "عرض طلباتي" or "لوحة التحكم" — no automatic navigation. Persisted
        // via markSubmitted() so a refresh here restores this same screen
        // instead of falling back to step 1 (the draft is already gone).
        this.showSuccessOverlay.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Project creation failed:', err);
        const errMsg = err.error?.message || 'حدث خطأ أثناء رفع الطلب، يرجى المحاولة مرة أخرى';
        this.showToast(errMsg, 'toast-warn');
      }
    });
  }

  showToast(msg: string, type: 'toast-ok' | 'toast-warn') {
    this.toast.set({ msg, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 3500);
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
    // Navigating away from this page (e.g. via the success screen's own
    // "عرض طلباتي"/"لوحة التحكم" buttons) means the just-submitted state has
    // been acknowledged — clear the marker so a later, genuinely new visit
    // to this page starts at step 1 instead of re-showing this success screen.
    this.clearSubmittedMarker();
  }
}
