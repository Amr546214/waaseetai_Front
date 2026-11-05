import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DisputeModal } from './dispute-modal';

describe('DisputeModal server error', () => {
	function setup(errorMessage: string) {
		const fixture = TestBed.createComponent(DisputeModal);
		fixture.componentRef.setInput('open', true);
		fixture.componentRef.setInput('errorMessage', errorMessage);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('shows the server rejection message inside the dialog', () => {
		const el = setup('لا تملك صلاحية هذا الطلب');
		const box = el.querySelector('[role="dialog"] [data-testid="dispute-server-error"]');
		expect(box?.textContent?.trim()).toBe('لا تملك صلاحية هذا الطلب');
	});

	it('shows no server error block when there is none', () => {
		const el = setup('');
		expect(el.querySelector('[data-testid="dispute-server-error"]')).toBeNull();
	});
});

describe('DisputeModal stage dispute (case 2)', () => {
	const stages = [
		{ id: 's1', label: 'المرحلة 1: التصميم', canDispute: false, blockedReason: 'هذه المرحلة اعتُمدت وصُرفت دفعتها، ولا يُفتح عليها نزاع' },
		{ id: 's2', label: 'المرحلة 2: التطوير', canDispute: true, blockedReason: null },
		{ id: 's3', label: 'المرحلة 3: الاختبار', canDispute: false, blockedReason: 'هذه المرحلة لم تبدأ بعد، ولا يُفتح عليها نزاع' },
	];
	const LONG = 'ا'.repeat(100);
	function setup(extra: Record<string, unknown> = {}) {
		const fixture = TestBed.createComponent(DisputeModal);
		fixture.componentRef.setInput('stages', stages);
		for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
		fixture.componentRef.setInput('open', true);
		fixture.detectChanges();
		return { fixture, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
	}
	const fill = (cmp: DisputeModal, over: Partial<Record<'stage' | 'reason' | 'desc' | 'requested', string>> = {}) => {
		cmp.stageId.set(over.stage ?? 's2'); cmp.reason.set(over.reason ?? 'جودة التسليم لا تطابق العقد'); cmp.description.set(over.desc ?? LONG); cmp.requested.set((over.requested ?? 'REDELIVER_WITH_FIXES') as any);
	};

	it('lists every stage but only the server-eligible ones are selectable, with the reason on the others; a single eligible stage is preselected', () => {
		const { el, cmp } = setup();
		const options = Array.from(el.querySelectorAll('[data-testid="dispute-stage"] option')) as HTMLOptionElement[];
		expect(options.map((o) => o.disabled)).toEqual([false, true, false, true]);
		expect(options[1].textContent).toContain('غير متاحة');
		expect(options[1].title).toContain('اعتُمدت');
		expect(cmp.stageId()).toBe('s2');
		expect(el.querySelector('h3')?.textContent).toContain('فتح نزاع على المرحلة');
	});

	it('shows the live counter against the minimum (100 for a stage) and refuses a short description', () => {
		const { fixture, el, cmp } = setup();
		fill(cmp, { desc: 'وصف قصير' });
		fixture.detectChanges();
		expect(el.querySelector('[data-testid="dispute-counter"]')?.textContent?.trim()).toBe('8 / 100 حرف');
		let emitted = 0; cmp.submit.subscribe(() => emitted++);
		cmp.onSubmit(); fixture.detectChanges();
		expect(emitted).toBe(0);
		expect(cmp.descriptionError()).toContain('100');
	});

	it('requires a stage and a requested resolution; emits stage, reason, description, resolution, files and one submission key', () => {
		const { fixture, cmp } = setup({ presetStageId: null });
		const out: any[] = []; cmp.submit.subscribe((p) => out.push(p));
		cmp.stageId.set(''); cmp.reason.set('تأخّر في التسليم'); cmp.description.set(LONG);
		cmp.onSubmit(); expect(out.length).toBe(0); expect(cmp.stageError()).toContain('اختر المرحلة');
		fill(cmp, { requested: '' });
		cmp.onSubmit(); expect(out.length).toBe(0); expect(cmp.requestedError()).toContain('اختر الحل');
		fill(cmp);
		const file = new File([new Uint8Array([1, 2, 3])], 'proof.png', { type: 'image/png' });
		cmp.files.set([file]);
		cmp.onSubmit();
		expect(out.length).toBe(1);
		expect(out[0]).toMatchObject({ stageId: 's2', reason: 'جودة التسليم لا تطابق العقد', description: LONG, requestedResolution: 'REDELIVER_WITH_FIXES' });
		expect(out[0].files).toEqual([file]);
		expect(out[0].submissionKey).toMatch(/^[0-9a-f-]{36}$/);
		// the same content again (a retry) keeps the key; changed content gets a new one
		cmp.onSubmit(); expect(out[1].submissionKey).toBe(out[0].submissionKey);
		cmp.description.set(LONG + 'ب'); cmp.onSubmit(); expect(out[2].submissionKey).not.toBe(out[0].submissionKey);
		fixture.detectChanges();
	});

	it('the submit button is disabled while sending, so a double click cannot send twice', () => {
		const { fixture, el, cmp } = setup({ isSubmitting: true });
		fill(cmp); let n = 0; cmp.submit.subscribe(() => n++);
		cmp.onSubmit();
		expect(n).toBe(0);
		expect((el.querySelector('.lc-btn-danger') as HTMLButtonElement).disabled).toBe(true);
		fixture.detectChanges();
	});

	it('accepts only JPG/PNG/PDF, at most 5 files of 10 MB, and lets a file be removed', () => {
		const { cmp } = setup();
		const pick = (files: File[]) => cmp.onFilesPicked({ target: { files, value: 'x' } } as any);
		pick([new File([new Uint8Array([1])], 'a.svg', { type: 'image/svg+xml' })]);
		expect(cmp.files().length).toBe(0); expect(cmp.evidenceError()).toContain('JPG');
		pick(Array.from({ length: 6 }, (_, i) => new File([new Uint8Array([1])], `${i}.png`, { type: 'image/png' })));
		expect(cmp.files().length).toBe(0); expect(cmp.evidenceError()).toContain('خمسة');
		const big = new File([new Uint8Array([1])], 'big.pdf', { type: 'application/pdf' }); Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
		pick([big]); expect(cmp.files().length).toBe(0); expect(cmp.evidenceError()).toContain('10');
		pick([new File([new Uint8Array([1])], 'ok.pdf', { type: 'application/pdf' })]); expect(cmp.files().length).toBe(1);
		cmp.removeFile(0); expect(cmp.files().length).toBe(0);
	});

	it('server field errors appear under the matching field', () => {
		const { fixture, el } = setup();
		fixture.componentRef.setInput('fieldErrors', [{ field: 'stageId', message: 'هذه المرحلة اعتُمدت' }, { field: 'description', message: 'اشرح المشكلة بما لا يقل عن 100 حرف' }]);
		fixture.detectChanges();
		const messages = Array.from(el.querySelectorAll('[data-testid="field-error"]')).map((n) => n.textContent?.trim());
		expect(messages).toContain('هذه المرحلة اعتُمدت');
		expect(messages).toContain('اشرح المشكلة بما لا يقل عن 100 حرف');
	});

	it('a project with no stages keeps the project-level dialog: no stage field, minimum 10, no requested-resolution field', () => {
		const fixture = TestBed.createComponent(DisputeModal);
		fixture.componentRef.setInput('open', true);
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="dispute-stage"]')).toBeNull();
		expect(el.querySelector('[data-testid="dispute-requested"]')).toBeNull();
		expect(el.querySelector('h3')?.textContent).toContain('فتح نزاع على المشروع');
		expect(el.querySelector('[data-testid="dispute-counter"]')?.textContent?.trim()).toBe('0 / 10 حرف');
	});
});
