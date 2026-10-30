import { Component, computed, effect, untracked, signal, OnDestroy, OnInit, inject, PLATFORM_ID, ViewEncapsulation, ElementRef } from '@angular/core';
import { canRewrite, checkRewriteOutput, REWRITE_INPUT_REQUIRED_MESSAGE } from './description-rewrite-guard';
import { parseDescriptionRewrite, REWRITE_PREVIEW_MAX_CHARS } from './description-rewrite-options';
import { assistantMarkdown } from '../../../../core/help/assistant-content';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationSkipped, NavigationSkippedCode, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { SkillsCatalogService } from '../../../../core/services/skills-catalog.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { SpecialtyService } from '../../../../core/services/specialty.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { mapHttpError } from '../../../../core/forms/http-error';
import { clearInvalid, FieldProblem, scrollFocus, SubmitGuard } from '../../../../shared/forms/form-error-focus';
import { hasFieldErrors, reportClientBackend, reportClientProblems } from '../client-form-report';
import { io, Socket } from 'socket.io-client';
import { SOCKET_BACKOFF } from '../../../../core/utils/socket-backoff';
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

export interface ClientSpecialtyRecommendation {
  hasRecommendation: boolean;
  source: 'text_match' | 'client_history' | 'popular' | 'none';
  reason: string;
  message: string;
  categoryId: string | null;
  categoryName: string | null;
  specialtyIds: string[];
  specialtyNames: string[];
  confidence?: number | null;
}

/** `pct` is null while the field is empty (an intermediate editing state); it is only validated on blur / Add / Next. */
interface Milestone { name: string; pct: number | null; }

/** Whole percentages only, and in row order each row keeps at most what is left of 100 (empty stays empty, never 0). */
function capMilestones(rows: Milestone[]): Milestone[] {
  let used = 0;
  return rows.map(row => {
    if (row.pct === null || row.pct === undefined || !Number.isFinite(row.pct)) return { ...row, pct: null };
    const kept = Math.min(Math.max(0, Math.trunc(row.pct)), Math.max(0, 100 - used));
    used += kept;
    return kept === row.pct ? row : { ...row, pct: kept };
  });
}

// Versioned sessionStorage draft shape. Bump DRAFT_VERSION (and the key
// suffix) if this shape ever changes incompatibly — loadDraft() rejects any
// stored value whose version doesn't match, rather than guessing at
// migrating an old shape.
const DRAFT_STORAGE_KEY = 'waseetai:create-request:draft:v1';

