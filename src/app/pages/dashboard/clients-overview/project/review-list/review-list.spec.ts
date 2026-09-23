import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ReviewList } from './review-list';

// Shape matches ProjectProgressService.getPendingReviewDeliveries()'s real return
// value exactly (waseetai-backend/src/services/project-progress.service.ts) — no
// fields here are invented beyond what the real backend already sends.
const samplePendingItem = {
  projectId: 'proj-1',
  projectTitle: 'تطوير منصة إدارة مشاريع وخدمات رقمية',
  stageId: 'stage-1',
  stageNumber: 2,
  stageTitle: 'الهوية الكاملة',
  amount: 1500,
  submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  providerName: 'نورة التصميم',
  filesCount: 4,
  contractRef: 'CT-ABC123'
};

describe('ReviewList', () => {
  let component: ReviewList;
  let fixture: ComponentFixture<ReviewList>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(getImpl: () => any) {
    getSpy = vi.fn(getImpl);
    await TestBed.configureTestingModule({
      imports: [ReviewList],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewList);
    component = fixture.componentInstance;
  }

  it('should create', async () => {
    await setup(() => of({ success: true, data: [] }));
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('calls the real pending-deliveries endpoint and no other', async () => {
    await setup(() => of({ success: true, data: [] }));
    await fixture.whenStable();
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy.mock.calls[0][0]).toContain('/client/my-requests/pending-deliveries');
  });

  it('shows a loading state before the response arrives', async () => {
    const subject = new Subject<any>();
    await setup(() => subject.asObservable());
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.state-card:not(.error-state):not(.empty-state)')).toBeTruthy();
    subject.next({ success: true, data: [] });
    subject.complete();
    await fixture.whenStable();
  });

  it('shows a polished empty state for zero pending deliveries — never fake cards', async () => {
    await setup(() => of({ success: true, data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.items().length).toBe(0);
    expect(component.hasError()).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('لا توجد تسليمات بانتظار المراجعة حالياً');
    expect(fixture.nativeElement.querySelector('.rv-card')).toBeNull();
  });

  it('shows an error state with a retry action on API failure', async () => {
    await setup(() => throwError(() => new Error('network down')));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);
    expect(fixture.nativeElement.querySelector('.retry-btn')).toBeTruthy();
  });

  it('retry re-fetches and recovers from an error', async () => {
    let call = 0;
    await setup(() => {
      call++;
      return call === 1 ? throwError(() => new Error('network down')) : of({ success: true, data: [samplePendingItem] });
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);

    (fixture.nativeElement.querySelector('.retry-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.items().length).toBe(1);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('renders a real pending item using only real response fields', async () => {
    await setup(() => of({ success: true, data: [samplePendingItem] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(samplePendingItem.projectTitle);
    expect(text).toContain(samplePendingItem.providerName);
    expect(text).toContain(samplePendingItem.contractRef);
    expect(text).toContain('1,500');
    expect(text).toContain('قبل يوم');
  });

  it('file count comes from the real response, not a hardcoded value', async () => {
    await setup(() => of({ success: true, data: [{ ...samplePendingItem, filesCount: 7 }] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('7 ملفات');
  });

  it('the review action links to the correct project/stage delivery-review URL', async () => {
    await setup(() => of({ success: true, data: [samplePendingItem] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.rv-cta');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/client-overview/projects/proj-1/delivery-review/stage-1');
  });
});
