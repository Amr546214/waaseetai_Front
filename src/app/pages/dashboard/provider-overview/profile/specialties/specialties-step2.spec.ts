import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AUD-FND-000059 — the specialty wizard's step 2 → 3 button. It uploads the samples to POST /provider/specialties/submit-proof (the route
// whose field names the wizard uses: providerSpecialtyId, sampleCount, sampleTitle_i, sampleDescription_i, sampleTechnologies_i, subSpecialty_i,
// publicSample_i, proofFiles_i). Nothing is ever sent with an invented id, and a failed upload never advances to step 3.
const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { Specialties } from './specialties';

const file = (name: string, type = 'application/pdf') => new File(['x'], name, { type });
const validSample = (over: any = {}) => ({
	id: 's1', subSpecialty: 'واجهات', title: 'متجر إلكتروني', description: 'وصف تقني مفصل للنموذج يتجاوز عشرين حرفاً', technologies: ['Angular'], technologiesInput: 'Angular',
	publicFile: file('public.pdf'), publicFileName: 'public.pdf', proofFiles: [file('proof.pdf')], proofFileNames: ['proof.pdf'], isUploading: false, ...over,
});

describe('Specialties wizard — step 2 upload (AUD-FND-000059)', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	beforeEach(async () => {
		postSpy = vi.fn(() => of({ success: true }));
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => postSpy(...a) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	afterEach(() => vi.unstubAllGlobals());

	function atStep2(over: any = {}, id: string | null = 'ps-real-1') {
		component.providerSpecialtyId.set(id);
		component.currentStep.set(2);
		component.samples.set([validSample(over)]);
	}

	it('step 2 → 3: with valid samples the click POSTs submit-proof with the fields the backend reads and moves to step 3 on success', () => {
		atStep2();
		expect(component.canProceedToStep3()).toBe(true);
		component.nextStep();
		const call = postSpy.mock.calls.find(c => String(c[0]).includes('/provider/specialties/submit-proof'));
		expect(call).toBeTruthy();
		const fd = call![1] as FormData;
		expect(fd.get('providerSpecialtyId')).toBe('ps-real-1');
		expect(fd.get('sampleCount')).toBe('1');
		expect(fd.get('sampleTitle_0')).toBe('متجر إلكتروني');
		expect(fd.get('sampleDescription_0')).toContain('وصف تقني');
		expect(JSON.parse(String(fd.get('sampleTechnologies_0')))).toEqual(['Angular']);
		expect(fd.get('subSpecialty_0')).toBe('واجهات');
		expect((fd.get('publicSample_0') as File).name).toBe('public.pdf');
		expect((fd.getAll('proofFiles_0')[0] as File).name).toBe('proof.pdf');
	});

	it('no providerSpecialtyId: NOTHING is sent (no demo id) and a clear error is shown; the step does not advance', () => {
		atStep2({}, null);
		component.nextStep();
		expect(postSpy).not.toHaveBeenCalled();
		expect(component.stepError()).toContain('تعذّر تحديد التخصص');
		expect(component.currentStep()).toBe(2);
	});

	it('a failed upload does NOT advance to step 3 and says nothing was saved (no silent success)', () => {
		postSpy.mockImplementation(() => throwError(() => ({ error: { message: 'خطأ من الخادم' } })));
		atStep2();
		component.nextStep();
		expect(component.currentStep()).toBe(2);
		expect(component.isSubmittingSamples()).toBe(false);
		expect(component.stepError()).toBe('خطأ من الخادم');
		expect(postSpy.mock.calls.filter(c => String(c[0]).includes('step2-upload')).length).toBe(0);
	});

	it('step 1 without a server id stays on step 1 with an error and never stores an invented id', () => {
		postSpy.mockImplementation(() => of({ success: false }));
		component.selectedSpecId.set('tech');
		component.selectedSubs.set(new Set(['واجهات']));
		component.nextStep();
		expect(component.providerSpecialtyId()).toBeNull();
		expect(component.currentStep()).toBe(1);
		expect(component.stepError()).toContain('تعذّر تحديد التخصص');
		postSpy.mockImplementation(() => throwError(() => ({ status: 500 })));
		component.nextStep();
		expect(component.providerSpecialtyId()).toBeNull();
		expect(component.currentStep()).toBe(1);
	});

	it('step 1 with a real server id moves to step 2 and keeps that id', () => {
		postSpy.mockImplementation(() => of({ success: true, data: { id: 'ps-real-9' } }));
		component.selectedSpecId.set('tech');
		component.selectedSubs.set(new Set(['واجهات']));
		component.nextStep();
		expect(component.providerSpecialtyId()).toBe('ps-real-9');
		expect(component.currentStep()).toBe(2);
	});

	it('a disabled step-2 button always has a visible reason (first unmet requirement)', () => {
		atStep2({ description: 'قصير' });
		expect(component.canProceedToStep3()).toBe(false);
		expect(component.step2Blocker()).toContain('الوصف 20 حرفاً على الأقل');
		component.samples.set([validSample({ publicFile: null })]);
		expect(component.step2Blocker()).toContain('ارفع الملف العام');
		component.samples.set([validSample({ proofFiles: [] })]);
		expect(component.step2Blocker()).toContain('ملف إثبات');
		component.samples.set([validSample({ technologies: [] })]);
		expect(component.step2Blocker()).toContain('تقنية');
		component.samples.set([validSample()]);
		expect(component.step2Blocker()).toBeNull();
	});

	it('the demo id is gone from the source (static): no "demo-spec-uuid" anywhere in specialties.ts', () => {
		const src = readFileSync(join(__dirname, 'specialties.ts'), 'utf-8');
		expect(src).not.toContain('demo-spec-uuid');
		expect(src).not.toMatch(/providerSpecialtyId\(\)\s*\|\|\s*'/);
	});
});
