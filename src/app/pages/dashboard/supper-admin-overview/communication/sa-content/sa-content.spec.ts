import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SaContent } from './sa-content';
import { expectFieldProblem, expectFocused, settleForm } from '../../../../../shared/forms/form-spec-utils';

describe('SaContent form', () => {
	it('saving an empty page puts the message under the textarea and focuses it', async () => {
		TestBed.configureTestingModule({ imports: [SaContent] });
		const f = TestBed.createComponent(SaContent);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		f.componentInstance.onContentChange('   ');
		f.detectChanges();
		(el.querySelector('[data-testid="cms-save-local"]') as HTMLButtonElement).click();
		await settleForm();
		const ta = el.querySelector('#sco-content');
		expectFieldProblem(ta, 'فارغ');
		expectFocused(ta);
	});

	it('is honest: states it is a LOCAL draft (not published, not saved on the server) and never claims publishing', () => {
		TestBed.configureTestingModule({ imports: [SaContent] });
		const f = TestBed.createComponent(SaContent);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const note = el.querySelector('[data-testid="cms-local-note"]')?.textContent ?? '';
		expect(note).toContain('مسودة محلية');
		expect(note).toContain('لا يُنشر');
		expect(note).toContain('غير متصل');
		expect(el.querySelector('[data-testid="cms-draft-state"]')?.textContent).toContain('غير منشورة');
		expect(el.textContent).not.toContain('تُنشر فوراً');
		expect(el.textContent).not.toContain('حفظ ونشر');
		expect(el.querySelector('[data-testid="cms-save-local"]')?.textContent).toContain('مسودة محلية');
	});
});
