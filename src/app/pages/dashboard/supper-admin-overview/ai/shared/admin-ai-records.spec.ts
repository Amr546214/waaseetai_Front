import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminAiRecords } from './admin-ai-records';

describe('admin AI records', () => {
  afterEach(() => TestBed.resetTestingModule());
  const setup = (kind: 'overview' | 'audit' | 'matching') => {
    TestBed.configureTestingModule({ imports: [AdminAiRecords], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(AdminAiRecords);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  };
  it('renders actual zero matching scores and does not label them model accuracy', () => {
    const { fixture, http } = setup('matching');
    http.expectOne(r => r.url.endsWith('/matching')).flush({ data: {
      count: 1, average: 0, hasNext: false, items: [{ id: 'p', at: '2026-11-01T00:00:00Z', score: 0, requestId: 'r' }],
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('الدرجة المسجلة: 0');
    expect(fixture.nativeElement.textContent).toContain('ليست نسبة دقة المحرك');
    http.verify();
  });
  it('cancels an older period request before reading the new period', () => {
    const { fixture, http } = setup('audit');
    const first = http.expectOne(r => r.params.get('days') === '30');
    fixture.componentInstance.setPeriod(7);
    expect(first.cancelled).toBe(true);
    http.expectOne(r => r.params.get('days') === '7').flush({ data: { items: [], hasNext: false } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('لا توجد سجلات');
    http.verify();
  });
  it('shows a failure and retries without substituting fake counts', () => {
    const { fixture, http } = setup('overview');
    http.expectOne(r => r.url.endsWith('/overview')).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    fixture.componentInstance.load();
    http.expectOne(r => r.url.endsWith('/overview')).flush({ data: {
      specialtyChecks: 0, recordedErrors: 0, recordedTokens: null, averageLatencyMs: null, accreditationChecks: 0, scoredOffers: 0, models: [],
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
    http.verify();
  });
});
