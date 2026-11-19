import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Center } from './center';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';

// The provider must see the AI rating of their OWN samples. A sample with no rating is evaluated automatically (once per visit), the card follows the
// server answer, and a failed attempt offers a button instead of leaving the card empty. Rejected samples are never evaluated.

const sample = (over: any = {}) => ({ id: 's1', title: 'نموذج', description: 'd', technologiesUsed: [], attachments: [], status: 'AI_VERIFIED', createdAt: '2026-01-01T00:00:00Z', ...over });

async function render(samples: any[], evaluate: (id: string) => any) {
  const api = { getAccreditationSamples: () => of({ success: true, samples }), evaluateAccreditationSample: vi.fn(evaluate) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ProviderApiService, useValue: api }] });
  const fixture = TestBed.createComponent(Center);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api };
}
afterEach(() => TestBed.resetTestingModule());

describe('provider models center: AI rating', () => {
  it('evaluates every unrated, non-rejected sample once and shows the rating and the average', async () => {
    const { el, api } = await render(
      [sample({ id: 'a' }), sample({ id: 'b', aiScore: 90, aiQualityRating: 'Excellent' }), sample({ id: 'c', status: 'REJECTED' })],
      (id) => of({ success: true, data: { updated: true, aiScore: 80, aiQualityRating: 'Good' } }),
    );
    expect(api.evaluateAccreditationSample).toHaveBeenCalledTimes(1);
    expect(api.evaluateAccreditationSample).toHaveBeenCalledWith('a');
    expect(el.textContent).toContain('تقييم AI: Good');
    expect(el.textContent).toContain('تقييم AI: Excellent');
  });

  it('a failed evaluation says so and offers a retry button; the button asks again for that sample only', async () => {
    let n = 0;
    const { fixture, el, api } = await render([sample({ id: 'a' })], () => (++n === 1 ? throwError(() => ({ status: 502 })) : of({ success: true, data: { updated: true, aiScore: 70, aiQualityRating: 'Good' } })));
    expect(el.textContent).toContain('تعذّر التقييم الآن');
    (el.querySelector('[data-testid="evaluate-sample"]') as HTMLButtonElement).click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(api.evaluateAccreditationSample).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('تقييم AI: Good');
  });

  it('an answer without a score (evidence unreadable) is reported, never shown as a rating', async () => {
    const { el } = await render([sample({ id: 'a' })], () => of({ success: true, data: { updated: false, aiScore: null } }));
    expect(el.textContent).toContain('تعذّر التقييم الآن');
    expect(el.textContent).not.toContain('تقييم AI:');
  });
});
