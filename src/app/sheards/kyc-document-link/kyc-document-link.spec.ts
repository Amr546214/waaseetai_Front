import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { KycDocumentLink } from './kyc-document-link';
import { KycDocumentService } from '../../core/services/kyc-document.service';
import { KycAccess } from '../../core/models/kyc-document.model';

@Component({
	standalone: true,
	imports: [KycDocumentLink],
	template: `<app-kyc-document-link [document]="document()" [userId]="userId()" [docId]="docId()" [index]="index()" [url]="url()" [access]="access()" label="عرض" linkClass="sk-doc-link" />`,
})
class Host {
	document = signal<any>('client_front_id');
	userId = signal<string | null>(null);
	docId = signal<string | null>(null);
	index = signal<number | null>(null);
	url = signal<string | null>(null);
	access = signal<KycAccess | null>(null);
}

const LEGACY_URL = 'https://res.cloudinary.com/c/image/upload/old-front.png';
const PRIVATE: KycAccess = { private: true, legacy: false };
const LEGACY: KycAccess = { private: false, legacy: true };

describe('KycDocumentLink', () => {
	let fixture: ComponentFixture<Host>;
	let host: Host;
	let createAccessLink: ReturnType<typeof vi.fn<(...a: any[]) => Observable<any>>>;
	let fakeTab: { opener: any; closed: boolean; document: { title: string }; location: { href: string }; close: ReturnType<typeof vi.fn> };
	let openSpy: ReturnType<typeof vi.spyOn>;

	const el = () => fixture.nativeElement as HTMLElement;
	const button = () => el().querySelector('button') as HTMLButtonElement | null;
	const settle = () => { fixture.detectChanges(); };

	beforeEach(() => {
		createAccessLink = vi.fn(() => of({ url: 'https://api.cloudinary.com/v1_1/c/image/download?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		fakeTab = { opener: 'x', closed: false, document: { title: '' }, location: { href: 'about:blank' }, close: vi.fn(() => { fakeTab.closed = true; }) };
		openSpy = vi.spyOn(window, 'open').mockImplementation(() => fakeTab as any);
		TestBed.configureTestingModule({ imports: [Host], providers: [{ provide: KycDocumentService, useValue: { createAccessLink } }] });
		fixture = TestBed.createComponent(Host);
		host = fixture.componentInstance;
	});
	afterEach(() => { openSpy.mockRestore(); TestBed.resetTestingModule(); });

	it('legacy document: a plain link to the old URL, no request is made', () => {
		host.url.set(LEGACY_URL); host.access.set(LEGACY);
		settle();
		const a = el().querySelector('a')!;
		expect(a.getAttribute('href')).toBe(LEGACY_URL);
		expect(a.getAttribute('target')).toBe('_blank');
		expect(a.getAttribute('rel')).toBe('noopener');
		expect(a.className).toContain('sk-doc-link');
		expect(button()).toBeNull();
		expect(createAccessLink).not.toHaveBeenCalled();
	});

	it('a URL without any access marker is still treated as legacy (older responses)', () => {
		host.url.set(LEGACY_URL);
		settle();
		expect(el().querySelector('a')?.getAttribute('href')).toBe(LEGACY_URL);
	});

	it('nothing uploaded: says so, no link and no button', () => {
		settle();
		expect(el().textContent).toContain('لا شيء مرفوع');
		expect(el().querySelector('a')).toBeNull();
		expect(button()).toBeNull();
	});

	it('private document: a "view" button; the signed link is neither stored nor shown', () => {
		host.access.set(PRIVATE);
		settle();
		expect(button()!.textContent).toContain('عرض');
		expect(el().querySelector('a')).toBeNull();
		button()!.click(); settle();
		expect(el().innerHTML).not.toContain('SECRET');
		expect(el().textContent).not.toContain('cloudinary');
	});

	it('click opens the tab FIRST (inside the click), then asks for the link, then points the tab at it', () => {
		const order: string[] = [];
		openSpy.mockImplementation(() => { order.push('open'); return fakeTab as any; });
		createAccessLink.mockImplementation(() => { order.push('request'); return of({ url: 'https://api.cloudinary.com/x?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }); });
		host.access.set(PRIVATE); host.userId.set('u-1'); host.document.set('provider_front_id');
		settle();
		button()!.click(); settle();
		expect(order).toEqual(['open', 'request']);
		expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
		expect(fakeTab.opener).toBeNull();
		expect(fakeTab.location.href).toBe('https://api.cloudinary.com/x?sig=SECRET');
		expect(createAccessLink).toHaveBeenCalledWith({ document: 'provider_front_id', userId: 'u-1', id: undefined, index: undefined });
	});

	it('sends id and index (0 included) when the document is addressed that way', () => {
		host.access.set(PRIVATE); host.document.set('provider_certificate'); host.index.set(0); host.userId.set('u-1');
		settle(); button()!.click();
		expect(createAccessLink).toHaveBeenLastCalledWith({ document: 'provider_certificate', userId: 'u-1', id: undefined, index: 0 });
		host.document.set('onboarding_document'); host.index.set(null); host.docId.set('o-1'); host.userId.set(null);
		settle(); button()!.click();
		expect(createAccessLink).toHaveBeenLastCalledWith({ document: 'onboarding_document', userId: undefined, id: 'o-1', index: undefined });
	});

	it('asks the server again on EVERY click (the link is not reused)', () => {
		host.access.set(PRIVATE); settle();
		button()!.click(); settle(); button()!.click(); settle();
		expect(createAccessLink).toHaveBeenCalledTimes(2);
		expect(openSpy).toHaveBeenCalledTimes(2);
	});

	it('shows a loading state and ignores a second click while the request is in flight', () => {
		const pending = new Subject<any>();
		createAccessLink.mockReturnValue(pending.asObservable());
		host.access.set(PRIVATE); settle();
		button()!.click(); settle();
		expect(button()!.disabled).toBe(true);
		expect(button()!.textContent).toContain('جارٍ الفتح');
		button()!.click();
		expect(createAccessLink).toHaveBeenCalledTimes(1);
		pending.next({ url: 'https://api.cloudinary.com/x', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false });
		pending.complete(); settle();
		expect(button()!.disabled).toBe(false);
	});

	it.each([
		[401, 'انتهت الجلسة، سجّل الدخول مجددًا'],
		[403, 'لا تملك صلاحية لفتح هذه الوثيقة'],
		[500, 'تعذر فتح الوثيقة'],
	])('error %i: closes the empty tab and shows "%s"', (status, message) => {
		createAccessLink.mockImplementation(() => throwError(() => ({ status })));
		host.access.set(PRIVATE); settle();
		button()!.click(); settle();
		expect(fakeTab.close).toHaveBeenCalled();
		expect(el().querySelector('[role="alert"]')!.textContent).toContain(message);
		expect(button()!.disabled).toBe(false);
	});

	it('a blocked pop-up is reported instead of failing silently', () => {
		openSpy.mockImplementation(() => null);
		host.access.set(PRIVATE); settle();
		button()!.click(); settle();
		expect(el().querySelector('[role="alert"]')!.textContent).toContain('النوافذ المنبثقة');
	});
});
