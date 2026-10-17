import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Archived } from './archived';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider archive: a project closed by a dispute settlement is its OWN end state (label, counter, filter, icon), never inside «مكتملة».
const row = (o: Record<string, unknown>) => ({ id: 'p', displayId: 'PRJ-1', title: 'م', clientName: 'ع', value: '25 $', date: 'x', status: 'done', icon: 'check', ...o });

describe('provider archived projects: settled end state', () => {
	async function setup(items: any[]) {
		await TestBed.configureTestingModule({ imports: [Archived], providers: [provideRouter([]),
			{ provide: ActiveProjectsService, useValue: { getArchivedProjects: vi.fn(() => of({ success: true, data: items })) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } }] }).compileComponents();
		const f = TestBed.createComponent(Archived); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('settled rows count apart from the completed ones, have their own filter, label and the document icon', async () => {
		const s = await setup([row({ id: 'a' }), row({ id: 'b', status: 'settled', settled: true, statusLabel: 'أُغلق بتسوية نزاع', closedBySettlement: true })]);
		expect(s.c.stats().done).toBe(1);
		expect(s.c.stats().settled).toBe(1);
		expect(s.c.stats().total).toBe(2);
		expect(s.el.querySelector('[data-testid="arch-settled-chip"]')).not.toBeNull();
		s.c.setFilter('settled'); s.f.detectChanges();
		expect(s.c.filteredProjects().map(p => p.id)).toEqual(['b']);
		expect(s.c.projectStatusLabel(s.c.filteredProjects()[0])).toBe('أُغلق بتسوية نزاع');
		expect(s.c.filteredProjects()[0].icon).toBe('doc');
	});

	it('an older backend (status done + settled flag) is still separated from the completed ones', async () => {
		const s = await setup([row({ id: 'b', status: 'done', settled: true })]);
		expect(s.c.stats().done).toBe(0);
		expect(s.c.stats().settled).toBe(1);
	});

	it('no settled chip when nothing is settled', async () => {
		const s = await setup([row({ id: 'a' })]);
		expect(s.el.querySelector('[data-testid="arch-settled-chip"]')).toBeNull();
	});
});
