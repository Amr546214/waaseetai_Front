import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { New } from './new';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';
import { ProviderAccessService } from '../../../../../../core/services/provider-access.service';

// H3 D5: after removing a proof, picking the SAME file again did nothing, because the <input type=file> kept its value
// and the browser fires no change event for an unchanged selection. The handler must clear the input after reading.
describe('accreditation proofs: the same file can be picked again', () => {
	function mount() {
		const api = {
			getPassedSpecialties: () => of({ success: true, categories: [], registered: [] }),
			submitAccreditationRequest: vi.fn(),
			getAccountActionCompletion: vi.fn(() => of({ data: undefined })),
			deleteAccreditationProof: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({
			imports: [New],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: api },
				{ provide: ProviderAccessService, useValue: { invalidate: vi.fn(), load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false }) } },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
			],
		});
		const f = TestBed.createComponent(New);
		f.detectChanges();
		return f.componentInstance as any;
	}
	afterEach(() => TestBed.resetTestingModule());
	const file = (name: string, type = 'application/pdf', size = 1000) => new File([new Uint8Array(size)], name, { type });
	/** A stand-in input behaving like the real one: the FileList is live, so clearing the value empties it. */
	function fakeInput(files: File[]) {
		const live: File[] = [...files];
		let value = files.length ? `C:\\fakepath\\${files[0].name}` : '';
		const target: any = { files: live };
		Object.defineProperty(target, 'value', { get: () => value, set: (v: string) => { value = v; if (v === '') live.length = 0; } });
		return { event: { target }, target };
	}

	it('clears the input after reading, keeping the picked files', () => {
		const c = mount();
		const { event, target } = fakeInput([file('a.pdf'), file('b.pdf')]);
		c.onFileSelected(event);
		expect(target.value).toBe('');
		expect(c.attachments().map((a: any) => a.name)).toEqual(['a.pdf', 'b.pdf']);
	});

	it('attach A, remove A, attach A again: it attaches; the other proof stays', () => {
		const c = mount();
		c.onFileSelected(fakeInput([file('a.pdf'), file('b.pdf')]).event);
		c.removeAttachment(c.attachments()[0].id);
		expect(c.attachments().map((a: any) => a.name)).toEqual(['b.pdf']);
		const second = fakeInput([file('a.pdf')]);
		expect(second.target.value).not.toBe('');
		c.onFileSelected(second.event);
		expect(c.attachments().map((a: any) => a.name).sort()).toEqual(['a.pdf', 'b.pdf']);
		expect(second.target.value).toBe('');
	});

	it('a rejected file (wrong type / over 15 MB) also clears the input so the same name can be re-picked once corrected', () => {
		const c = mount();
		const bad = fakeInput([file('big.pdf', 'application/pdf', 15 * 1024 * 1024 + 1)]);
		c.onFileSelected(bad.event);
		expect(c.attachments().length).toBe(0);
		expect(bad.target.value).toBe('');
		const txt = fakeInput([file('notes.txt', 'text/plain')]);
		c.onFileSelected(txt.event);
		expect(c.attachments().length).toBe(0);
		expect(txt.target.value).toBe('');
	});

	it('drag and drop still works', () => {
		const c = mount();
		c.handleDrop({ preventDefault: () => {}, dataTransfer: { files: [file('d.pdf')] } } as any);
		expect(c.attachments().map((a: any) => a.name)).toEqual(['d.pdf']);
	});
});
