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
		(el.querySelector('.sco-editor-actions button') as HTMLButtonElement).click();
		await settleForm();
		const ta = el.querySelector('#sco-content');
		expectFieldProblem(ta, 'فارغ');
		expectFocused(ta);
	});
});
