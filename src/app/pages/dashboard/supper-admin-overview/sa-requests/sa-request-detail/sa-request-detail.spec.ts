import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaRequestDetail } from './sa-request-detail';

const person = { userId: 'u1', name: 'عميل', email: 'a@b.c', accountType: 'CLIENT', memberSince: '2026-01-01', rating: null, completedProjects: 0 };
const detail = (o: any = {}) => ({
  success: true,
  data: { id: 'r1', title: 'طلب', description: 'وصف', status: 'OPEN', projectStatus: null, specialty: 'ت', subSpecialties: [], requiredSkills: [], budget: { type: 'FIXED', min: 100, max: null, currency: 'USD' }, durationDays: null, conditions: null, attachmentsCount: 0, aiAnalysis: null, client: person, contract: null, escrow: null, offers: [], disputes: [], timeline: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o },
});
function make(res: any) {
  TestBed.configureTestingModule({
    imports: [SaRequestDetail],
    providers: [provideRouter([]), { provide: HttpClient, useValue: { get: vi.fn().mockReturnValue(res) } }, { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'r1' }) } }],
  });
  const f = TestBed.createComponent(SaRequestDetail);
  f.detectChanges();
  return f;
}

describe('SaRequestDetail (live)', () => {
  it('no AI panel, contract or dispute blocks when absent; honest empty states', () => {
    const t = make(of(detail())).nativeElement.textContent;
    expect(t).not.toContain('WaseetAI');
    expect(t).not.toContain('العقد والضمان');
    expect(t).not.toContain('النزاعات');
    expect(t).toContain('لا توجد عروض على هذا الطلب بعد');
    expect(t).toContain('لا توجد أحداث مسجلة');
  });

  it('renders AI panel, accepted offer, contract and disputes when present', () => {
    const t = make(of(detail({
      aiAnalysis: { source: 'WASEET_AI', summary: 'تحليل', complexity: null },
      offers: [{ id: 'o1', status: 'ACCEPTED', price: 10, deliveryDays: 2, aiMatchScore: null, aiQualityTag: null, aiPriceTag: null, createdAt: '2026-01-01T00:00:00Z', accepted: true, provider: person }],
      contract: { id: 'c1', status: 'ACTIVE', price: 10, durationDays: 2, clientSignedAt: null, providerSignedAt: null },
      disputes: [{ id: 'd1', reason: 'سبب', status: 'OPEN', createdAt: '2026-01-01T00:00:00Z' }],
    }))).nativeElement.textContent;
    expect(t).toContain('تحليل WaseetAI');
    expect(t).toContain('✓ المقبول');
    expect(t).toContain('فتح العقد');
    expect(t).toContain('سبب');
  });

  it('404 and error states', () => {
    expect(make(throwError(() => ({ status: 404 }))).componentInstance.notFound()).toBe(true);
  });
});
