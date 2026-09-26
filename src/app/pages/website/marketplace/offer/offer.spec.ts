import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Offer } from './offer';

describe('Offer', () => {
  let component: Offer;
  let fixture: ComponentFixture<Offer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Offer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Offer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Batch 6: the sidebar previously showed a hardcoded "عادل" (fair) price
  // verdict under an "AI" label for every offer, unconditionally — no real
  // price-fairness computation exists anywhere in the backend
  // (ServiceCatalog has no such field). Removed rather than faked.
  it('never renders a fabricated "fair price" AI verdict, regardless of the real price', () => {
    component.model.set({
      id: 'svc-1', title: 'خدمة تجريبية', category: 'تصميم', status: 'PUBLISHED',
      totalAmount: 999999, totalDays: 3, aiScore: 80, rating: 4.5,
      provider: { id: 'p-1', name: 'مقدم الخدمة', initials: 'م' },
    } as any);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('عادل');
    expect(text).not.toContain('النطاق العادل');
  });
});
