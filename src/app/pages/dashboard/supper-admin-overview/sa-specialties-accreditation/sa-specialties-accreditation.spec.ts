import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaSpecialtiesAccreditation } from './sa-specialties-accreditation';
import { SaSpecialtyAccreditationDetail } from './sa-specialty-accreditation-detail/sa-specialty-accreditation-detail';
import { parseAiFeedback, toTextList } from './sa-specialties-accreditation.data';

const item = (over: any = {}) => ({
	id: 'ps-1', status: 'UNDER_AI_REVIEW', specialty: { id: 's1', nameAr: 'موشن جرافيك' }, subSpecialties: [],
	provider: { userId: 'u-9', name: 'سارة', email: 's@x.com', rating: 4.5, completedProjects: 3 },
	scores: { aiScore: null, quizScore: 70, latestScore: 70, ownershipCredibility: null }, accreditationSamples: 2, workSamples: 1,
	badgeGrantedAt: null, submittedAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', ...over,
});
const listRes = (items: any[]) => ({ success: true, data: { items, pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 }, counts: { pending: items.length, approved: 4, rejected: 1, all: 5 + items.length } } });

describe('SaSpecialtiesAccreditation (list)', () => {
	let fixture: ComponentFixture<SaSpecialtiesAccreditation>; let component: SaSpecialtiesAccreditation;
	let get: ReturnType<typeof vi.fn>; let post: ReturnType<typeof vi.fn>;
	const text = () => fixture.nativeElement.textContent as string;
	async function setup(items: any[] = [item()]) {
		get = vi.fn(() => of(listRes(items))); post = vi.fn(() => of({ success: true, data: {} }));
		await TestBed.configureTestingModule({ imports: [SaSpecialtiesAccreditation], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } }] }).compileComponents();
		fixture = TestBed.createComponent(SaSpecialtiesAccreditation); component = fixture.componentInstance; fixture.detectChanges();
	}
	afterEach(() => TestBed.resetTestingModule());

	it('reads the real list (pending tab, server counts) and shows no invented KPI', async () => {
		await setup();
		expect(String(get.mock.calls[0][0])).toContain('/admin/accreditation/specialties');
		expect(get.mock.calls[0][1].params.get('status')).toBe('pending');
		expect(component.items().length).toBe(1);
		expect(text()).not.toContain('3.4');
		expect(text()).toContain('إجمالي ما صدر فيه قرار');
		expect(component.decidedTotal()).toBe(5);
	});

	it('AI score is shown only when stored', async () => {
		await setup([item({ scores: { aiScore: 82, quizScore: null, latestScore: null, ownershipCredibility: null } })]);
		expect(fixture.nativeElement.querySelector('[data-testid="ai-score"]').textContent).toContain('82%');
		TestBed.resetTestingModule();
		await setup([item()]);
		expect(fixture.nativeElement.querySelector('[data-testid="ai-score"]')).toBeNull();
	});

	it('the bulk auto-approve button is disabled and states why; clicking nothing posts', async () => {
		await setup();
		const btn = fixture.nativeElement.querySelector('[data-testid="bulk-approve"]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('[data-testid="bulk-reason"]').textContent).toContain('الاعتماد قرار إداري فردي ويتطلب سببًا مكتوبًا لكل طلب');
		expect(post).not.toHaveBeenCalled();
	});

	it('quick accept opens the confirmation; the reason is required (>=5) before POST /decision', async () => {
		await setup();
		component.openDecision(component.items()[0], 'APPROVED'); fixture.detectChanges();
		const confirm = () => fixture.nativeElement.querySelector('[data-testid="decision-confirm"]') as HTMLButtonElement;
		expect(confirm().disabled).toBe(true);
		const ta = fixture.nativeElement.querySelector('[data-testid="decision-reason"]') as HTMLTextAreaElement;
		ta.value = 'abcd'; ta.dispatchEvent(new Event('input')); fixture.detectChanges();
		expect(confirm().disabled).toBe(true);
		ta.value = 'ملف قوي ومطابق'; ta.dispatchEvent(new Event('input')); fixture.detectChanges();
		expect(confirm().disabled).toBe(false);
		confirm().click(); fixture.detectChanges();
		expect(String(post.mock.calls[0][0])).toContain('/admin/accreditation/specialties/ps-1/decision');
		expect(post.mock.calls[0][1]).toEqual({ decision: 'APPROVED', reason: 'ملف قوي ومطابق' });
		expect(component.toast()).toContain('إشعار');
		expect(get.mock.calls.length).toBeGreaterThan(1);
	});

	it('a failed decision shows the backend message and keeps the modal', async () => {
		await setup(); post.mockReturnValueOnce(throwError(() => ({ status: 409, error: { message: 'تمت معالجة هذا التخصص مسبقاً' } })));
		component.openDecision(component.items()[0], 'REJECTED'); component.confirmDecision('سبب كافٍ للرفض');
		expect(component.decisionError()).toBe('تمت معالجة هذا التخصص مسبقاً');
		expect(component.decisionTarget()).not.toBeNull();
		expect(component.deciding()).toBe(false);
	});

	it('decided rows have no quick actions', async () => {
		await setup([item({ status: 'APPROVED' })]);
		expect(fixture.nativeElement.querySelector('[data-testid="quick-accept"]')).toBeNull();
	});
});