/** The wizard's own route, and whether it has already been created since this page load (the draft may resume only the first one, after a reload). */
const CREATE_REQUEST_PATH = '/client-overview/create-request';
let wizardCreatedSincePageLoad = false;
/** Test seam: forget that the wizard was created in this page load. */
export function resetCreateRequestPageLoadState(): void { wizardCreatedSincePageLoad = false; }
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
    requiredSkills?: string[];
    outputs: string;
    deliveryDays: number | null;
    aiReview?: { text: string; original: string; sourceTitle: string; selectedId: string | null; edits: Record<string, string>; status: 'completed' | 'partial' | 'error'; appliedId: string | null };
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
  private notify = inject(UiNotificationService);
  private specialtyService = inject(SpecialtyService);
  private skillsCatalog = inject(SkillsCatalogService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private authStore = inject(AuthStore);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** One publish at a time: a second click / Enter while the first request runs does nothing. */
  private publishGuard = new SubmitGuard();

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
    // The skills a client can ask for come from the backend catalog of the chosen field (no local lists).
    effect(() => {
      const id = this.selectedSpec();
      untracked(() => this.loadSkillOptions(id && id !== 'other' ? id : ''));
    });
  }

  // Required skills (step 3): picked from the catalog of the chosen field, sent as `requiredSkills`.
  skillOptions = signal<string[]>([]);
  requiredSkills = signal<string[]>([]);
  skillsLoading = signal(false);
  skillsCatalogError = signal('');
  skillsServerError = signal('');
  private skillsKey = '';

  private loadSkillOptions(key: string): void {
    if (key === this.skillsKey) return;
    this.skillsKey = key;
    this.skillsCatalogError.set('');
    if (!key) { this.skillOptions.set([]); this.skillsLoading.set(false); return; }
    this.skillsLoading.set(true);
    this.skillsCatalog.getCatalog(key).subscribe({
      next: res => {
        if (key !== this.skillsKey) return;
        this.skillOptions.set(res?.success ? (res.data?.skills ?? []) : []);
        this.skillsLoading.set(false);
      },
      error: () => {
        if (key !== this.skillsKey) return;
        this.skillOptions.set([]);
        this.skillsLoading.set(false);
        this.skillsCatalogError.set('تعذر تحميل مهارات هذا المجال حاليًا.');
      }
    });
  }

  setRequiredSkills(list: string[]): void {
    this.skillsServerError.set('');
    this.requiredSkills.set(list.slice(0, 30));
  }

  // Multi-step State
  currentStep = signal(1);

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
  MAX_SUBS = 5;

  specialties = signal<Specialty[]>([
  ]);

  /** Shape of POST /client/requests/specialty-recommendations (data). `source` says what the suggestion really rests on. */
  recommendation = signal<ClientSpecialtyRecommendation | null>(null);
  private recSeq = 0;
  private recTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The banner shows only a real, applicable recommendation: its category must exist in the loaded catalog, and while the client is typing
   * in the search box only a suggestion that came from that text (text_match) may show.
   */
  visibleRecommendation = computed(() => {
    const r = this.recommendation();
    if (!r || !r.hasRecommendation || !r.message || !r.categoryId) return null;
    if (!this.specialties().some(sp => sp.id === r.categoryId)) return null;
    if (this.searchQuery().trim().length >= 2 && r.source !== 'text_match') return null;
    return r;
  });

  recommendationTitle = computed(() => this.visibleRecommendation()?.source === 'popular' ? 'اقتراح شائع' : 'اقتراح لك');

  /** The search box changed: filter as before, and (debounced) ask for a suggestion for what was typed. */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this.recTimer) clearTimeout(this.recTimer);
    const q = (value ?? '').trim();
    this.recTimer = setTimeout(() => this.loadRecommendation(q.length >= 2 ? q : ''), 500);
  }

  /** Silent by design: a failure or an empty answer just means no banner (never a toast). */
  loadRecommendation(query = ''): void {
    const seq = ++this.recSeq;
    this.projectApi.getSpecialtyRecommendation(query || undefined).subscribe({
      next: (res: any) => {
        if (seq !== this.recSeq) return; // a newer request replaced this one
        const d = res?.success ? res.data : null;
        this.recommendation.set(d && typeof d === 'object' && d.hasRecommendation === true ? d as ClientSpecialtyRecommendation : null);
      },
      error: () => { if (seq === this.recSeq) this.recommendation.set(null); }
    });
  }

  /** Selects the suggested category and specialties in the page only: no navigation to the next step and nothing is sent. */
  applyRecommendation(): void {
    const r = this.visibleRecommendation();
    if (!r || !r.categoryId) return;
    const cat = this.specialties().find(sp => sp.id === r.categoryId);
    if (!cat) return;
    this.selectSpec(cat.id);
    const names = (r.specialtyNames ?? []).filter(n => (cat.subs ?? []).includes(n)).slice(0, this.MAX_SUBS);
    this.selectedSubs.set(new Set(names));
  }

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
    // Authenticated request metadata is loaded in the browser, where the session is available.
    if (!this.isBrowser) return;

    // The sessionStorage draft exists to survive a page refresh / reload (and a browser back/forward), NOT to prefill a new request:
    // arriving here through an in-app navigation (menu "إنشاء طلب", "طلب جديد", a dashboard shortcut…) always starts from a clean
    // wizard, so values typed in an earlier attempt never reappear. Resume = the app was (re)loaded on this URL (no navigation has
    // completed yet) or a popstate (browser back/forward).
    if (this.shouldResumeDraft()) {
      this.restoreDraft();
      this.restoreSubmittedState();
    } else {
      this.clearDraft();
      this.clearSubmittedMarker();
    }
    this.loadSpecialtiesFromDatabase();
    this.loadRecommendation();
    // Clicking "إنشاء طلب" / "طلب جديد" while already on the wizard is a same-URL navigation: the router skips it and never recreates
    // this component, so the old values would stay. Treat that skipped navigation as an explicit "start a new request".
    this.sameUrlSub = this.router.events.subscribe(e => {
      if (e instanceof NavigationSkipped && e.code === NavigationSkippedCode.IgnoredSameUrlNavigation
        && e.url.split(/[?#]/)[0].replace(/\/+$/, '') === CREATE_REQUEST_PATH) {
        this.resetWizard();
      }
    });
  }

  private sameUrlSub?: Subscription;

  /** Back to a pristine wizard (step 1, every field empty / at its initial default, no success screen, no stored draft). */
  resetWizard(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.clearDraft();
    this.clearSubmittedMarker();
    this.showSuccessOverlay.set(false);
    this.currentStep.set(1);
    this.searchQuery.set('');
    this.selectedSpec.set(null);
    this.selectedSubs.set(new Set());
    this.otherText.set('');
    this.ndaType.set('standard');
    this.ipRights.set('client');
    this.provLevel.set('');
    this.provRating.set('4');
    this.provLang.set('ar');
    this.provLocation.set('sa');
    this.customConditions.set('');
    this.title.set('');
    this.description.set('');
    this.requirements.set([]);
    this.requiredSkills.set([]);
    this.skillsServerError.set('');
    this.outputs.set('');
    this.deliveryDays.set(null);
    this.budgetType.set('range');
    this.budgetMin.set(null);
    this.budgetMax.set(null);
    this.budgetFixed.set(null);
    this.budgetHourly.set(null);
    this.allowNegotiation.set(true);
    this.splitMilestones.set(false);
    this.milestones.set([]);
    this.files.set([]);
    this.aiStreamText.set('');
    this.aiOriginalDescription.set('');
    this.aiDraftEdits.set({});
    this.aiSelectedOptionId.set(null);
    this.aiAppliedOptionId.set(null);
    this.aiReviewStatus.set('idle');
    this.showAiSuggest.set(false);
    this.aiSourceTitle.set('');
    this.aiReviewError.set('');
    this.aiPreviewOverflow.set(false);
    this.isAiStreaming.set(false);
    this.aiPhase.set('idle');
    this.aiMode.set(null);
  }

  private shouldResumeDraft(): boolean {
    // Resume only a refresh / browser back-forward, never a new request opened from the app:
    //  - no navigation has completed yet in this page load (a direct load of this URL, or the component created outside the router);
    //  - a popstate navigation (browser back / forward);
    //  - the first time the wizard is created since the page loaded AND the page itself was (re)loaded on this very URL
    //    (a reload / back_forward landing on the wizard, as the document navigation entry says).
    // Anything else is an in-app arrival (menu "إنشاء طلب", "طلب جديد", a dashboard shortcut): the wizard starts clean.
    const firstSincePageLoad = !wizardCreatedSincePageLoad;
    wizardCreatedSincePageLoad = true;
    if (this.router.lastSuccessfulNavigation() === null) return true;
    if (this.router.currentNavigation()?.trigger === 'popstate') return true;
    return firstSincePageLoad && this.pageWasReloadedOnThisWizard();
  }

  private pageWasReloadedOnThisWizard(): boolean {
    if (!this.isBrowser) return false;
    try {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!entry || (entry.type !== 'reload' && entry.type !== 'back_forward')) return false;
      return new URL(entry.name).pathname.replace(/\/+$/, '') === CREATE_REQUEST_PATH;
    } catch {
      return false;
    }
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
        requiredSkills: this.requiredSkills(),
        outputs: this.outputs(),
        deliveryDays: this.deliveryDays(),
        ...(this.aiStreamText() ? { aiReview: {
          text: this.aiStreamText(), original: this.aiOriginalDescription(), sourceTitle: this.aiSourceTitle(), selectedId: this.aiSelectedOptionId(), edits: this.aiDraftEdits(),
          status: this.aiReviewStatus() === 'completed' ? 'completed' as const : this.aiReviewStatus() === 'error' ? 'error' as const : 'partial' as const, appliedId: this.aiAppliedOptionId()
        } } : {})
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
    const serialized = JSON.stringify(snapshot);
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, serialized);
    } catch {}
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === CREATE_REQUEST_PATH) {
        const url = new URL(window.location.href);
        if (url.searchParams.get('step') !== String(snapshot.currentStep)) {
          url.searchParams.set('step', String(snapshot.currentStep));
          window.history.replaceState(window.history.state, '', url.pathname + url.search);
        }
      }
    } catch {}
  }

  private clearDraft(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
  }

  private restoreDraft(): void {
    if (!this.isBrowser) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(DRAFT_STORAGE_KEY) || localStorage.getItem(DRAFT_STORAGE_KEY);
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
      if (typeof window !== 'undefined') {
        const urlStep = Number(new URLSearchParams(window.location.search).get('step'));
        if (Number.isInteger(urlStep) && urlStep >= 1 && urlStep <= 6) {
          parsed.currentStep = urlStep;
        }
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
    this.requiredSkills.set(Array.isArray(draft.step3.requiredSkills) ? draft.step3.requiredSkills : []);
    this.outputs.set(draft.step3.outputs ?? '');
    this.deliveryDays.set(typeof draft.step3.deliveryDays === 'number' ? draft.step3.deliveryDays : null);
    const review = draft.step3.aiReview;
    if (review && typeof review.text === 'string' && typeof review.original === 'string') {
      this.aiStreamText.set(review.text.slice(0, REWRITE_PREVIEW_MAX_CHARS));
      this.aiOriginalDescription.set(review.original.slice(0, CreateRequest.DESCRIPTION_MAX));
      this.aiSourceTitle.set(typeof review.sourceTitle === 'string' ? review.sourceTitle.slice(0, CreateRequest.TITLE_MAX) : this.title());
      this.aiReviewStatus.set(review.status === 'completed' && review.text.length <= REWRITE_PREVIEW_MAX_CHARS ? 'completed' : review.status === 'error' ? 'error' : 'partial');
      this.aiDraftEdits.set(Object.fromEntries(Object.entries(review.edits ?? {}).filter(([id, text]) => /^option-\d+$/.test(id) && typeof text === 'string').slice(0, 20).map(([id, text]) => [id, String(text).slice(0, REWRITE_PREVIEW_MAX_CHARS)])));
      this.aiSelectedOptionId.set(this.aiPreview().options.some(option => option.id === review.selectedId) ? review.selectedId : this.aiPreview().options[0]?.id ?? null);
      this.aiAppliedOptionId.set(typeof review.appliedId === 'string' ? review.appliedId : null);
      this.showAiSuggest.set(true);
    }

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
        .map((m: any) => ({ name: typeof m.name === 'string' ? m.name : '', pct: typeof m.pct === 'number' ? m.pct : null }))
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
      },
      error: (err: unknown) => {
        console.warn('[CreateRequest] Unable to load specialty categories:', err);
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
    if (id !== this.selectedSpec()) { this.requiredSkills.set([]); this.skillsServerError.set(''); }
    this.selectedSpec.set(id);
    this.selectedSubs.set(new Set());
    this.otherText.set('');
    // A chosen specialty answers «اختر تخصصًا» (the grid is not an input, so it fires no input/change event): clear only that mark.
    const grid = this.host.nativeElement.querySelector<HTMLElement>('#f-specialty-grid');
    if (grid) clearInvalid(grid);
  }

  /** Enter inside a single-line required field behaves like pressing «التالي» (same messages, same focus). Textareas, search boxes and buttons are left alone. */
  onEnterKey(event: Event): void {
    const t = event.target as HTMLElement | null;
    if (!t || t.tagName !== 'INPUT' || !/^(f|ms)-/.test(t.id) || this.isSubmitting()) return;
    event.preventDefault();
    this.goNext();
  }

  toggleSub(sub: string) {
    const subs = new Set(this.selectedSubs());
    if (subs.has(sub)) {
      subs.delete(sub);
    } else {
      if (subs.size >= this.MAX_SUBS) {
        this.notify.warning('الحد الأقصى 5 تخصصات فرعية');
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
  deliveryDays = signal<number | null>(null);   // starts empty: the client types the duration, no ready-made number
  showAiSuggest = signal(false);

  static readonly TITLE_MAX = 80;
  static readonly DESCRIPTION_MAX = 2000;
  /** The fields stop at their limits even when the text arrives by paste/drop (the counter never reads past the maximum). */
  setTitle(value: string) { this.title.set((value ?? '').slice(0, CreateRequest.TITLE_MAX)); }
  setDescription(value: string) { this.description.set((value ?? '').slice(0, CreateRequest.DESCRIPTION_MAX)); }

  /** The extra conditions («شروط إضافية») are free text (not skills): they travel with the request's own conditions text. */
  private composeConditions(): string {
    const base = this.customConditions().trim();
    const reqs = this.requirements();
    if (!reqs.length) return this.customConditions();
    const line = `شروط إضافية: ${reqs.join('، ')}`;
    return (base ? `${base}\n${line}` : line).slice(0, 2000);
  }

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
    const text = this.aiSelectedDraft().trim();
    if (!text) {
      this.notify.warning('لا يوجد نص مقترح لتطبيقه حالياً');
      return;
    }
    if (!this.canApplyAiDraft()) {
      this.notify.warning('راجع الصياغة المختارة وحدّها وتفاصيلها قبل الاستخدام.');
      return;
    }
    this.setDescription(text);
    this.aiAppliedOptionId.set(this.aiSelectedOptionId());
    // Alternatives and edited drafts remain available after applying, so choosing another one is reversible.
    this.showAiSuggest.set(true);
    this.notify.success('تم اعتماد الوصف المعاد صياغته في حقل التفاصيل بنجاح!');
  }

  dismissAiSuggest() {
    this.showAiSuggest.set(false);
  }

  // Real-Time AI Description Generator & Refiner (Socket.IO Token Streaming)
  isAiStreaming = signal(false);
  aiStreamText = signal('');
  aiMode = signal<'refine' | null>(null);
  aiPhase = signal<'idle' | 'validating' | 'generating'>('idle');
  aiReviewStatus = signal<'idle' | 'completed' | 'partial' | 'error'>('idle');
  aiOriginalDescription = signal('');
  aiSourceTitle = signal('');
  aiSelectedOptionId = signal<string | null>(null);
  aiAppliedOptionId = signal<string | null>(null);
  aiDraftEdits = signal<Record<string, string>>({});
  aiPreviewOverflow = signal(false);
  aiReviewError = signal('');
  aiPreview = computed(() => parseDescriptionRewrite(this.aiStreamText()));
  aiSelectedOption = computed(() => this.aiPreview().options.find(option => option.id === this.aiSelectedOptionId()) ?? null);
  aiSelectedDraft = computed(() => { const option = this.aiSelectedOption(); return option ? this.aiDraftEdits()[option.id] ?? option.text : ''; });
  canApplyAiDraft = computed(() => this.aiReviewStatus() === 'completed' && !this.isAiStreaming() && !!this.aiSelectedDraft().trim() && this.aiSelectedDraft().length <= CreateRequest.DESCRIPTION_MAX);

  formatAiPreview(text: string): string { return assistantMarkdown(text.replace(/^\s*(?:---|\*\*\*)\s*$/gm, '')); }
  selectAiOption(id: string): void { if (this.aiPreview().options.some(option => option.id === id)) this.aiSelectedOptionId.set(id); }
  editAiDraft(text: string): void { const id = this.aiSelectedOptionId(); if (id) this.aiDraftEdits.update(edits => ({ ...edits, [id]: String(text ?? '').slice(0, REWRITE_PREVIEW_MAX_CHARS) })); }
  restoreOriginalDescription(): void { this.setDescription(this.aiOriginalDescription()); this.aiAppliedOptionId.set(null); }

  /** Rewriting only: the AI restates a title + description the client already wrote, it never writes them. */
  canRefineWithAi = computed(() => canRewrite(this.title(), this.description()));
  isFetchingAiDraft = signal(false);

  private formatClientDraftText(text: string | null | undefined, isSingleLine = false): string {
    if (!text) return '';
    if (isSingleLine) {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*•▸]\s+/gm, '')
        .replace(/`/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/(?:^|\s+)#{1,6}\s*([^\n]+)/g, '\n\n▸ $1\n')
      .replace(/\*\*([^*]+?:)\*\*/g, '\n\n▸ $1\n')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`/g, '');
    cleaned = cleaned.replace(/:\s*(?=1\.\s*)/g, ':\n\n');
    cleaned = cleaned.replace(/([.؛!؟])\s*(?=[1-9]\.\s*)/g, '$1\n');
    cleaned = cleaned.replace(/\s+(?=[1-9]\.\s+)/g, '\n');
    cleaned = cleaned.replace(/^([1-9]\.)\s+/gm, '$1 ');
    cleaned = cleaned.replace(/([.:؛،])\s*-\s+/g, '$1\n• ');
    cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '• ');
    cleaned = cleaned.replace(/\.([أإآابتثجحخدذرزسشصضطظعغفقكلمنهوي])/g, '. $1');
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Comprehensive AI Request Generator & Improver for the Client:
   * Works from a brief title, idea, or selected specialty and populates/improves:
   * Title, Multi-line Description, Required Skills (from catalog), Additional Requirements,
   * Expected Outputs, Delivery Days, Recommended Budget Range, and 100% Payment Milestones.
   */
  triggerAiFullSuggest() {
    if (this.isFetchingAiDraft() || this.isAiStreaming()) return;
    const rawTitle = this.title().trim();
    const rawDesc = this.description().trim();
    const specName = this.selectedSpec() === 'other' ? this.otherText().trim() : (this.currentSpec()?.name || '');

    if (rawTitle.length < 3 && rawDesc.length < 5 && !specName) {
      this.notify.warning('اكتب فكرة أو عنوانًا مبدئيًا للطلب (أو اختر التخصص في الخطوة الأولى) ليقوم الذكاء الاصطناعي بصياغة الطلب بالكامل.');
      return;
    }

    this.isFetchingAiDraft.set(true);
    if (rawDesc) {
      this.aiOriginalDescription.set(rawDesc);
    }

    this.projectApi.getAiDraftSuggestion({
      fullDraft: true,
      title: rawTitle || undefined,
      description: rawDesc || undefined,
      specialtyId: this.selectedSpec() || undefined,
      specialtyName: specName || 'عام',
      subSpecialties: Array.from(this.selectedSubs()),
      availableSkills: this.skillOptions(),
      deliveryDays: this.deliveryDays()
    }).subscribe({
      next: (res: any) => {
        this.isFetchingAiDraft.set(false);
        const d = res?.data || res;
        if (!d || (!d.suggestedTitle && !d.suggestedDescription)) {
          this.notify.warning('تعذر توليد المقترح الذكي حالياً، حاول مرة أخرى.');
          return;
        }

        if (d.suggestedTitle) {
          this.setTitle(this.formatClientDraftText(d.suggestedTitle, true));
        }
        if (d.suggestedDescription) {
          this.setDescription(this.formatClientDraftText(d.suggestedDescription, false));
        }

        // Match requiredSkills against loaded catalog (skillOptions) so backend validation always passes
        const catalog = this.skillOptions();
        if (catalog.length > 0) {
          const aiSkills: string[] = Array.isArray(d.suggestedRequiredSkills) ? d.suggestedRequiredSkills : [];
          const matched = catalog.filter(catSkill =>
            aiSkills.some(s => s.toLowerCase() === catSkill.toLowerCase() || catSkill.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(catSkill.toLowerCase()))
          );
          const finalSkills = matched.length > 0 ? matched.slice(0, 6) : catalog.slice(0, Math.min(4, catalog.length));
          this.setRequiredSkills(Array.from(new Set([...this.requiredSkills(), ...finalSkills])));
        }

        if (Array.isArray(d.suggestedRequirements) && d.suggestedRequirements.length > 0) {
          const cleanReqs = d.suggestedRequirements
            .map((r: string) => this.formatClientDraftText(r, true))
            .filter(Boolean);
          this.requirements.update(existing => Array.from(new Set([...existing, ...cleanReqs])).slice(0, 10));
        }

        if (d.suggestedOutputs) {
          this.outputs.set(this.formatClientDraftText(d.suggestedOutputs, false).slice(0, 1000));
        }

        if (typeof d.suggestedDurationDays === 'number' && d.suggestedDurationDays >= 1) {
          this.deliveryDays.set(Math.min(365, Math.round(d.suggestedDurationDays)));
        } else if (!this.deliveryDays()) {
          this.deliveryDays.set(7);
        }

        if (typeof d.recommendedMinBudget === 'number' && d.recommendedMinBudget > 0) {
          const minB = Math.max(100, Math.round(d.recommendedMinBudget));
          const maxB = Math.max(minB, Math.round(d.recommendedMaxBudget || minB * 2));
          this.budgetMin.set(minB);
          this.budgetMax.set(maxB);
          this.budgetFixed.set(Math.round((minB + maxB) / 2));
        }

        if (Array.isArray(d.suggestedMilestones) && d.suggestedMilestones.length >= 2) {
          this.splitMilestones.set(true);
          this.milestones.set(
            d.suggestedMilestones.map((m: any) => ({
              name: this.formatClientDraftText(m.name, true).slice(0, 120) || 'مرحلة تنفيذ',
              pct: Math.max(1, Math.round(Number(m.pct) || 0))
            }))
          );
        }

        this.notify.success('تم تحسين العنوان وكتابة الوصف والمخرجات والمهارات والميزانية والمراحل بالذكاء الاصطناعي بنجاح!');
      },
      error: (err: any) => {
        this.isFetchingAiDraft.set(false);
        this.notify.error(err?.error?.message || 'تعذر توليد المقترح بالذكاء الاصطناعي حالياً. حاول مرة أخرى.');
      }
    });
  }

  triggerAiDescription() {
    if (this.isAiStreaming()) return;
    const projTitle = this.title().trim();
    if (!this.canRefineWithAi()) {
      // No AI call, no socket, nothing written into the form.
      this.notify.warning(REWRITE_INPUT_REQUIRED_MESSAGE);
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
      this.socket = io(environment.socketUrl, { withCredentials: true, ...SOCKET_BACKOFF, auth: { token } });
    }

    const currentDesc = this.description().trim();
    const previousReview = this.aiStreamText() ? {
      text: this.aiStreamText(), original: this.aiOriginalDescription(), title: this.aiSourceTitle(), selected: this.aiSelectedOptionId(), applied: this.aiAppliedOptionId(), edits: this.aiDraftEdits(), status: this.aiReviewStatus()
    } : null;
    const restorePreviousReview = () => {
      if (!previousReview) return false;
      this.aiStreamText.set(previousReview.text); this.aiOriginalDescription.set(previousReview.original); this.aiSourceTitle.set(previousReview.title);
      this.aiSelectedOptionId.set(previousReview.selected); this.aiAppliedOptionId.set(previousReview.applied); this.aiDraftEdits.set(previousReview.edits); this.aiReviewStatus.set(previousReview.status);
      this.showAiSuggest.set(true); return true;
    };
    this.aiOriginalDescription.set(currentDesc);
    this.aiSourceTitle.set(projTitle);
    this.aiDraftEdits.set({});
    this.aiSelectedOptionId.set(null);
    this.aiAppliedOptionId.set(null);
    this.aiReviewStatus.set('idle');
    this.aiReviewError.set('');
    this.aiPreviewOverflow.set(false);
    this.aiMode.set('refine');
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
      if (data?.message) this.notify.success(data.message);
    });

    this.socket.on('ai:description_start', (data: any) => {
      this.isAiStreaming.set(true);
      this.aiPhase.set('generating');
    });

    this.socket.on('ai:description_chunk', (data: { chunk: string; mode: string }) => {
      if (data?.chunk) {
        this.aiStreamText.update(text => { const next = text + data.chunk; if (next.length > REWRITE_PREVIEW_MAX_CHARS) this.aiPreviewOverflow.set(true); return next.slice(0, REWRITE_PREVIEW_MAX_CHARS); });
        this.aiReviewStatus.set('partial');
      }
    });

    this.socket.on('ai:description_complete', (data: { fullText?: string; message?: string; mode: string; error?: boolean; truncated?: boolean; partial?: boolean; status?: string; completed?: boolean; finishReason?: string }) => {
      this.isAiStreaming.set(false);
      this.aiPhase.set('idle');
      if (typeof data?.fullText === 'string') {
        this.aiPreviewOverflow.set(data.fullText.length > REWRITE_PREVIEW_MAX_CHARS);
        this.aiStreamText.set(data.fullText.slice(0, REWRITE_PREVIEW_MAX_CHARS));
      }
      const checked = checkRewriteOutput(currentDesc, this.aiStreamText());
      if (!checked.ok) {
        // An empty reply: nothing to show, the client's text stays.
        this.aiStreamText.set('');
        if (!restorePreviousReview()) this.showAiSuggest.set(false);
        this.notify.warning('لم تُرجع خدمة الصياغة نصًا، فبقي وصفك كما كتبته. حاول مرة أخرى.');
        return;
      }
      this.aiStreamText.set(checked.text);
      const incomplete = this.aiPreviewOverflow() || data?.error === true || data?.truncated === true || data?.partial === true || data?.completed === false || (data?.status && !['completed', 'success'].includes(data.status)) || (data?.finishReason && data.finishReason !== 'STOP');
      this.aiReviewStatus.set(incomplete ? 'partial' : 'completed');
      this.aiSelectedOptionId.set(this.aiPreview().options[0]?.id ?? null);
      if (incomplete) {
        this.notify.warning('الرد غير مكتمل؛ المعاينة محفوظة، ولم يتغير وصفك. أعد المحاولة لاستكمال الصياغة.');
        return;
      }
      this.notify.success(data?.message || 'اكتملت إعادة الصياغة، راجعها قبل اعتمادها');
    });

    this.socket.on('ai:description_error', (data: { message?: string; partialText?: string; truncated?: boolean }) => {
      this.isAiStreaming.set(false);
      this.aiPhase.set('idle');
      this.aiReviewStatus.set('error');
      if (typeof data?.partialText === 'string' && data.partialText.trim()) this.aiStreamText.set(data.partialText.slice(0, REWRITE_PREVIEW_MAX_CHARS));
      if (!this.aiStreamText()) restorePreviousReview();
      this.aiSelectedOptionId.set(this.aiSelectedOptionId() ?? this.aiPreview().options[0]?.id ?? null);
      this.aiReviewError.set(data?.message || 'تعذرت إعادة الصياغة. وصفك والمقترحات السابقة محفوظة.');
      this.showAiSuggest.set(!!this.aiStreamText());
      this.notify.error(data?.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي حالياً. حاول مرة أخرى لاحقاً.');
    });

    this.socket.emit('ai:generate_description', {
      projectTitle: projTitle,
      specialtyId: this.selectedSpec() || undefined,
      specialtyName: this.selectedSpec() === 'other' ? this.otherText().trim() : this.currentSpec()?.name,
      subSpecialties: Array.from(this.selectedSubs()),
      existingDescription: currentDesc
    });
  }

  // ==============================
  // STEP 4: Budget (الميزانية)
  // ==============================
  budgetType = signal('range');
  budgetMin = signal<number | null>(null);
  budgetMax = signal<number | null>(null);
  budgetFixed = signal<number | null>(null);
  budgetHourly = signal<number | null>(null);
  allowNegotiation = signal(true);
  splitMilestones = signal(false);
  /**
   * The source of truth for the payment milestones. EVERY write (typing, paste, a restored draft, a direct set/update) goes through
   * capMilestones(), so the stored values - and with them the displayed total, the draft and the payload - can never add up to more than 100.
   */
  private readonly milestonesState = signal<Milestone[]>([]);
  readonly milestones = Object.assign(computed(() => this.milestonesState()), {
    set: (value: Milestone[]) => this.milestonesState.set(capMilestones(value)),
    update: (fn: (current: Milestone[]) => Milestone[]) => this.milestonesState.set(capMilestones(fn(this.milestonesState()))),
  });

  /** Fields the user already left (blur) or tried to move past (Add / Next): only these show their error, never while typing. */
  private milestoneTouched = signal<ReadonlySet<string>>(new Set());

  touchMilestone(index: number, field: 'name' | 'pct') {
    if (field === 'pct') this.milestoneCapMessage.set(null);
    this.milestoneTouched.update(set => new Set(set).add(`${index}:${field}`));
  }

  private touchAllMilestones() {
    this.milestoneTouched.set(new Set(this.milestones().flatMap((_, i) => [`${i}:name`, `${i}:pct`])));
  }

  private isMilestoneNameInvalid(m: Milestone) { return !m.name || m.name.trim().length < 2; }
  private isMilestonePctInvalid(m: Milestone) { return m.pct === null || !Number.isFinite(m.pct) || m.pct <= 0 || m.pct > 100; }

  /** Error text of one milestone field, or null (also null while the field has not been touched yet). */
  milestoneFieldError(index: number, field: 'name' | 'pct'): string | null {
    const m = this.milestones()[index];
    if (!m || !this.milestoneTouched().has(`${index}:${field}`)) return null;
    if (field === 'name') return this.isMilestoneNameInvalid(m) ? 'اسم المرحلة حرفان على الأقل' : null;
    return this.isMilestonePctInvalid(m) ? 'أدخل نسبة صحيحة بين 1 و100' : null;
  }

  /** Message shown when Add is refused because the total already reached 100. */
  milestoneAddBlockedMessage = signal<string | null>(null);

  addMilestone() {
    // A new row could not receive any percentage once the total is 100: refuse with a clear message instead.
    if (this.milestoneTotalPct >= 100) {
      this.milestoneAddBlockedMessage.set('مجموع النسب وصل 100%. قلّل نسبة مرحلة أخرى لإضافة مرحلة جديدة');
      return;
    }
    this.milestoneAddBlockedMessage.set(null);
    // Pressing Add reveals the errors of the rows already there (never while typing); the new row starts clean and untouched.
    if (this.milestones().some(m => this.isMilestoneNameInvalid(m) || this.isMilestonePctInvalid(m))) this.touchAllMilestones();
    this.milestones.update(m => [...m, { name: '', pct: null }]);
  }

  removeMilestone(index: number) {
    this.milestones.update(m => m.filter((_, i) => i !== index));
    this.milestoneTouched.set(new Set());
    this.milestoneAddBlockedMessage.set(null);
    this.milestoneCapMessage.set(null);
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

  /** Shown under the group while a typed/pasted percentage was cut down to what is left of 100. */
  milestoneCapMessage = signal<string | null>(null);

  /** What is left of 100 for one row: 100 minus every OTHER row. */
  milestoneRemaining(index: number): number {
    const others = this.milestones().reduce((sum, m, i) => sum + (i === index ? 0 : (m.pct || 0)), 0);
    return Math.max(0, 100 - others);
  }

  /**
   * Sets one row's percentage. Whole numbers only; a value above what is left of 100 is cut to what is left (the total can never pass 100),
   * empty stays empty (null, never forced to 0). Returns the value that was really kept so the input can show it.
   */
  updateMilestonePct(index: number, pct: number | null): number | null {
    let kept: number | null = null;
    if (pct !== null && Number.isFinite(pct)) {
      const whole = Math.max(0, Math.trunc(pct));
      const room = this.milestoneRemaining(index);
      kept = Math.min(whole, room);
      this.milestoneCapMessage.set(whole > room ? 'مجموع النسب لا يمكن أن يتجاوز 100%' : null);
    } else {
      this.milestoneCapMessage.set(null);
    }
    this.milestoneAddBlockedMessage.set(null);
    this.milestones.update(m => m.map((ms, i) => i === index ? { ...ms, pct: kept } : ms));
    return kept;
  }

  /** Raw typing/paste handler of a percentage input: digits only (no sign, decimals, symbols), at most 3 digits, then capped by the remainder. */
  onMilestonePctInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = (input.value ?? '').replace(/\D/g, '').slice(0, 3);
    const kept = this.updateMilestonePct(index, digits === '' ? null : Number(digits));
    const shown = kept === null ? '' : String(kept);
    if (input.value !== shown) input.value = shown;   // the same input element is kept (no re-creation, focus stays)
  }

  get milestoneTotalPct() {
    // never displayed above 100 (a restored draft or a forced state cannot show 110%)
    return Math.min(100, this.milestones().reduce((sum, m) => sum + (m.pct || 0), 0));
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
        this.notify.warning(`الملف "${invalid.name}" يتجاوز الحد الأقصى 10MB`);
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
    this.notify.success(`تمت إضافة "${name}" إلى قائمة الشروط الإضافية`);
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
      return this.title().trim().length >= 3 && this.description().trim().length >= 10 && this.deliveryDaysValid();
    }
    if (step === 4) {
      // Same predicate as stepProblems(4): a value counts only when it is a finite number above 0.
      const pos = (v: number | null) => v !== null && Number.isFinite(v) && v > 0;
      if (this.budgetType() === 'fixed') {
        if (!pos(this.budgetFixed())) return false;
      } else if (this.budgetType() === 'hourly') {
        if (!pos(this.budgetHourly())) return false;
      } else if (this.budgetType() === 'range') {
        if (!pos(this.budgetMin()) || !pos(this.budgetMax()) || this.budgetMin()! > this.budgetMax()!) return false;
      }

      if (this.splitMilestones()) {
        if (this.milestones().length < 2) return false;
        if (this.milestoneTotalPct !== 100) return false;
        for (const m of this.milestones()) {
          if (!m.name || m.name.trim().length < 2) return false;
          if (this.isMilestonePctInvalid(m)) return false;
        }
      }
      return true;
    }
    return true; // Step 5 and 6
  });

  /** Whole days between 1 and 365 (the input's own limits); empty or 0 is NOT a value. */
  deliveryDaysValid(): boolean {
    const d = this.deliveryDays();
    return d !== null && Number.isFinite(d) && Number.isInteger(d) && d >= 1 && d <= 365;
  }

  /** Every problem that blocks Next on one step, in page order, each tied to the control that shows it. */
  stepProblems(step: number): FieldProblem[] {
    const out: FieldProblem[] = [];
    const add = (field: string, message: string) => out.push({ field, message, step });
    if (step === 1) {
      const spec = this.currentSpec();
      if (!spec) add('f-specialty-grid', 'اختر تخصصًا واحدًا للمتابعة');
      else if (spec.id === 'other' && this.otherText().trim().length < 5) add('f-other-spec', 'اكتب اسم التخصص بخمسة أحرف على الأقل');
    } else if (step === 3) {
      if (this.title().trim().length < 3) add('f-title', 'اكتب عنوانًا للطلب (3 أحرف على الأقل)');
      if (this.description().trim().length < 10) add('f-desc', 'اكتب وصفًا للطلب (10 أحرف على الأقل)');
      if (this.deliveryDays() === null) add('f-deadline', 'أدخل أيام التسليم المقترحة');
      else if (!this.deliveryDaysValid()) add('f-deadline', 'أيام التسليم عدد صحيح من 1 إلى 365');
    } else if (step === 4) {
      const type = this.budgetType();
      const positive = (v: number | null) => v !== null && Number.isFinite(v) && v > 0;
      if (type === 'fixed') {
        if (!positive(this.budgetFixed())) add('f-budget-fixed', 'أدخل الميزانية بالدولار');
      } else if (type === 'hourly') {
        if (!positive(this.budgetHourly())) add('f-budget-hourly', 'أدخل سعر الساعة بالدولار');
      } else if (type === 'range') {
        const lo = this.budgetMin(), hi = this.budgetMax();
        if (!positive(lo)) add('f-budget-from', 'أدخل الحد الأدنى للميزانية بالدولار');
        if (!positive(hi)) add('f-budget-to', 'أدخل الحد الأعلى للميزانية بالدولار');
        else if (positive(lo) && lo! > hi!) add('f-budget-to', 'الحد الأعلى يجب أن يكون أكبر من أو يساوي الحد الأدنى');
      }
    }
    return out;
  }

  /** Index and field of the first invalid milestone input (rows already show their own message once touched). */
  private firstMilestoneProblem(): { id: string } | null {
    const ms = this.milestones();
    for (let i = 0; i < ms.length; i++) {
      if (this.isMilestoneNameInvalid(ms[i])) return { id: `ms-name-${i}` };
      if (this.isMilestonePctInvalid(ms[i])) return { id: `ms-pct-${i}` };
    }
    return null;
  }

  /** Shows WHY Next is blocked: message under each field, red mark, focus on the first one below the sticky header. */
  private async showStepProblems(step: number): Promise<void> {
    const root = this.host.nativeElement;
    const problems = this.stepProblems(step);
    if (step === 4 && this.splitMilestones() && !problems.length) {
      this.touchAllMilestones();
      const row = this.firstMilestoneProblem();
      if (row) {
        await new Promise<void>(r => setTimeout(r, 0));
        const el = root.querySelector<HTMLElement>(`[id="${row.id}"]`);
        if (el) { el.setAttribute('aria-invalid', 'true'); scrollFocus(el); }
        return;
      }
      const total = this.milestoneTotalPct;
      problems.push({
        field: 'ms-section', step,
        message: this.milestones().length < 2 ? 'أضف مرحلتين على الأقل لتقسيم الدفع' : `مجموع نسب المراحل يجب أن يساوي 100% (الآن ${total}%)`,
      });
    } else if (step === 4 && this.splitMilestones()) {
      this.touchAllMilestones();
    }
    if (!problems.length) return;
    await reportClientProblems(root, problems, { openStep: s => this.currentStep.set(Number(s)) });
  }

  goNext() {
    if (!this.canProceed()) {
      // Next stays clickable: pressing it says what is missing, next to the field, and focuses the first one.
      void this.showStepProblems(this.currentStep());
      return;
    }
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
  /** Why publishing failed, shown next to the publish button (the wizard entries stay as they are). */
  publishError = signal<string>('');
  /** Set when the server answered with the request that already existed (same request sent again): its id, so the success screen says it was already saved and links to it. */
  alreadyPublishedId = signal<string | null>(null);
  showSuccessOverlay = signal(false);

  /**
   * UNCERTAIN OUTCOME: a publish whose answer was lost (network / gateway / unexpected 5xx) may or may not have been saved. The moment it happened is kept (also across a reload):
   * until the user has looked at the requests that appeared since, «نشر الطلب» does not create anything - whatever the typed content is now and however long ago it was.
   */
  private static readonly UNCERTAIN_KEY = 'ws:publish-uncertain:v1';
  uncertainSince = signal<number | null>(CreateRequest.readUncertain());
  publishCandidates = signal<Array<{ id: string; title: string; createdAt: string }> | null>(null);
  publishVerifying = signal(false);
  private lastAttemptAt = 0;
  private static readUncertain(): number | null {
    try { const v = Number(localStorage.getItem(CreateRequest.UNCERTAIN_KEY)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
  }
  private setUncertain(at: number | null) {
    this.uncertainSince.set(at);
    try { if (at) localStorage.setItem(CreateRequest.UNCERTAIN_KEY, String(at)); else localStorage.removeItem(CreateRequest.UNCERTAIN_KEY); } catch { /* storage unavailable: the in-memory state still gates this page */ }
  }

  /** Looks at the client's own requests created since the uncertain attempt (any title, any content). Found -> stop and show them; none -> the lost publish never arrived, publishing is safe. */
  private verifyPublishOutcome() {
    if (this.publishVerifying()) return;
    this.publishVerifying.set(true);
    this.publishError.set('');
    this.projectApi.getMyRequests().subscribe({
      next: (res: any) => {
        this.publishVerifying.set(false);
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.requests ?? []);
        const since = (this.uncertainSince() ?? 0) - 2 * 60 * 1000; // clock difference between this device and the server
        const found = list.filter(r => r?.createdAt && new Date(r.createdAt).getTime() >= since).map(r => ({ id: String(r.id), title: String(r.title ?? ''), createdAt: String(r.createdAt) }));
        if (found.length) { this.publishCandidates.set(found); return; }
        this.setUncertain(null);
        this.publishCandidates.set(null);
        void this.submitRequest();
      },
      error: () => {
        this.publishVerifying.set(false);
        this.publishError.set('تعذر التحقق من طلباتك الحالية، فلن ننشئ طلبًا جديدًا الآن. تحقق من اتصالك ثم اضغط «نشر الطلب» مرة أخرى، أو افتح «طلباتي» وراجعها أولًا.');
      }
    });
  }

  openPublishCandidate(id: string) { void this.router.navigate(['/client-overview/my-requests', id]); }

  /** The user looked at the listed requests and none of them is the one being published: an explicit choice to create a new one. */
  publishAnyway() {
    this.setUncertain(null);
    this.publishCandidates.set(null);
    void this.submitRequest();
  }

  async submitRequest() {
    if (this.uncertainSince() !== null) { this.verifyPublishOutcome(); return; }
    if (this.isSubmitting() || !this.publishGuard.enter()) return;
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
        this.publishGuard.release();
        this.notify.error('تعذر رفع الملفات. تحقق من الاتصال وحاول مرة أخرى.');
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
      requiredSkills: this.requiredSkills(),
      budgetType: (this.budgetType() || 'FIXED').toUpperCase(),
      minBudget: minB,
      maxBudget: maxB,
      expectedDurationDays: this.deliveryDays(),
      preferredProviderType: 'ANY',
      requiresNda: this.ndaType() === 'standard' || this.ndaType() === 'custom',
      attachments: uploadedFileUrls,
      outputs: this.outputs(),
      customConditions: this.composeConditions(),
      providerPreferences: {
        level: this.provLevel() || null,
        minRating: this.provRating() ? Number(this.provRating()) : null,
        language: this.provLang(),
        location: this.provLocation() || null
      },
      ipRights: this.ipRights(),
      allowNegotiation: this.allowNegotiation(),
      splitMilestones: this.splitMilestones(),
      milestones: this.splitMilestones() ? this.milestones().map(m => ({ name: m.name, pct: m.pct as number })) : [] // validated: every pct is a number here
    };

    this.publishError.set('');
    this.lastAttemptAt = Date.now();
    this.projectApi.createProject(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.publishGuard.release();
        this.setUncertain(null);
        this.alreadyPublishedId.set((res as { deduplicated?: boolean })?.deduplicated ? ((res as { data?: { id?: string } }).data?.id ?? null) : null);
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
        this.publishGuard.release();
        console.error('Project creation failed:', err);
        this.handlePublishError(err);
      }
    });
  }

  /** Server field -> the control (and wizard step) that shows it. Only a 400/422 may land on a field. */
  private publishFieldMap(): { resolve: Record<string, string>; steps: Record<string, number> } {
    const type = this.budgetType();
    const lo = type === 'fixed' ? 'f-budget-fixed' : type === 'hourly' ? 'f-budget-hourly' : 'f-budget-from';
    const hi = type === 'range' ? 'f-budget-to' : lo;
    return {
      resolve: { title: 'f-title', description: 'f-desc', expectedDurationDays: 'f-deadline', minBudget: lo, maxBudget: hi, specialty: 'f-specialty-grid', specialtyId: 'f-specialty-grid', milestones: 'ms-section' },
      steps: { title: 3, description: 3, expectedDurationDays: 3, minBudget: 4, maxBudget: 4, milestones: 4, specialty: 1, specialtyId: 1 },
    };
  }

  private handlePublishError(err: any): void {
    const mapped = mapHttpError(err, { fallback: 'حدث خطأ أثناء رفع الطلب، يرجى المحاولة مرة أخرى' });
    const errMsg = err?.error?.message || mapped.message;
    if (err?.status === 400 && /مهار|skill/i.test(String(errMsg))) {
      this.skillsServerError.set(errMsg);
      this.currentStep.set(3);
      this.notify.error(errMsg);
      return;
    }
    // Network / 429 / 5xx / 403 / 409 and any 400 without field names: one honest generic message next to the button (and as a toast), no invented field error.
    if (!hasFieldErrors(err)) {
      // a lost answer: the server never creates a second copy of the same request (it answers with the existing one), so repeating is safe - say so
      if (mapped.outcomeUnknown) this.setUncertain(this.lastAttemptAt || Date.now());
      const text = mapped.outcomeUnknown ? 'نتيجة النشر غير مؤكدة: انقطع الاتصال قبل أن نعرف إن كان طلبك وصل. عند الضغط على «نشر الطلب» سنتحقق أولًا من طلباتك قبل إنشاء أي طلب جديد.' : mapped.message;
      this.publishError.set(text);
      this.notify.error(mapped.message);
      return;
    }
    void reportClientBackend(this.host.nativeElement, err, { ...this.publishFieldMap(), openStep: s => this.currentStep.set(Number(s)) }).then(r => {
      this.notify.error(r.handled && !r.generic ? 'راجع الحقول المحددة بالأحمر ثم أعد النشر' : (r.generic || mapped.message));
    });
  }

  ngOnDestroy() {
    if (this.recTimer) clearTimeout(this.recTimer);
    this.sameUrlSub?.unsubscribe();
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
