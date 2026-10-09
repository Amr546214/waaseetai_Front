import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { from, of, throwError } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { on: vi.fn(), off: vi.fn(), once: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ io: (...args: any[]) => ioSpy(...args) }));

import { CreateRequest } from './create-request';

describe('CreateRequest', () => {
  let component: CreateRequest;
  let fixture: ComponentFixture<CreateRequest>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let navigateByUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Isolate every test from any draft a previous test (or a previous run)
    // may have left behind — restoration must not leak across tests.
    sessionStorage.clear();

    // Pre-existing test-environment gap (unrelated to this batch): this
    // runner provides sessionStorage natively but not a global localStorage,
    // and CreateRequest injects the real AuthStore, whose constructor reads
    // localStorage synchronously — every test in this file crashed before
    // even reaching its own logic. A minimal stub (re-applied before every
    // test, including ones inside the inner describe block below that calls
    // vi.unstubAllGlobals() in its own afterEach) is enough for AuthStore to
    // initialize as "no stored session", which is all this component needs.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });

    postSpy = vi.fn(() => of({ success: true, data: { id: 'new-request-id' } }));

    await TestBed.configureTestingModule({
      imports: [CreateRequest],
      providers: [
        // A real (empty) router so RouterLink directives on the success
        // overlay's buttons resolve/click correctly, instead of a bare stub
        // that RouterLink's internals could choke on.
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...args: any[]) => /specialty-recommendations/.test(String(args[0])) ? of({ success: false }) : postSpy(...args) } }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CreateRequest);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();

    // Put the component into a state where only Step 4 (budget/milestones)
    // determines canProceed(): a valid RANGE budget already set.
    component.currentStep.set(4);
    component.budgetType.set('range');
    component.budgetMin.set(5000);
    component.budgetMax.set(15000);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Real-time AI description socket (F2 JWT auth follow-up)', () => {
    // This test environment has no global `localStorage` (unlike a real
    // browser), so the component's own token lookup is exercised against a
    // stubbed one rather than skipping the assertion.
    let store: Record<string, string>;

    beforeEach(() => {
      ioSpy.mockClear();
      store = {};
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        clear: () => { store = {}; }
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends the stored JWT via auth.token on the ai:generate_description socket connection', () => {
      (localStorage as any).setItem('waseet_token', 'test-jwt-abc');
      component.title.set('تطوير متجر إلكتروني لبيع الملابس');
      component.description.set('أحتاج متجرًا إلكترونيًا لبيع الملابس يدعم الدفع عبر الإنترنت وإدارة المخزون');

      component.triggerAiDescription();

      expect(ioSpy).toHaveBeenCalledTimes(1);
      const [, options] = ioSpy.mock.calls[0];
      expect(options.auth).toEqual({ token: 'test-jwt-abc' });
      expect(options.withCredentials).toBe(true);
    });

    it('never puts the token in the socket URL/query string', () => {
      (localStorage as any).setItem('waseet_token', 'test-jwt-abc');
      component.title.set('تطوير متجر إلكتروني لبيع الملابس');
      component.description.set('أحتاج متجرًا إلكترونيًا لبيع الملابس يدعم الدفع عبر الإنترنت وإدارة المخزون');

      component.triggerAiDescription();

      const [url, options] = ioSpy.mock.calls[0];
      expect(String(url)).not.toContain('test-jwt-abc');
      expect(JSON.stringify(options.query ?? {})).not.toContain('test-jwt-abc');
    });
  });

  describe('Step 4 milestone reactivity (canProceed)', () => {
    it('milestones disabled: Next is allowed with just a valid budget', () => {
      component.splitMilestones.set(false);
      expect(component.canProceed()).toBe(true);
    });

    it('milestones disabled: stale milestone data is never submitted', () => {
      component.splitMilestones.set(false);
      component.addMilestone();
      component.updateMilestoneName(0, 'مرحلة قديمة');
      component.updateMilestonePct(0, 40);
      // splitMilestones is off, so canProceed must not consult milestone state at all.
      expect(component.canProceed()).toBe(true);
    });

    it('25/50/25 with valid names: Next is allowed (regression for the reported bug)', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.addMilestone();

      component.updateMilestoneName(0, 'تحليل المتطلبات وتصميم النظام');
      component.updateMilestonePct(0, 25);
      component.updateMilestoneName(1, 'تطوير المنصة والخصائص الأساسية');
      component.updateMilestonePct(1, 50);
      component.updateMilestoneName(2, 'الاختبار والتسليم النهائي');
      component.updateMilestonePct(2, 25);

      expect(component.milestoneTotalPct).toBe(100);
      expect(component.canProceed()).toBe(true);
    });

    it('total below 100 (e.g. 90) remains blocked', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.updateMilestoneName(0, 'مرحلة أولى');
      component.updateMilestonePct(0, 40);
      component.updateMilestoneName(1, 'مرحلة ثانية');
      component.updateMilestonePct(1, 50);

      expect(component.milestoneTotalPct).toBe(90);
      expect(component.canProceed()).toBe(false);
    });

    it('total can never pass 100: 60 then 50 is cut to the 40 that is left', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.updateMilestoneName(0, 'مرحلة أولى');
      component.updateMilestonePct(0, 60);
      component.updateMilestoneName(1, 'مرحلة ثانية');
      expect(component.updateMilestonePct(1, 50)).toBe(40);

      expect(component.milestoneTotalPct).toBe(100);
      expect(component.milestoneCapMessage()).toBe('مجموع النسب لا يمكن أن يتجاوز 100%');
    });

    it('an empty milestone name remains blocked even when the total is exactly 100', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.updateMilestoneName(0, '');
      component.updateMilestonePct(0, 50);
      component.updateMilestoneName(1, 'مرحلة ثانية');
      component.updateMilestonePct(1, 50);

      expect(component.milestoneTotalPct).toBe(100);
      expect(component.canProceed()).toBe(false);
      expect(component.milestoneNameError).toBe(true);
    });

    it('fewer than 2 milestones remains blocked', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.updateMilestoneName(0, 'مرحلة وحيدة');
      component.updateMilestonePct(0, 100);

      expect(component.canProceed()).toBe(false);
    });

    it('editing milestone fields via updateMilestoneName/updateMilestonePct correctly invalidates the canProceed computed (root-cause regression)', () => {
      // This is the exact failure mode from the bug report: canProceed is a
      // signal computed() — mutating a milestone object's fields without
      // going through milestones.set()/.update() would leave it permanently
      // stale. Asserting the sequence here pins that down.
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      expect(component.canProceed()).toBe(false); // freshly added, empty/zero

      component.updateMilestoneName(0, 'مرحلة أولى');
      component.updateMilestonePct(0, 50);
      component.updateMilestoneName(1, 'مرحلة ثانية');
      component.updateMilestonePct(1, 50);

      expect(component.canProceed()).toBe(true); // must react to the edits, not stay stale
    });
  });

  describe('Publish flow (submitRequest) and success-overlay navigation', () => {
    it('calls createProject exactly once on submit', async () => {
      await component.submitRequest();
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    it('shows the success overlay after a successful publish', async () => {
      expect(component.showSuccessOverlay()).toBe(false);
      await component.submitRequest();
      expect(component.showSuccessOverlay()).toBe(true);
    });

    it('does NOT automatically navigate away after a successful publish, even after 3+ seconds', async () => {
      vi.useFakeTimers();
      try {
        await component.submitRequest();

        await vi.advanceTimersByTimeAsync(10000); // well past the old 3000ms timer

        expect(component.showSuccessOverlay()).toBe(true);
        expect(navigateSpy).not.toHaveBeenCalled();
        expect(navigateByUrlSpy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('a publish API error does not navigate away and hides the success overlay state', async () => {
      postSpy.mockReturnValueOnce(throwError(() => ({ error: { message: 'فشل النشر' } })));

      await component.submitRequest();

      expect(component.showSuccessOverlay()).toBe(false);
      expect(component.isSubmitting()).toBe(false);
      expect(navigateSpy).not.toHaveBeenCalled();
      expect(navigateByUrlSpy).not.toHaveBeenCalled();
    });

    it('cannot submit twice concurrently while isSubmitting is true (duplicate-request guard)', async () => {
      // A synchronous of(...) response would resolve (and reset isSubmitting)
      // before the second call even runs, defeating this test. Resolve via a
      // microtask instead so the first request is genuinely still "in flight"
      // when the second call is made — matching a real HTTP round trip.
      postSpy.mockImplementation(() => from(Promise.resolve({ success: true, data: { id: 'new-request-id' } })));

      const firstCall = component.submitRequest();
      // Fired synchronously, before the first call's microtask resolves.
      const secondCall = component.submitRequest();
      await Promise.all([firstCall, secondCall]);

      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    it('"عرض طلباتي" navigates to /client-overview/my-requests', async () => {
      await component.submitRequest();
      fixture.detectChanges();

      const btn = Array.from(fixture.nativeElement.querySelectorAll('button'))
        .find((el: any) => el.textContent?.includes('عرض طلباتي')) as HTMLElement;
      expect(btn).toBeTruthy();
      btn.click();

      expect(navigateByUrlSpy).toHaveBeenCalledTimes(1);
      const target = navigateByUrlSpy.mock.calls[0][0];
      expect(target.toString()).toBe('/client-overview/my-requests');
    });

    it('"لوحة التحكم" navigates to /client-overview', async () => {
      await component.submitRequest();
      fixture.detectChanges();

      const link = Array.from(fixture.nativeElement.querySelectorAll('a'))
        .find((el: any) => el.textContent?.includes('لوحة التحكم')) as HTMLElement;
      expect(link).toBeTruthy();
      link.click();

      expect(navigateByUrlSpy).toHaveBeenCalledTimes(1);
      const target = navigateByUrlSpy.mock.calls[0][0];
      expect(target.toString()).toBe('/client-overview');
    });
  });

  describe('Draft persistence (sessionStorage)', () => {
    const DRAFT_KEY = 'waseetai:create-request:draft:v1';

    function readDraft(): any {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    }

    // Re-mounts a fresh CreateRequest instance against whatever is currently
    // in sessionStorage — the closest simulation of "the user hit refresh"
    // available without an actual full-page reload. Destroying the old
    // fixture first matters: a real refresh tears down the old page
    // entirely, and without this the still-alive original component's own
    // autosave effect can fire later and clobber whatever the test just put
    // in sessionStorage for the new instance to read.
    async function remount(): Promise<CreateRequest> {
      fixture.destroy();
      const freshFixture = TestBed.createComponent(CreateRequest);
      await freshFixture.whenStable();
      return freshFixture.componentInstance;
    }

    it('a fresh wizard with no stored draft starts at Step 1', async () => {
      sessionStorage.clear();
      const restored = await remount();
      expect(restored.currentStep()).toBe(1);
    });

    it('moving through the wizard persists currentStep', async () => {
      component.currentStep.set(2);
      await fixture.whenStable();

      expect(readDraft()?.currentStep).toBe(2);
    });

    it('Step 1 data survives a simulated refresh (component recreation)', async () => {
      component.selectedSpec.set('tech');
      component.selectedSubs.set(new Set(['ui-ux', 'frontend']));
      component.otherText.set('نص إضافي');
      await fixture.whenStable();

      const restored = await remount();

      expect(restored.selectedSpec()).toBe('tech');
      expect(Array.from(restored.selectedSubs()).sort()).toEqual(['frontend', 'ui-ux']);
      expect(restored.otherText()).toBe('نص إضافي');
    });

    it('Step 3 title/description/requirements survive restoration', async () => {
      component.title.set('تطوير متجر إلكتروني متكامل');
      component.description.set('وصف تفصيلي كافٍ لمتطلبات المشروع المطلوب تنفيذه.');
      component.requirements.set(['متطلب أول', 'متطلب ثاني']);
      component.outputs.set('مخرجات متوقعة');
      component.deliveryDays.set(21);
      await fixture.whenStable();

      const restored = await remount();

      expect(restored.title()).toBe('تطوير متجر إلكتروني متكامل');
      expect(restored.description()).toBe('وصف تفصيلي كافٍ لمتطلبات المشروع المطلوب تنفيذه.');
      expect(restored.requirements()).toEqual(['متطلب أول', 'متطلب ثاني']);
      expect(restored.outputs()).toBe('مخرجات متوقعة');
      expect(restored.deliveryDays()).toBe(21);
    });

    it('Step 4 budget values survive restoration', async () => {
      component.budgetType.set('fixed');
      component.budgetFixed.set(8000);
      component.allowNegotiation.set(false);
      await fixture.whenStable();

      const restored = await remount();

      expect(restored.budgetType()).toBe('fixed');
      expect(restored.budgetFixed()).toBe(8000);
      expect(restored.allowNegotiation()).toBe(false);
    });

    it('splitMilestones survives restoration', async () => {
      component.splitMilestones.set(true);
      await fixture.whenStable();

      const restored = await remount();

      expect(restored.splitMilestones()).toBe(true);
    });

    it('milestone names and percentages survive restoration, and a valid 25/50/25 restore still allows proceeding', async () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.addMilestone();
      component.updateMilestoneName(0, 'تحليل المتطلبات وتصميم النظام');
      component.updateMilestonePct(0, 25);
      component.updateMilestoneName(1, 'تطوير المنصة والخصائص الأساسية');
      component.updateMilestonePct(1, 50);
      component.updateMilestoneName(2, 'الاختبار والتسليم النهائي');
      component.updateMilestonePct(2, 25);
      await fixture.whenStable();

      const restored = await remount();

      expect(restored.milestones()).toEqual([
        { name: 'تحليل المتطلبات وتصميم النظام', pct: 25 },
        { name: 'تطوير المنصة والخصائص الأساسية', pct: 50 },
        { name: 'الاختبار والتسليم النهائي', pct: 25 }
      ]);
      expect(restored.milestoneTotalPct).toBe(100);
      // canProceed() is a computed() over the now-restored signals — it must
      // reflect them correctly without any separate "recompute" step.
      restored.currentStep.set(4);
      expect(restored.canProceed()).toBe(true);
    });

    it('corrupt sessionStorage JSON does not crash and starts fresh', async () => {
      sessionStorage.setItem(DRAFT_KEY, '{not valid json!!');

      const restored = await remount();

      expect(restored.currentStep()).toBe(1);
      expect(restored.title()).toBe('');
      // The corrupt entry must be replaced, not left behind — the fresh
      // instance's own autosave immediately writes a valid, empty draft.
      expect(readDraft()?.version).toBe(1);
      expect(readDraft()?.currentStep).toBe(1);
    });

    it('an unknown/incompatible draft version is safely ignored and cleared', async () => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 999, currentStep: 4, title: 'x' }));

      const restored = await remount();

      expect(restored.currentStep()).toBe(1);
      // The stale v999 payload must not survive — it's overwritten by the
      // fresh instance's own valid v1 autosave, not left in its old shape.
      expect(readDraft()?.version).toBe(1);
      expect(readDraft()?.currentStep).toBe(1);
    });

    it('non-numeric budget fields in stored JSON are restored as null, never leaked through as strings', async () => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: 1,
        currentStep: 4,
        step1: { selectedSpec: null, selectedSubs: [], otherText: '' },
        step2: { ndaType: 'standard', ipRights: 'client', provLevel: '', provRating: '4', provLang: 'ar', provLocation: 'sa', customConditions: '' },
        step3: { title: '', description: '', requirements: [], outputs: '', deliveryDays: 14 },
        step4: {
          budgetType: 'range',
          budgetMin: '5000', budgetMax: '15000', budgetFixed: 'x', budgetHourly: {},
          allowNegotiation: true, splitMilestones: false, milestones: []
        }
      }));

      const restored = await remount();

      expect(restored.budgetMin()).toBeNull();
      expect(restored.budgetMax()).toBeNull();
      expect(restored.budgetFixed()).toBeNull();
      expect(restored.budgetHourly()).toBeNull();
      expect(typeof restored.budgetMin()).not.toBe('string');
    });

    it('a failed publish keeps the draft', async () => {
      postSpy.mockReturnValueOnce(throwError(() => ({ error: { message: 'فشل النشر' } })));
      component.title.set('عنوان يجب أن يبقى بعد الفشل');
      await fixture.whenStable();

      await component.submitRequest();

      expect(readDraft()).not.toBeNull();
      expect(readDraft().step3.title).toBe('عنوان يجب أن يبقى بعد الفشل');
    });

    it('a successful publish clears the draft', async () => {
      await fixture.whenStable();
      expect(readDraft()).not.toBeNull(); // populated by the outer beforeEach's state changes

      await component.submitRequest();

      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('explicit confirmed Cancel clears the draft', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.handleCancel();

      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('dismissed Cancel keeps the draft', async () => {
      await fixture.whenStable();
      expect(readDraft()).not.toBeNull();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.handleCancel();

      expect(readDraft()).not.toBeNull();
    });

    it('a new Create Request after a successful publish starts fresh (Step 1, no leftover draft)', async () => {
      await component.submitRequest(); // clears the draft on success

      const restored = await remount();

      expect(restored.currentStep()).toBe(1);
      expect(restored.budgetMin()).toBeNull(); // the budget fields start empty (was a prefilled 0)
      // No leftover data from the published request — the fresh instance's
      // own autosave reflects only its own (default) state.
      expect(readDraft()?.currentStep).toBe(1);
      expect(readDraft()?.step3.title).toBe('');
    });

    it('File objects are never serialized into sessionStorage', async () => {
      const fakeFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.files.set([fakeFile]);
      await fixture.whenStable();

      const stored = sessionStorage.getItem(DRAFT_KEY)!;
      expect(stored).not.toContain('test.pdf');
      expect(readDraft().step5).toBeUndefined();
    });
  });

  // Regression coverage for the confirmed bug: refreshing the browser right
  // after a successful publish (draft already cleared) used to fall through
  // to the default currentStep=1 and silently re-show the empty wizard,
  // looking like the just-submitted request was lost.
  describe('Post-submit success-screen persistence (refresh vs. new request)', () => {
    const DRAFT_KEY = 'waseetai:create-request:draft:v1';
    const SUBMITTED_KEY = 'waseetai:create-request:submitted:v1';

    // A real browser refresh discards the old page's JS context outright —
    // nothing about the old instance ever runs again, including its
    // ngOnDestroy and its autosave effect. TestBed has no direct equivalent
    // of "the process was just killed", so this gets there in two steps:
    // (1) suppress only the marker-clearing call on the OLD instance (the
    // one real thing ngOnDestroy does that a true refresh would never get a
    // chance to run) and (2) actually destroy the old fixture so its
    // autosave effect can never fire again and clobber sessionStorage out
    // from under the fresh instance created afterward — the exact pitfall
    // the draft describe block's own remount() comment above warns about.
    async function simulateHardRefresh(): Promise<CreateRequest> {
      vi.spyOn(component as any, 'clearSubmittedMarker').mockImplementation(() => {});
      fixture.destroy();

      const freshFixture = TestBed.createComponent(CreateRequest);
      await freshFixture.whenStable();
      return freshFixture.componentInstance;
    }

    // Client-side navigation away from the success screen (its own "عرض
    // طلباتي"/"لوحة التحكم" buttons, or anywhere else) DOES run ngOnDestroy —
    // this is the accurate simulation for "the user is done with this
    // success screen and later starts a genuinely new request".
    async function navigateAwayThenRemount(): Promise<CreateRequest> {
      fixture.destroy();
      const freshFixture = TestBed.createComponent(CreateRequest);
      await freshFixture.whenStable();
      return freshFixture.componentInstance;
    }

    it('(A) a mid-draft refresh is unaffected — no submitted marker is written before a successful publish', async () => {
      component.title.set('عنوان أثناء التعبئة');
      await fixture.whenStable();

      expect(sessionStorage.getItem(SUBMITTED_KEY)).toBeNull();

      const restored = await simulateHardRefresh();

      expect(restored.showSuccessOverlay()).toBe(false);
      expect(restored.title()).toBe('عنوان أثناء التعبئة');
    });

    it('(B) a successful submission writes the submitted marker alongside clearing the draft', async () => {
      await component.submitRequest();

      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
      expect(sessionStorage.getItem(SUBMITTED_KEY)).not.toBeNull();
    });

    it('(C) refreshing immediately after a successful submission re-shows the success screen, not step 1', async () => {
      await component.submitRequest();

      const restored = await simulateHardRefresh();

      expect(restored.showSuccessOverlay()).toBe(true);
      expect(restored.currentStep()).toBe(1); // wizard fields are irrelevant now; the overlay covers them
    });

    it('(C) the restored success screen does not resubmit or duplicate the request', async () => {
      await component.submitRequest();
      const restored = await simulateHardRefresh();

      expect(restored.showSuccessOverlay()).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(1); // only the original submit — refresh alone never calls createProject again
    });

    it('(C) an expired/stale submitted marker (>24h old) is ignored and cleared rather than restored', async () => {
      await component.submitRequest();
      sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify({ at: Date.now() - 25 * 60 * 60 * 1000 }));

      const restored = await simulateHardRefresh();

      expect(restored.showSuccessOverlay()).toBe(false);
      expect(sessionStorage.getItem(SUBMITTED_KEY)).toBeNull();
    });

    it('(C) a corrupt submitted marker does not crash and is cleared, falling back to step 1', async () => {
      sessionStorage.setItem(SUBMITTED_KEY, '{not valid json');

      const restored = await simulateHardRefresh();

      expect(restored.showSuccessOverlay()).toBe(false);
      expect(restored.currentStep()).toBe(1);
      expect(sessionStorage.getItem(SUBMITTED_KEY)).toBeNull();
    });

    it('(D) navigating away from the success screen and starting a genuinely new request clears the marker and starts at step 1', async () => {
      await component.submitRequest();
      expect(sessionStorage.getItem(SUBMITTED_KEY)).not.toBeNull();

      const restored = await navigateAwayThenRemount();

      expect(sessionStorage.getItem(SUBMITTED_KEY)).toBeNull();
      expect(restored.showSuccessOverlay()).toBe(false);
      expect(restored.currentStep()).toBe(1);
    });

    it('(D) a later refresh of that genuinely-new, still-empty wizard does not resurrect the old success screen', async () => {
      await component.submitRequest();
      await navigateAwayThenRemount(); // user moved on, started a new request

      const restoredAgain = await simulateHardRefresh();

      expect(restoredAgain.showSuccessOverlay()).toBe(false);
    });
  });
});
