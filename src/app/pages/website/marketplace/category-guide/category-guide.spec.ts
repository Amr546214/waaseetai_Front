import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CategoryGuide } from './category-guide';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

// The category page's AI insight strip: "AI · نشط" only for a real Gemini answer; a deterministic list is "دون AI" and is the
// most-viewed list (not "most requested"); a top-level response (no `data` wrapper) is read like a wrapped one.
describe('CategoryGuide AI insight honesty', () => {
  let fixture: ComponentFixture<CategoryGuide>;
  let component: CategoryGuide;

  const setup = (recsResponse: any) => {
    TestBed.configureTestingModule({
      imports: [CategoryGuide],
      providers: [
        provideRouter([]),
        { provide: MarketplaceService, useValue: {
          getCategories: () => of({ success: true, data: { categories: [], totalModelsCount: 0 } }),
          getAiRecommendations: vi.fn(() => of(recsResponse)),
        } },
      ],
    });
    fixture = TestBed.createComponent(CategoryGuide);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('a deterministic answer (wrapped) is "دون AI" and labelled most-viewed, never "AI · نشط" / "ذكي · نشط" / "الأعلى طلباً"', () => {
    setup({ data: { generationSource: 'DETERMINISTIC', recommendations: [{ id: 'm1', title: 'نموذج أ' }], bannerInsight: 'تم استرجاع 1 نموذج' } });
    expect(component.aiGenerationSource()).toBe('DETERMINISTIC');
    expect(text()).toContain('دون AI');
    expect(text()).toContain('الأكثر مشاهدة الآن');
    expect(text()).not.toContain('AI · نشط');
    expect(text()).not.toContain('ذكي · نشط');
    expect(text()).not.toContain('الأعلى طلباً');
    expect(text()).not.toContain('اقتراحات الذكاء الاصطناعي:');
    expect(text()).not.toContain('توصيات الذكاء الاصطناعي');
  });

  it('a deterministic answer does not keep the "توصيات الذكاء الاصطناعي" header', () => {
    setup({ data: { generationSource: 'DETERMINISTIC', recommendations: [{ id: 'm1', title: 'نموذج أ' }] } });
    expect(text()).not.toContain('توصيات الذكاء الاصطناعي');
    expect(text()).toContain('الخدمات الأكثر مشاهدة');
  });

  it('a Gemini answer is shown as AI', () => {
    setup({ data: { generationSource: 'GEMINI', recommendations: [{ id: 'm1', title: 'نموذج أ' }], bannerInsight: 'جملة' } });
    expect(text()).toContain('توصيات الذكاء الاصطناعي');
    expect(component.aiGenerationSource()).toBe('GEMINI');
    expect(text()).toContain('AI · نشط');
    expect(text()).toContain('اقتراحات الذكاء الاصطناعي:');
    expect(text()).not.toContain('دون AI');
  });

  it('a TOP-LEVEL Gemini answer is read the same way (source, picks and bannerInsight)', () => {
    setup({ generationSource: 'GEMINI', recommendations: [{ id: 'm1', title: 'نموذج علوي' }], bannerInsight: 'جملة علوية' });
    expect(component.aiGenerationSource()).toBe('GEMINI');
    expect(component.aiTopPicks()).toEqual([{ id: 'm1', title: 'نموذج علوي' }]);
    expect(text()).toContain('نموذج علوي');
  });

  it('a top-level DETERMINISTIC answer is not shown as AI, and its bannerInsight is used when there are no picks', () => {
    setup({ generationSource: 'DETERMINISTIC', recommendations: [], bannerInsight: 'لا توجد نماذج منشورة مطابقة للبحث الحالي.' });
    expect(component.aiGenerationSource()).toBe('DETERMINISTIC');
    expect(text()).toContain('دون AI');
    expect(text()).toContain('لا توجد نماذج منشورة مطابقة للبحث الحالي.');
  });

  it('the default banner no longer claims AI recommendations are "continuously updated from request activity"', () => {
    setup({ data: { generationSource: 'DETERMINISTIC', recommendations: [] } });
    expect(component.aiBannerInsight()).not.toContain('تُحدَّث باستمرار');
  });
});