describe('SaSpecialtyAccreditationDetail', () => {
	const detail = (over: any = {}) => ({
		...item(), assessmentTaken: true, assessmentPassed: false, aiFeedback: { summary: 'ملخص مخزّن', strengths: ['قوة'], warnings: ['تحذير'], corrections: [] },
		provider: { ...item().provider, yearsOfExperience: 4 }, scores: { aiScore: 61, quizScore: 70, latestScore: 70, ownershipCredibility: null, feasibilityScore: null, clarityScore: null },
		accreditationSamples: [{ id: 'a1', title: 'نموذج', description: 'وصف', attachments: ['private/1', 'private/2'], projectUrl: 'https://e.com', githubUrl: null }],
		workSamples: [{ id: 'w1', title: 'عمل', technologies: ['x'], publicSampleUrl: 'https://pub.example.com/a.png' }],
		otherPending: [{ id: 'ps-2', specialty: 'تصميم', status: 'UNDER_AI_REVIEW' }], decisions: [{ id: 'd1', title: 'رفض تخصص من الإدارة', summary: 'سبب', status: 'REJECTED', occurredAt: '2026-09-01T10:00:00Z' }], ...over,
	});
	async function render(d: any, post: any = vi.fn(() => of({ success: true, data: {} }))) {
		TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'x/:id', component: SaSpecialtyAccreditationDetail }]), { provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: d })), post } }] });
		const h = await RouterTestingHarness.create(); const c = await h.navigateByUrl('/x/ps-1', SaSpecialtyAccreditationDetail); h.detectChanges();
		return { h, c, el: h.routeNativeElement as HTMLElement, post };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('renders real data: provider link, stored AI labelled, samples (attachment count only), other pending, past decisions', async () => {
		const { el } = await render(detail());
		expect(el.querySelector('[data-testid="provider-link"]')!.getAttribute('href')).toContain('/users/u-9');
		expect(el.querySelector('[data-testid="ai-panel"]')!.textContent).toContain('تقييم AI المخزّن');
		expect(el.querySelector('[data-testid="ai-panel"]')!.textContent).toContain('ملخص مخزّن');
		expect(el.querySelector('[data-testid="acc-sample"]')!.textContent).toContain('2 مرفق');
		expect(el.querySelector('[data-testid="acc-sample"]')!.innerHTML).not.toContain('private/1');
		expect(el.querySelector('[data-testid="work-sample"] a')!.getAttribute('href')).toBe('https://pub.example.com/a.png');
		expect(el.querySelector('[data-testid="past-decision"]')!.textContent).toContain('رفض تخصص من الإدارة');
		expect(el.textContent).toContain('تصميم');
	});

	it('no AI panel when nothing is stored', async () => {
		const { el } = await render(detail({ aiFeedback: null, scores: { aiScore: null, quizScore: null, latestScore: null, ownershipCredibility: null } }));
		expect(el.querySelector('[data-testid="ai-panel"]')).toBeNull();
		expect(el.querySelector('[data-testid="no-ai"]')).not.toBeNull();
	});

	it('decision requires a >=5 char reason and posts decision + reason', async () => {
		const { c, post } = await render(detail());
		c.openDecision('REJECTED'); c.confirmDecision('ناقص الأدلة');
		expect(post.mock.calls[0][1]).toEqual({ decision: 'REJECTED', reason: 'ناقص الأدلة' });
		expect(c.toast()).toContain('إشعار');
	});

	it('already-decided specialties show no decision buttons', async () => {
		const { el } = await render(detail({ status: 'APPROVED' }));
		expect(el.querySelector('[data-testid="approve-btn"]')).toBeNull();
	});
});

describe('specialty review helpers', () => {
	it('parses stored feedback defensively', () => {
		expect(parseAiFeedback(null)).toBeNull();
		expect(parseAiFeedback({})).toBeNull();
		expect(parseAiFeedback({ summary: 's', strengths: [{ text: 'a' }, 'b'] })!.strengths).toEqual(['a', 'b']);
		expect(toTextList('x')).toEqual(['x']);
	});
});
