/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AiNoteComponent } from './ai-note.component';

const APP = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf-8');

describe('ws-ai-note: what the AI read is always purple with the official AI mark', () => {
	it('draws the official mark, the message, and the purple tokens (never amber / green / red)', () => {
		const f = TestBed.createComponent(AiNoteComponent);
		f.componentRef.setInput('message', 'الصورة لا تبدو وثيقة هوية'); f.componentRef.setInput('state', 'warning'); f.detectChanges();
		const el: HTMLElement = f.nativeElement;
		expect(el.querySelector('svg[data-ws-ai-mark]')).not.toBeNull();
		expect(el.textContent).toContain('الصورة لا تبدو وثيقة هوية');
		expect(el.getAttribute('role')).toBe('status'); expect(el.getAttribute('data-state')).toBe('warning');
		const css = read('shared/ai/ai-note.component.ts');
		expect(css).toContain('--ai-bg'); expect(css).toContain('--ai-border'); expect(css).toContain('--ai-txt');
		expect(css).not.toMatch(/245,\s*158,\s*11|16,\s*185,\s*129|239,\s*68,\s*68|#fbbf24/);
	});
	it('every AI file check of the wizards and the data page uses it (no inline amber / green box left)', () => {
		const sites: Array<[string, string[]]> = [
			['pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html', ['client-ai-id-inspection-frontId', 'client-ai-id-inspection-backId']],
			['pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html', ['ai-id-inspection-frontId', 'ai-id-inspection-backId', 'selfie-ai-check', 'certs-ai-check', 'pf-ai-check-review', 'pf-ai-check-proof', 'pf-ai-check-refused']],
			['pages/dashboard/provider-overview/profile/data/data.html', ['id-doc-ai-check']],
		];
		for (const [file, ids] of sites) {
			const html = read(file);
			for (const id of ids) expect(html, `${file}: ${id}`).toMatch(new RegExp(`<ws-ai-note data-testid="${id}"`));
		}
	});
	it('the guest chat shows the AI mark on every assistant message and keeps the assistant\'s purple look', () => {
		const src = read('sheards/guest-chat/guest-chat.ts');
		expect(src.match(/data-ws-ai-mark/g)!.length).toBeGreaterThanOrEqual(3);
		expect(src).toContain('rgba(165, 107, 224, .22)'); expect(src).toContain('#7B2FBE');
	});
});
