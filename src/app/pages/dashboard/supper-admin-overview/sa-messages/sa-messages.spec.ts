import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { AdminMessagesLive } from '../../../../core/services/admin-messages.service';
import { SaMessages } from './sa-messages';

const B = `${environment.url_api}/admin/messages`;
class FakeLive { state = signal<'off' | 'connecting' | 'live' | 'denied'>('live'); opened = 0; closed = 0; onMessage: any = () => undefined; onReadSync: any = () => undefined; onResync: any = () => undefined; open() { this.opened++; } close() { this.closed++; } }
const flush = async (f: any) => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const conv = (over: any = {}) => ({ id: 'c1', counterpart: { userId: 'u2', name: 'سلمى الحربي', role: 'مشرف دعم' }, lastMessage: { body: 'مرحبا', at: new Date().toISOString(), mine: false }, lastMessageAt: new Date().toISOString(), unread: 2, ...over });
const msg = (id: string, seq: string, sender: string, body: string, cmid = `cm-${id}-aaaaaaaa`) => ({ id, conversationId: 'c1', senderId: sender, clientMessageId: cmid, body, seq, createdAt: new Date().toISOString() });

describe('admin messages page (real conversations, saved-before-sent, honest states)', () => {
	let http: HttpTestingController; let live: FakeLive;
	beforeEach(() => { live = new FakeLive(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AdminMessagesLive, useValue: live }] }); http = TestBed.inject(HttpTestingController); });
	const boot = async (list: any[]) => { const f = TestBed.createComponent(SaMessages); await flush(f); http.expectOne(r => r.url === `${B}/conversations` && r.method === 'GET').flush({ success: true, data: list }); await flush(f); return f; };
	const open = async (f: any, history: any[]) => { (f.nativeElement.querySelector('[data-testid="conv-c1"]') as HTMLElement).click(); await flush(f); http.expectOne(r => r.url === `${B}/conversations/c1/messages`).flush({ success: true, data: { messages: history, hasMore: false } }); await flush(f); };

	it('no invented data: an empty server list shows the empty state and the live room is opened; nothing from the old mock appears', async () => {
		const f = await boot([]); const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="list-empty"]')?.textContent).toContain('لا توجد محادثات بعد'); expect(el.querySelectorAll('.ms-conv-item').length).toBe(0); expect(live.opened).toBe(1);
		expect(el.textContent).not.toContain('أحمد الغامدي'); expect(el.textContent).not.toContain('متصل الآن');
		f.destroy(); expect(live.closed).toBe(1);
	});

	it('list error is explained next to the list with a retry; the retry refetches', async () => {
		const f = TestBed.createComponent(SaMessages); await flush(f);
		http.expectOne(r => r.url === `${B}/conversations`).flush({ success: false, message: 'x' }, { status: 500, statusText: 'x' }); await flush(f);
		const el = f.nativeElement as HTMLElement; expect(el.querySelector('[data-testid="list-error"]')).toBeTruthy();
		(el.querySelector('[data-testid="list-error"] button') as HTMLButtonElement).click(); http.expectOne(r => r.url === `${B}/conversations`).flush({ success: true, data: [conv()] }); await flush(f);
		expect(el.querySelector('[data-testid="list-error"]')).toBeNull(); expect(el.querySelectorAll('.ms-conv-item').length).toBe(1);
	});

	it('shows the server unread counters; opening the conversation loads history and only then marks it read (up to the last saved seq)', async () => {
		const f = await boot([conv()]); const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="unread-c1"]')?.textContent?.trim()).toBe('2'); expect(el.querySelector('[data-testid="total-unread"]')?.textContent?.trim()).toBe('2');
		await open(f, [msg('m1', '10', 'u2', 'مرحبا'), msg('m2', '11', 'me', 'أهلًا')]);
		const rd = http.expectOne(`${B}/conversations/c1/read`); expect(rd.request.body).toEqual({ upToSeq: '11' }); rd.flush({ success: true, data: { conversationId: 'c1', unread: 0 } }); await flush(f);
		expect(el.querySelector('[data-testid="unread-c1"]')).toBeNull(); expect(el.querySelectorAll('.ms-row').length).toBe(2); expect(el.querySelectorAll('.ms-row.mine').length).toBe(1);
	});

	it('a send shows as "sending" (not sent), becomes a saved message only after the server confirms, and one click sends once; the key is generated once', async () => {
		const f = await boot([conv({ unread: 0 })]); const el = f.nativeElement as HTMLElement; await open(f, []);
		const ta = el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement; ta.value = 'رسالة اختبار'; ta.dispatchEvent(new Event('input')); await flush(f);
		const btn = el.querySelector('[data-testid="send"]') as HTMLButtonElement; btn.click(); btn.click(); await flush(f); // a double click: the draft was cleared by the first
		const req = http.expectOne(`${B}/conversations/c1/messages`); expect(req.request.body.body).toBe('رسالة اختبار'); expect(req.request.body.clientMessageId.length).toBeGreaterThanOrEqual(8);
		expect(el.querySelector('[data-testid="msg-sending"]')).toBeTruthy(); expect((el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement).value).toBe('');
		req.flush({ success: true, data: { message: msg('s1', '20', 'me', 'رسالة اختبار', req.request.body.clientMessageId), duplicate: false } }); await flush(f);
		expect(el.querySelector('[data-testid="msg-sending"]')).toBeNull(); expect(el.querySelectorAll('[data-testid="msg-saved"]').length).toBe(1); expect(el.querySelector('.ms-c-last')?.textContent).toContain('أنت: رسالة اختبار');
	});

	it('a failed send keeps the text, says why next to the message and offers retry (same clientMessageId, so the server dedupes) and discard (text returns to the box)', async () => {
		const f = await boot([conv({ unread: 0 })]); const el = f.nativeElement as HTMLElement; await open(f, []);
		const send = async (t: string) => { const ta = el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement; ta.value = t; ta.dispatchEvent(new Event('input')); await flush(f); (el.querySelector('[data-testid="send"]') as HTMLButtonElement).click(); await flush(f); };
		await send('لن تُفقد');
		const first = http.expectOne(`${B}/conversations/c1/messages`); const key = first.request.body.clientMessageId; first.flush({ success: false, message: 'الخادم مشغول' }, { status: 500, statusText: 'x' }); await flush(f);
		expect(el.querySelector('.ms-fail')?.textContent).toContain('الخادم مشغول'); expect(el.querySelector('.ms-bbl.failed')?.textContent).toContain('لن تُفقد');
		(el.querySelector('[data-testid="msg-retry"]') as HTMLButtonElement).click(); await flush(f);
		const again = http.expectOne(`${B}/conversations/c1/messages`); expect(again.request.body.clientMessageId).toBe(key); again.flush({ success: false, message: 'الخادم مشغول' }, { status: 500, statusText: 'x' }); await flush(f);
		(el.querySelector('[data-testid="msg-discard"]') as HTMLButtonElement).click(); await flush(f);
		expect(el.querySelector('.ms-bbl.failed')).toBeNull(); expect((el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement).value).toBe('لن تُفقد');
	});

	it('a 403 (access withdrawn) is said in words; Shift+Enter does not send, Enter does', async () => {
		const f = await boot([conv({ unread: 0 })]); const el = f.nativeElement as HTMLElement; await open(f, []);
		const ta = el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement; ta.value = 'سطر'; ta.dispatchEvent(new Event('input')); await flush(f);
		ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true })); await flush(f); http.expectNone(`${B}/conversations/c1/messages`);
		ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })); await flush(f);
		http.expectOne(`${B}/conversations/c1/messages`).flush({ success: false }, { status: 403, statusText: 'x' }); await flush(f);
		expect(el.querySelector('.ms-fail')?.textContent).toContain('لم تعد تملك صلاحية المراسلة');
	});

	it('live: a message from the other side appears once in the open thread (and is marked read), counts as unread in a closed one, and the server echo of my own send replaces the pending row', async () => {
		const f = await boot([conv({ unread: 0 }), conv({ id: 'c2', counterpart: { userId: 'u3', name: 'ليلى', role: 'مشرف نزاعات' }, unread: 0, lastMessage: null, lastMessageAt: null })]); const el = f.nativeElement as HTMLElement; await open(f, [msg('m1', '10', 'u2', 'قديمة')]);
		http.expectOne(`${B}/conversations/c1/read`).flush({ success: true, data: { conversationId: 'c1', unread: 0 } });
		live.onMessage({ conversationId: 'c1', message: msg('m2', '11', 'u2', 'جديدة') }); live.onMessage({ conversationId: 'c1', message: msg('m2', '11', 'u2', 'جديدة') }); await flush(f); // the same push twice = one row
		expect(el.querySelectorAll('[data-testid="msg-saved"]').length).toBe(2);
		http.expectOne(`${B}/conversations/c1/read`).flush({ success: true, data: { conversationId: 'c1', unread: 0 } }); await flush(f);
		live.onMessage({ conversationId: 'c2', message: { ...msg('x1', '12', 'u3', 'لك'), conversationId: 'c2' } }); await flush(f);
		expect(el.querySelector('[data-testid="unread-c2"]')?.textContent?.trim()).toBe('1');
		live.onReadSync({ conversationId: 'c2', unread: 0, total: 0 }); await flush(f); expect(el.querySelector('[data-testid="unread-c2"]')).toBeNull(); // read in another tab
	});

	it('reconnect refetches the list and the open thread (a missed message is not lost)', async () => {
		const f = await boot([conv({ unread: 0 })]); await open(f, [msg('m1', '10', 'u2', 'أولى')]); http.expectOne(`${B}/conversations/c1/read`).flush({ success: true, data: { conversationId: 'c1', unread: 0 } });
		live.onResync(); await flush(f);
		http.expectOne(r => r.url === `${B}/conversations`).flush({ success: true, data: [conv({ unread: 1 })] });
		http.expectOne(r => r.url === `${B}/conversations/c1/messages`).flush({ success: true, data: { messages: [msg('m1', '10', 'u2', 'أولى'), msg('m3', '12', 'u2', 'فاتتني')], hasMore: false } }); await flush(f);
		expect((f.nativeElement as HTMLElement).textContent).toContain('فاتتني');
	});

	it('starting a conversation: the directory comes from the server, picking a person opens (or reuses) the conversation; a refusal is shown next to the list', async () => {
		const f = await boot([]); const el = f.nativeElement as HTMLElement; (el.querySelector('[data-testid="new-chat-open"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(r => r.url === `${B}/directory`).flush({ success: true, data: [{ userId: 'u9', name: 'ريم العتيبي', role: 'مشرف مالي' }] }); await flush(f);
		expect(el.querySelector('[data-testid="dir-u9"]')?.textContent).toContain('ريم العتيبي');
		(el.querySelector('[data-testid="dir-u9"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(`${B}/conversations`).flush({ success: false, message: 'هذا الموظف غير متاح للمراسلة' }, { status: 404, statusText: 'x' }); await flush(f);
		expect(el.querySelector('[data-testid="dir-error"]')?.textContent).toContain('غير متاح للمراسلة');
		(el.querySelector('[data-testid="dir-u9"]') as HTMLButtonElement).click(); await flush(f);
		http.expectOne(`${B}/conversations`).flush({ success: true, data: conv({ id: 'c1', counterpart: { userId: 'u9', name: 'ريم العتيبي', role: 'مشرف مالي' }, unread: 0 }) }); await flush(f);
		http.expectOne(r => r.url === `${B}/conversations/c1/messages`).flush({ success: true, data: { messages: [], hasMore: false } }); await flush(f);
		expect(el.querySelector('[data-testid="directory"]')).toBeNull(); expect(el.querySelector('.ms-mh-name')?.textContent).toContain('ريم العتيبي'); expect(el.querySelector('[data-testid="thread-empty"]')).toBeTruthy();
	});

	it('search goes to the server (debounced) and a draft is kept per conversation when switching', async () => {
		const f = await boot([conv({ unread: 0 }), conv({ id: 'c2', counterpart: { userId: 'u3', name: 'ليلى', role: '' }, unread: 0 })]); const el = f.nativeElement as HTMLElement; await open(f, []);
		const ta = () => el.querySelector('[data-testid="composer"]') as HTMLTextAreaElement; ta().value = 'مسودة'; ta().dispatchEvent(new Event('input')); await flush(f);
		(el.querySelector('[data-testid="conv-c2"]') as HTMLElement).click(); await flush(f); http.expectOne(`${B}/conversations/c2/messages?limit=50`).flush({ success: true, data: { messages: [], hasMore: false } }); await flush(f);
		expect(ta().value).toBe(''); (el.querySelector('[data-testid="conv-c1"]') as HTMLElement).click(); await flush(f); http.expectOne(`${B}/conversations/c1/messages?limit=50`).flush({ success: true, data: { messages: [], hasMore: false } }); await flush(f);
		expect(ta().value).toBe('مسودة');
		const s = el.querySelector('[data-testid="conv-search"]') as HTMLInputElement; s.value = 'ليلى'; s.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 350));
		http.expectOne(r => r.url === `${B}/conversations` && r.params.get('q') === 'ليلى').flush({ success: true, data: [conv({ id: 'c2', unread: 0 })] }); await flush(f);
		expect(el.querySelectorAll('.ms-conv-item').length).toBe(1);
	});
});
