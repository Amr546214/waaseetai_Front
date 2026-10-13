import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FinalApproval } from './final-approval';

// The page is a SUMMARY: it never finalizes, never claims to release money, never promises ownership / warranty / one-shot payment.
const WS = (statuses: string[]) => ({ success: true, data: { title: 'مشروع', price: 1000, providerName: 'نورة', stages: statuses.map((s, i) => ({ id: `s${i}`, title: `مرحلة ${i + 1}`, status: s, amount: 250, threads: [] })) } });

describe('final approval page is now an achievement summary', () => {
	async function setup(ws: any) {
		const post = vi.fn(() => of({ success: true }));
		await TestBed.configureTestingModule({ imports: [FinalApproval], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of(ws), post } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(FinalApproval); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, post, nav, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('all stages completed: «ملخص الإنجاز», a single «متابعة للتقييم» action that only navigates (no request at all)', async () => {
		const s = await setup(WS(['completed', 'completed', 'completed', 'completed']));
		expect(s.text()).toContain('ملخص الإنجاز');
		expect(s.q('fa-badge')!.textContent).toContain('اكتملت كل المراحل');
		expect(s.q('fa-continue-rating')!.textContent).toContain('متابعة للتقييم');
		s.q('fa-continue-rating')!.click();
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/projects', 'proj-1', 'rating']);
		expect(s.post).not.toHaveBeenCalled();
	});

	it('no ownership / 30-day warranty / one-payment / «محتجزة» / auto-acceptance / finalize wording anywhere', async () => {
		const s = await setup(WS(['completed', 'completed']));
		for (const gone of ['ملكية', '30 يومًا', 'دفعةً واحدة', 'محتجزة بالضمان', 'الاستلام التلقائي', 'استلام واعتماد', 'الاعتماد النهائي', 'بانتظار اعتمادك']) expect(s.text(), gone).not.toContain(gone);
		const html = readFileSync(join(__dirname, 'final-approval.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'final-approval.ts'), 'utf8');
		for (const gone of ['ملكية', 'ضمان 30', 'دفعةً واحدة', 'محتجزة بالضمان', 'الاستلام التلقائي', 'confirmAndRate', 'showConfirmModal', 'autoAccept']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
	});

	it('the money figures are derived from the approved stages only: released + remaining = total', async () => {
		const s = await setup(WS(['completed', 'completed', 'submitted', 'pending']));
		expect(s.c.releasedAmount()).toBe(500);
		expect(s.c.remainingAmount()).toBe(500);
		expect(s.c.allStagesCompleted()).toBe(false);
	});

	it('not all stages done: says so and offers no rating action', async () => {
		const s = await setup(WS(['completed', 'submitted']));
		expect(s.q('fa-not-complete')).not.toBeNull();
		expect(s.q('fa-continue-rating')).toBeNull();
		expect(s.q('fa-badge')!.textContent).toContain('قيد التنفيذ');
	});
});
