/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SpecialtyEmptyComponent } from './specialty-empty.component';
import { specialtyEmptyView, type RegisteredSpecialty } from '../../core/utils/specialty-states';

const spec = (name: string, state: RegisteredSpecialty['state']): RegisteredSpecialty => ({ specialtyId: name, name, state });

describe('specialty empty state (upload / accreditation selectors)', () => {
	it('says "no specialty" ONLY when none is registered', () => {
		expect(specialtyEmptyView([]).title).toBe('لا يوجد لديك تخصص مسجّل');
		expect(specialtyEmptyView(null).items).toEqual([]);
	});

	it('a registered specialty never gets the "no specialty" message; each one shows its own state', () => {
		const v = specialtyEmptyView([spec('تصميم الجرافيك', 'TEST_NOT_TAKEN'), spec('برمجة', 'TEST_NOT_PASSED'), spec('تسويق', 'REJECTED'), spec('ترجمة', 'LOCKED_OUT')]);
		expect(v.title).not.toBe('لا يوجد لديك تخصص مسجّل');
		expect(v.items.map((i) => i.state)).toEqual(['TEST_NOT_TAKEN', 'TEST_NOT_PASSED', 'REJECTED', 'LOCKED_OUT']);
		expect(v.items[0].text).toContain('لم تُجرِ اختبار');
		expect(v.items[1].text).toContain('لم تتجاوزه');
		expect(v.items[2].text).toContain('رفض');
		expect(v.items[3].text).toContain('مقفل');
		expect(v.ctaLink).toBe('/provider-overview/profile/specialties');
	});

	it('passed specialties are not listed as a problem', () => {
		const v = specialtyEmptyView([spec('تصميم', 'PASSED'), spec('برمجة', 'TEST_NOT_TAKEN')]);
		expect(v.items.map((i) => i.name)).toEqual(['برمجة']);
	});

	it('renders the names and states of registered specialties, with no "none registered" title', () => {
		TestBed.configureTestingModule({ imports: [SpecialtyEmptyComponent], providers: [provideRouter([])] });
		const f = TestBed.createComponent(SpecialtyEmptyComponent);
		f.componentRef.setInput('registered', [spec('تصميم الجرافيك', 'TEST_NOT_PASSED')]);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.textContent).toContain('تصميم الجرافيك');
		expect(el.textContent).toContain('لم تتجاوزه');
		expect(el.querySelector('[data-testid="specialty-empty-title"]')!.textContent).not.toContain('لا يوجد لديك تخصص مسجّل');
		expect(el.querySelector('[data-testid="specialty-empty-cta"]')!.getAttribute('href')).toBe('/provider-overview/profile/specialties');
	});

	it('both selectors route their empty state through the shared notice and feed it the registered list', () => {
		const base = join(__dirname, '../../pages/dashboard/provider-overview/business-models/');
		const s2 = readFileSync(base + 'new-project/components/step2-specialty/step2-specialty.component.html', 'utf8');
		const s1 = readFileSync(base + 'accreditation/new/components/step1-specialty/step1-specialty.component.html', 'utf8');
		for (const html of [s1, s2]) { expect(html).toContain('<ws-specialty-empty'); expect(html).toContain('[registered]="registered"'); }
		expect(s2).not.toContain('لا توجد تخصصات معتمدة متوفرة');
		expect(readFileSync(base + 'new-project/new-project.ts', 'utf8')).toContain('res?.registered');
		expect(readFileSync(base + 'accreditation/new/new.ts', 'utf8')).toContain('res?.registered');
	});
});

describe('selector tags do not call a test-passed specialty "approved"', () => {
	it('both selectors tag a specialty from its approval state (never "معتمد" without an admin approval)', () => {
		const base = join(__dirname, '../../pages/dashboard/provider-overview/business-models/');
		for (const f of ['new-project/components/step2-specialty/step2-specialty.component.html', 'accreditation/new/components/step1-specialty/step1-specialty.component.html']) {
			const html = readFileSync(base + f, 'utf8');
			expect(html).toContain('approvalTag(spec)');
		}
	});
});
