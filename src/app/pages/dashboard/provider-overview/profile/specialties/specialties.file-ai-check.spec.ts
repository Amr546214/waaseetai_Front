import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Specialties } from './specialties';

// The accreditation-sample page reads every chosen file with the AI (model file and proofs), like the setup wizard: PASS shows the note, a refused model file is removed with the reason.
describe('Specialties sample files: AI reading', () => {
	let component: Specialties; let fixture: ComponentFixture<Specialties>; let verdict: any; let posts: any[];
	const sample = () => ({ id: 's1', subSpecialty: 'واجهات', title: 'متجر', description: 'وصف', technologies: [], technologiesInput: '', publicFile: null, publicFileName: null, proofFiles: [], proofFileNames: [] });
	const pick = (file: File) => ({ target: { files: [file], value: '' } } as any as Event);
	beforeEach(async () => {
		posts = [];
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({ imports: [Specialties], providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: (url: string, body: any) => { posts.push([url, body]); return String(url).includes('portfolio-file-check') ? of({ success: true, data: verdict }) : of({ success: true }); } } }] }).compileComponents();
		fixture = TestBed.createComponent(Specialties); component = fixture.componentInstance; fixture.detectChanges();
		component.samples.set([sample() as any]);
	});
	afterEach(() => vi.unstubAllGlobals());
	const settle = () => new Promise(r => setTimeout(r, 30));

	it('a model file the AI passes shows its note; the same for a proof (kind PROOF is sent)', async () => {
		verdict = { verdict: 'PASS', summaryAr: 'قرأ الذكاء الاصطناعي الملف وهو مناسب.' };
		await component.onPublicFileSelected(pick(new File(['hello'], 'model.pdf', { type: 'application/pdf' })), 's1'); await settle();
		expect(component.fileChecks()['m:s1']).toEqual({ status: 'valid', message: 'قرأ الذكاء الاصطناعي الملف وهو مناسب.' });
		await component.onProofFilesSelected(pick(new File(['hello'], 'proof.pdf', { type: 'application/pdf' })), 's1'); await settle();
		expect(component.fileChecks()['p:s1:proof.pdf']?.status).toBe('valid');
		expect(posts.filter(p => String(p[0]).includes('portfolio-file-check')).map(p => p[1].kind)).toEqual(['MODEL', 'PROOF']);
	});

	it('a model file the AI refuses is removed with the reason; an unavailable check keeps the file for the administration', async () => {
		verdict = { verdict: 'FAIL', summaryAr: 'ليس نموذج عمل.', recommendationsAr: ['ارفع مشروعًا فعليًا'] };
		await component.onPublicFileSelected(pick(new File(['x'], 'bad.pdf', { type: 'application/pdf' })), 's1'); await settle();
		expect(component.samples()[0].publicFile).toBeNull();
		expect(component.fileChecks()['m:s1']?.status).toBe('refused'); expect(component.fileChecks()['m:s1']?.message).toContain('ارفع ملفًا آخر');
		verdict = { verdict: 'UNVERIFIED', summaryAr: 'تعذّر الفحص الآلي حاليًا؛ ستراجعه الإدارة.' };
		await component.onPublicFileSelected(pick(new File(['x'], 'ok.pdf', { type: 'application/pdf' })), 's1'); await settle();
		expect(component.samples()[0].publicFile).not.toBeNull(); expect(component.fileChecks()['m:s1']?.status).toBe('warning');
	});

	it('removing a proof clears its note; the «تحسين الصياغة» button is the AI purple with the icon beside its text', async () => {
		verdict = { verdict: 'PASS', summaryAr: 'ok' };
		await component.onProofFilesSelected(pick(new File(['x'], 'p.pdf', { type: 'application/pdf' })), 's1'); await settle();
		component.removeProofFile('s1', 0);
		expect(component.fileChecks()['p:s1:p.pdf']).toBeUndefined();
		component.providerSpecialtyId.set('ps-1'); component.selectedSubs.set(new Set(['واجهات'])); component.samples.set([sample() as any]); component.currentStep.set(2); fixture.detectChanges();
		const btn = fixture.nativeElement.querySelector('[data-testid="improve-sample"]') as HTMLElement;
		expect(btn).toBeTruthy(); expect(btn.className).toContain('inline-flex'); expect(btn.getAttribute('style')).toContain('#C9A5F0');
		expect(btn.querySelector('svg[data-ws-ai-mark]')).toBeTruthy(); expect(btn.firstElementChild!.tagName.toLowerCase()).toBe('svg');
	});

	it('links: a model/proof URL is validated, AI-checked (text/uri-list) and counts as attached; the tools box suggests from the specialty skills', async () => {
		verdict = { verdict: 'PASS', summaryAr: 'الرابط مناسب' };
		component.addModelLink('s1', 'http://insecure.example.com'); expect(component.linkErrors()['ml:s1']).toBeTruthy(); expect(component.samples()[0].publicLink).toBeUndefined();
		component.addModelLink('s1', 'https://github.com/acme/shop'); await settle();
		expect(component.samples()[0].publicLink).toBe('https://github.com/acme/shop'); expect(component.hasModel(component.samples()[0])).toBe(true);
		expect(component.fileChecks()['m:s1']?.status).toBe('valid');
		component.addProofLink('s1', 'https://github.com/acme/shop/commits'); await settle();
		expect(component.hasProof(component.samples()[0])).toBe(true);
		expect(posts.filter(p => String(p[0]).includes('portfolio-file-check')).every(p => p[1].mimeType === 'text/uri-list')).toBe(true);
		component.skillPool.set(['React', 'Redux', 'Figma']);
		component.updateTechnologies('s1', 'Vue, re');
		expect(component.techSuggestions(component.samples()[0])).toEqual(['React', 'Redux']);
		component.pickTechnology('s1', 'React');
		expect(component.samples()[0].technologies).toEqual(['Vue', 'React']);
	});
});
