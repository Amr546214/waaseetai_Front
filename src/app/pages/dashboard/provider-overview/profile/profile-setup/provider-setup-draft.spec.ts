import { describe, expect, it } from 'vitest';
import { buildDraft, clearDraft, providerDraftKey, readDraft, writeDraft } from './provider-setup-draft';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };

describe('provider setup local draft', () => {
	const input = { step: 4, formRaw: { profData: { jobTitle: 'مطور', bio: 'x'.repeat(2000), dob: '1990-01-01' }, docs: { idNumber: '30408012203296', frontId: 'https://cdn/x.png', backId: 'data:image/png;base64,AAAA' } }, skills: ['HTML'], specs: ['تطوير الواجهات الخلفية'], portfolio: { s: [{ review: 'نص', proofs: ['data:image/png;base64,BBBB', 'https://cdn/p.png'] }] }, avatarUrl: 'data:image/png;base64,CCCC' };

	it('keeps short text, lists and the step, and drops pictures, data URLs and long blobs', () => {
		const d = buildDraft(input);
		expect(d.step).toBe(4);
		expect(d.form['profData']).toEqual({ jobTitle: 'مطور', dob: '1990-01-01' });
		expect(d.form['docs']).toEqual({ idNumber: '30408012203296' });
		expect(d.skills).toEqual(['HTML']); expect(d.specs).toEqual(['تطوير الواجهات الخلفية']);
		expect(d.portfolio['s']).toEqual([{ review: 'نص', proofs: ['https://cdn/p.png'] }]);
		expect(d.avatarUrl).toBe('');
	});

	it('is stored per account, read back, and erased', () => {
		const s = mem();
		writeDraft('u1', buildDraft(input), s);
		expect(s.m.has(providerDraftKey('u1'))).toBe(true);
		expect(readDraft('u2', s)).toBeNull();
		expect(readDraft('u1', s)?.step).toBe(4);
		clearDraft('u1', s);
		expect(readDraft('u1', s)).toBeNull();
	});

	it('ignores a corrupt or foreign value', () => {
		const s = mem(); s.setItem(providerDraftKey('u1'), '{not json'); expect(readDraft('u1', s)).toBeNull();
		s.setItem(providerDraftKey('u1'), JSON.stringify({ v: 2, form: {}, step: 3 })); expect(readDraft('u1', s)).toBeNull();
	});
});
