import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { from, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CreateRequest } from './create-request';

describe('CreateRequest', () => {
  let component: CreateRequest;
  let fixture: ComponentFixture<CreateRequest>;
  let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let navigateByUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    postSpy = vi.fn(() => of({ success: true, data: { id: 'new-request-id' } }));

    await TestBed.configureTestingModule({
      imports: [CreateRequest],
      providers: [
        // A real (empty) router so RouterLink directives on the success
        // overlay's buttons resolve/click correctly, instead of a bare stub
        // that RouterLink's internals could choke on.
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...args: any[]) => postSpy(...args) } }
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

  it('should create', () => {
    expect(component).toBeTruthy();
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

    it('total above 100 (e.g. 110) remains blocked', () => {
      component.splitMilestones.set(true);
      component.addMilestone();
      component.addMilestone();
      component.updateMilestoneName(0, 'مرحلة أولى');
      component.updateMilestonePct(0, 60);
      component.updateMilestoneName(1, 'مرحلة ثانية');
      component.updateMilestonePct(1, 50);

      expect(component.milestoneTotalPct).toBe(110);
      expect(component.canProceed()).toBe(false);
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
});
