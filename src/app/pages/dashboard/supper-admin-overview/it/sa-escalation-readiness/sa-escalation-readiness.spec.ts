import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { SaEscalationReadiness } from './sa-escalation-readiness';

const isEsc = (r: { url: string }) => r.url.endsWith('/admin/system-settings/escalation-readiness');
const body = (over: Record<string, unknown> = {}) => ({ success: true, data: {
  readAt: '2026-11-09T09:00:00Z', automaticEscalation: 'closed', enabled: false, schedulerRunning: false, summary: 'التصعيد الآلي مقفول', statement: 'لا يُسند شيء ولا يُرسل أي إشعار من هذه الصفحة؛ هذه قراءة فقط.', ready: false, source: 's',
  supportPermissions: ['support.review', 'support.reply'], disputePermissions: ['disputes.view', 'disputes.resolve'],
  preconditions: [{ key: 'support_owner', label: 'مسؤول تذاكر الدعم معرّف', met: false, detail: 'غير معرّف (SUPPORT_SLA_TARGET_ADMIN_ID)' }, { key: 'start_date', label: 'تاريخ بدء الاحتساب (UTC) محدد', met: true, detail: 'محدد' }],
  assignees: { support: { state: 'LACKS_PERMISSION', reason: 'لا يملك الصلاحية: support.reply', missingPermissions: ['support.reply'] }, disputes: { state: 'MISSING', reason: 'لم يُحدَّد مسؤول', missingPermissions: [] } },
  startDate: { valid: false, utc: null },
  rules: { supportFirstReply: { source: 'default', hours: { low: 48, normal: 24, high: 8, urgent: 2 }, note: 'x' }, disputes: { hours: 168, fixed: true, note: 'ثابتة في الكود ولا تتغير بحسب الأولوية' } },
  decisions: ['support_assignee', 'disputes_assignee', 'hours', 'start_date', 'disputes_168', 'open_at_all'].map(key => ({ key, label: `Q-${key}`, status: 'open' })), ...over } });
function mount() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SaEscalationReadiness); const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges(); return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('escalation readiness screen', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says it is closed, shows what is missing, per-assignee reasons, the current rules (defaults vs fixed 168 h), the open decisions, last-read time, and has NO enabling control', () => {
    const { fixture, http, el } = mount(); http.expectOne(isEsc).flush(body()); fixture.detectChanges();
    expect(el.querySelector('[data-testid="escalation-state"]')?.textContent).toContain('التصعيد الآلي مقفول');
    expect(el.querySelector('[data-testid="escalation-statement"]')?.textContent).toContain('لا يُسند شيء ولا يُرسل أي إشعار');
    expect(el.querySelector('li[data-key="support_owner"]')?.textContent).toContain('ناقص');
    expect(el.querySelector('li[data-key="start_date"]')?.textContent).toContain('متحقق');
    expect(el.querySelector('[data-testid="assignee-support"]')?.textContent).toContain('support.reply');
    expect(el.querySelector('[data-testid="assignee-support"]')?.getAttribute('data-state')).toBe('LACKS_PERMISSION');
    expect(el.querySelector('[data-testid="assignee-disputes"]')?.textContent).toContain('لم يُحدَّد');
    expect(el.querySelector('[data-testid="rule-support"]')?.textContent).toMatch(/منخفضة 48.*عادية 24.*عالية 8.*عاجلة 2/);
    expect(el.querySelector('[data-testid="rule-support"]')?.textContent).toContain('الافتراضية');
    expect(el.querySelector('[data-testid="rule-disputes"]')?.textContent).toContain('168');
    expect(el.querySelector('[data-testid="rule-start"]')?.textContent).toContain('غير محدد');
    const dec = el.querySelectorAll('[data-testid="decisions"] li'); expect(dec.length).toBe(6); dec.forEach(d => expect(d.textContent).toContain('مفتوح'));
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09T09:00:00Z');
    const labels = Array.from(el.querySelectorAll('button')).map(b => b.textContent!.trim());
    expect(labels).toEqual(['تحديث القراءة']); expect(el.querySelectorAll('a[href], input, select').length).toBe(1);
    http.verify();
  });

  it('error shows retry that recovers; a 403 says the permission is missing', () => {
    const { fixture, http, el } = mount(); http.expectOne(isEsc).flush({}, { status: 500, statusText: 'x' }); fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('تعذّر قراءة جاهزية التصعيد');
    (el.querySelector('[data-testid="retry"]') as HTMLButtonElement).click(); http.expectOne(isEsc).flush(body()); fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull(); expect(el.querySelector('[data-testid="escalation-state"]')).not.toBeNull();
    (el.querySelector('.monitoring-actions button') as HTMLButtonElement).click(); http.expectOne(isEsc).flush({}, { status: 403, statusText: 'x' }); fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ليست لديك صلاحية');
    http.verify();
  });

  it('invalid hours and a configured-on state are stated plainly, never offered as an action', () => {
    const { fixture, http, el } = mount();
    http.expectOne(isEsc).flush(body({ automaticEscalation: 'configured_on', enabled: true, summary: 'التصعيد الآلي مفعّل بإعدادات الخادم (لا يمكن تغييره من هذه الصفحة)', rules: { supportFirstReply: { source: 'invalid', hours: { low: 48, normal: 24, high: 8, urgent: 2 }, note: 'x' }, disputes: { hours: 168, fixed: true, note: 'n' } } }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="escalation-state"]')?.textContent).toContain('لا يمكن تغييره من هذه الصفحة');
    expect(el.querySelector('[data-testid="rule-support"]')?.textContent).toContain('غير صالح');
    expect(el.querySelectorAll('button').length).toBe(1);
    http.verify();
  });
});
