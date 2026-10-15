import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
(globalThis as any).__socketIoModule = () => ({ default: () => fakeSocket, io: () => fakeSocket });

import { Specialties } from './specialties';

const file = (name: string, type = 'application/pdf') => new File(['x'], name, { type });
const sample = (over: any = {}) => ({
	id: 's1', subSpecialty: 'واجهات', title: 'متجر إلكتروني', description: 'وصف تقني مفصل للنموذج يتجاوز عشرين حرفاً', technologies: ['Angular'], technologiesInput: 'Angular',
	publicFile: file('public.pdf'), publicFileName: 'public.pdf', proofFiles: [file('proof.pdf')], proofFileNames: ['proof.pdf'], isUploading: false, ...over,
});

describe('Specialties wizard: Batch B field errors, generic errors, one request', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let post: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (sel: string) => el().querySelector<HTMLElement>(sel)!;
	const render = () => fixture.detectChanges();

	beforeEach(async () => {
		(Element.prototype as any).scrollIntoView = vi.fn();
		post = vi.fn(() => of({ success: true }));
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => post(...a) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		document.body.appendChild(el());
		fixture.detectChanges();
	});
	afterEach(() => { el().remove(); fixture.destroy(); vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	describe('step 1', () => {
		it('next with nothing chosen: the grid is marked (aria-invalid, role=alert) and focused; nothing is sent', async () => {
			component.currentStep.set(1); render();
			q('[data-testid="next-btn"]').click(); await settleForm(); render();
			expectFieldProblem(q('#spec-grid'), 'اختر التخصص الرئيسي');
			expectFocused(q('#spec-grid'));
			expect(post).not.toHaveBeenCalled();
		});

		it('the free-text specialty shorter than 5 characters is explained at its own input', async () => {
			component.selectedSpecId.set('other'); component.otherText.set('ab'); render();
			q('[data-testid="next-btn"]').click(); await settleForm(); render();
			expectFieldProblem(q('#spec-other-text'), '5 أحرف');
			expectFocused(q('#spec-other-text'));
		});

		it('a double click sends ONE selectSpecialty request', () => {
			const pending = new Subject<any>();
			post.mockReturnValue(pending);
			component.selectedSpecId.set('other'); component.otherText.set('تخصص مقترح'); render();
			const btn = q('[data-testid="next-btn"]');
			btn.click(); btn.click();
			expect(post).toHaveBeenCalledTimes(1);
			pending.next({ success: true, data: { id: 'ps1' } }); pending.complete();
		});

		it('a 400 naming customName lands on the input; 429 marks nothing', async () => {
			component.selectedSpecId.set('other'); component.otherText.set('تخصص مقترح'); render();
			post.mockReturnValue(throwError(() => httpFail(400, { errors: [{ field: 'customName', message: 'الاسم مستخدم' }] })));
			component.nextStep(); await settleForm(); render();
			expectFieldProblem(q('#spec-other-text'), 'الاسم مستخدم');
			expect(component.otherText()).toBe('تخصص مقترح');
			component.otherText.set('تخصص مقترح 2'); render();
			post.mockReturnValue(throwError(() => httpFail(429, { message: 'Too many requests' })));
			component.nextStep(); await settleForm(); render();
			expect(document.querySelectorAll('.ws-field-msg').length).toBe(0);
			expect(component.stepError()).toBeTruthy();
		});
	});

	describe('step 2', () => {
		const atStep2 = (over: any = {}) => {
			component.selectedSubs.set(new Set(['واجهات']));
			component.providerSpecialtyId.set('ps-1');
			component.currentStep.set(2);
			component.samples.set([sample(over)]);
			render();
		};

		it('missing technologies / files: each is marked at its own control and the FIRST one in page order has focus', async () => {
			atStep2({ technologies: [], technologiesInput: '', publicFile: null, publicFileName: null, proofFiles: [], proofFileNames: [] });
			q('[data-testid="next-btn"]').click(); await settleForm(); render();
			expectFieldProblem(q('#sample-tech-s1'), 'تقنية');
			expectFieldProblem(q('#sample-public-s1'), 'الملف العام');
			expectFieldProblem(q('#sample-proof-s1'), 'إثبات');
			expectFocused(q('#sample-tech-s1'));
			expect(post).not.toHaveBeenCalled();
		});

		it('a short description: the existing message is wired (aria-invalid + describedby) and the field has focus', async () => {
			atStep2({ description: 'قصير' });
			q('[data-testid="next-btn"]').click(); await settleForm(); render();
			const ta = q('#sample-desc-s1');
			expect(ta.getAttribute('aria-invalid')).toBe('true');
			expect(document.getElementById(ta.getAttribute('aria-describedby')!)!.getAttribute('role')).toBe('alert');
			expectFocused(ta);
		});

		it('a double click on the upload sends ONE request', () => {
			const pending = new Subject<any>();
			post.mockReturnValue(pending);
			atStep2();
			const btn = q('[data-testid="next-btn"]');
			btn.click(); btn.click();
			expect(post.mock.calls.filter(c => String(c[0]).includes('submit-proof')).length).toBe(1);
			pending.complete();
		});

		it('a 400 naming sampleTitle_0 lands on the title input; 429 and a network failure mark nothing', async () => {
			atStep2();
			post.mockReturnValue(throwError(() => httpFail(400, { errors: [{ field: 'sampleTitle_0', message: 'العنوان مكرر' }] })));
			component.nextStep(); await settleForm(); render();
			expectFieldProblem(q('#sample-title-s1'), 'العنوان مكرر');
			expect(component.currentStep()).toBe(2);
			for (const status of [429, 0]) {
				q('#sample-title-s1').dispatchEvent(new Event('input'));
				post.mockReturnValue(throwError(() => httpFail(status, { message: 'x' })));
				component.nextStep(); await settleForm(); render();
				expect(document.querySelectorAll('.ws-field-msg').length, String(status)).toBe(0);
				expect(component.stepError(), String(status)).toBeTruthy();
			}
			expectNoFieldProblem(el());
		});
	});

	describe('section 6: no ready-made numbers', () => {
		it('no input of the wizard has a numeric value or placeholder', () => {
			component.selectedSpecId.set('other'); render();
			for (const i of Array.from(el().querySelectorAll<HTMLInputElement>('input[type="text"], input[type="search"], textarea'))) {
				expect(i.placeholder, i.outerHTML.slice(0, 80)).not.toMatch(/\d/);
				expect(i.value).not.toMatch(/\d/);
			}
		});
	});
});
