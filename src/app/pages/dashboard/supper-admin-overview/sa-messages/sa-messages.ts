import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminMessagesApi, AdminMessagesLive, MsgConversation, MsgItem, MsgPerson, ThreadItem, newClientMessageId } from '../../../../core/services/admin-messages.service';

const errText = (e: unknown, fallback: string): string => {
	const he = e as HttpErrorResponse;
	if (he?.status === 0) return 'تعذّر الاتصال بالخادم. تحقق من الاتصال وأعد المحاولة';
	if (he?.status === 403) return 'لم تعد تملك صلاحية المراسلة';
	return he?.error?.message || he?.error?.errors?.[0]?.message || fallback;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const two = (n: number) => String(n).padStart(2, '0');

/**
 * P-AD-CM-002 layout, for the internal admin team: real conversations between staff members (direct messages), saved by the server before they are shown as sent. Opening a conversation never
 * implies reading it from another account's side, and the list / counters follow the server (and the other tabs) through the live room.
 */
@Component({
	selector: 'app-sa-messages',
	standalone: true,
	templateUrl: './sa-messages.html',
	styleUrl: './sa-messages.css',
})
export class SaMessages implements OnInit, OnDestroy {
	private api = inject(AdminMessagesApi);
	private live = inject(AdminMessagesLive);
	@ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

	loading = signal(true); error = signal(''); conversations = signal<MsgConversation[]>([]);
	search = signal(''); selectedId = signal(''); thread = signal<ThreadItem[]>([]); threadLoading = signal(false); threadError = signal(''); hasMore = signal(false); olderLoading = signal(false);
	draft = signal(''); private drafts = new Map<string, string>();
	newChatOpen = signal(false); directory = signal<MsgPerson[]>([]); dirLoading = signal(false); dirError = signal(''); dirQ = signal(''); startingId = signal('');
	liveState = this.live.state; searchBusy = signal(false);
	private searchTimer: ReturnType<typeof setTimeout> | null = null; private dirTimer: ReturnType<typeof setTimeout> | null = null; private lastReadSent = new Map<string, string>();
	private onVisible = () => this.markRead();

	selected = computed(() => this.conversations().find(c => c.id === this.selectedId()) ?? null);
	totalUnread = computed(() => this.conversations().reduce((n, c) => n + c.unread, 0));
	canSend = computed(() => !!this.draft().trim() && !!this.selected());

	ngOnInit() {
		this.loadList();
		this.live.onMessage = p => this.onLiveMessage(p.conversationId, p.message);
		this.live.onReadSync = p => this.conversations.update(l => l.map(c => (c.id === p.conversationId ? { ...c, unread: p.unread } : c)));
		this.live.onResync = () => this.resync();
		this.live.open();
		if (typeof document !== 'undefined') { document.addEventListener('visibilitychange', this.onVisible); window.addEventListener('focus', this.onVisible); }
	}
	ngOnDestroy() {
		this.live.close();
		if (this.searchTimer) clearTimeout(this.searchTimer); if (this.dirTimer) clearTimeout(this.dirTimer);
		if (typeof document !== 'undefined') { document.removeEventListener('visibilitychange', this.onVisible); window.removeEventListener('focus', this.onVisible); }
	}

	// ---- list ----
	loadList(keepSelection = true) {
		this.api.conversations(this.search().trim() || undefined).subscribe({
			next: r => { this.conversations.set(r.data); this.loading.set(false); this.searchBusy.set(false); this.error.set(''); if (!keepSelection) this.selectedId.set(''); },
			error: e => { this.loading.set(false); this.searchBusy.set(false); this.error.set(errText(e, 'تعذّر تحميل المحادثات')); },
		});
	}
	onSearch(v: string) { this.search.set(v); this.searchBusy.set(true); if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.loadList(), 300); }

	// ---- thread ----
	openConversation(id: string) {
		if (id === this.selectedId()) return;
		this.stashDraft(); this.selectedId.set(id); this.draft.set(this.drafts.get(id) ?? ''); this.thread.set([]); this.hasMore.set(false); this.loadThread(id);
	}
	back() { this.stashDraft(); this.selectedId.set(''); }
	private stashDraft() { const id = this.selectedId(); if (id) { if (this.draft()) this.drafts.set(id, this.draft()); else this.drafts.delete(id); } }
	loadThread(id: string) {
		this.threadLoading.set(true); this.threadError.set('');
		this.api.messages(id).subscribe({
			next: r => {
				if (this.selectedId() !== id) return;
				const peer = this.conversations().find(c => c.id === id)?.counterpart.userId;
				const saved = r.data.messages.map(m => this.mapItem(m, peer));
				this.thread.set([...saved, ...this.thread().filter(t => t.state !== 'saved' && !saved.some(s => s.clientMessageId === t.clientMessageId && s.mine))]);
				this.hasMore.set(r.data.hasMore); this.threadLoading.set(false); this.scrollBottom(); this.markRead();
			},
			error: e => { if (this.selectedId() === id) { this.threadLoading.set(false); this.threadError.set(errText(e, 'تعذّر تحميل الرسائل')); } },
		});
	}
	private mapItem(m: MsgItem, peerId?: string): ThreadItem { return { key: m.id, clientMessageId: m.clientMessageId, body: m.body, createdAt: m.createdAt, mine: !!peerId && m.senderId !== peerId, state: 'saved', seq: m.seq }; }
	loadOlder() {
		const id = this.selectedId(); const first = this.thread().find(t => t.state === 'saved'); if (!id || !first?.seq) return; this.olderLoading.set(true);
		this.api.messages(id, first.seq).subscribe({
			next: r => { if (this.selectedId() !== id) return; const peer = this.conversations().find(c => c.id === id)?.counterpart.userId; this.thread.set([...r.data.messages.map(m => this.mapItem(m, peer)), ...this.thread()]); this.hasMore.set(r.data.hasMore); this.olderLoading.set(false); },
			error: e => { this.olderLoading.set(false); this.threadError.set(errText(e, 'تعذّر تحميل الأقدم')); },
		});
	}

	// ---- send (saved before it counts as sent; the same clientMessageId is reused by a retry, so a double click / a lost reply cannot duplicate) ----
	onKey(ev: KeyboardEvent) { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); this.send(); } }
	send() {
		const conv = this.selected(); const body = this.draft().trim(); if (!conv || !body) return;
		const item: ThreadItem = { key: `tmp-${newClientMessageId()}`, clientMessageId: newClientMessageId(), body, createdAt: new Date().toISOString(), mine: true, state: 'sending' };
		this.draft.set(''); this.drafts.delete(conv.id); this.thread.update(t => [...t, item]); this.scrollBottom(); this.post(conv.id, item);
	}
	retry(item: ThreadItem) { const id = this.selectedId(); if (!id) return; const next = { ...item, state: 'sending' as const, error: undefined }; this.thread.update(t => t.map(x => (x.key === item.key ? next : x))); this.post(id, next); }
	discard(item: ThreadItem) { this.thread.update(t => t.filter(x => x.key !== item.key)); if (!this.draft()) this.draft.set(item.body); }
	private post(convId: string, item: ThreadItem) {
		this.api.send(convId, item.body, item.clientMessageId).subscribe({
			next: r => {
				const m = r.data.message; const peer = this.conversations().find(c => c.id === convId)?.counterpart.userId;
				if (this.selectedId() === convId) this.thread.update(t => { const saved: ThreadItem = { ...this.mapItem(m, peer), mine: true }; const without = t.filter(x => x.key !== item.key && x.key !== m.id); return [...without, saved].sort((a, b) => (a.state === 'saved' && b.state === 'saved' ? Number(BigInt(a.seq!) - BigInt(b.seq!)) : 0)); });
				this.bump(convId, m, true);
			},
			error: e => { if (this.selectedId() === convId) this.thread.update(t => t.map(x => (x.key === item.key ? { ...x, state: 'failed', error: errText(e, 'تعذّر الإرسال') } : x))); },
		});
	}
	private bump(convId: string, m: MsgItem, mine: boolean) {
		this.conversations.update(l => {
			const c = l.find(x => x.id === convId); if (!c) return l;
			const upd: MsgConversation = { ...c, lastMessage: { body: m.body.slice(0, 140), at: m.createdAt, mine }, lastMessageAt: m.createdAt };
			return [upd, ...l.filter(x => x.id !== convId)];
		});
	}

	// ---- live ----
	private onLiveMessage(convId: string, m: MsgItem) {
		const known = this.conversations().find(c => c.id === convId);
		if (!known) { this.loadList(); return; }
		const mine = m.senderId !== known.counterpart.userId;
		const open = this.selectedId() === convId;
		if (open) {
			const peer = known.counterpart.userId;
			this.thread.update(t => (t.some(x => x.key === m.id) ? t : [...t.filter(x => !(x.state !== 'saved' && x.clientMessageId === m.clientMessageId)), { ...this.mapItem(m, peer), mine }]));
			this.scrollBottom();
		}
		this.bump(convId, m, mine);
		if (!mine) { if (open && this.visible()) this.markRead(); else this.conversations.update(l => l.map(c => (c.id === convId ? { ...c, unread: c.unread + 1 } : c))); }
	}
	private resync() { this.loadList(); const id = this.selectedId(); if (id) this.loadThread(id); }
	private visible() { return typeof document === 'undefined' || document.visibilityState === 'visible'; }

	/** read = this member has the conversation open and visible; never because a message merely arrived */
	markRead() {
		const id = this.selectedId(); if (!id || !this.visible()) return;
		const last = [...this.thread()].reverse().find(t => t.state === 'saved' && t.seq); if (!last?.seq) return;
		if (this.lastReadSent.get(id) === last.seq && (this.selected()?.unread ?? 0) === 0) return;
		this.lastReadSent.set(id, last.seq);
		this.api.read(id, last.seq).subscribe({ next: r => this.conversations.update(l => l.map(c => (c.id === id ? { ...c, unread: r.data.unread } : c))), error: () => this.lastReadSent.delete(id) });
	}

	// ---- start a conversation ----
	openNewChat() { this.newChatOpen.set(true); this.dirQ.set(''); this.loadDirectory(); }
	closeNewChat() { this.newChatOpen.set(false); }
	loadDirectory() { this.dirLoading.set(true); this.dirError.set(''); this.api.directory(this.dirQ().trim() || undefined).subscribe({ next: r => { this.directory.set(r.data); this.dirLoading.set(false); }, error: e => { this.dirLoading.set(false); this.dirError.set(errText(e, 'تعذّر تحميل دليل الموظفين')); } }); }
	onDirSearch(v: string) { this.dirQ.set(v); if (this.dirTimer) clearTimeout(this.dirTimer); this.dirTimer = setTimeout(() => this.loadDirectory(), 300); }
	startWith(p: MsgPerson) {
		if (this.startingId()) return; this.startingId.set(p.userId); this.dirError.set('');
		this.api.start(p.userId).subscribe({
			next: r => { this.startingId.set(''); this.conversations.update(l => (l.some(c => c.id === r.data.id) ? l : [r.data, ...l])); this.newChatOpen.set(false); this.search.set(''); this.openConversation(r.data.id); },
			error: e => { this.startingId.set(''); this.dirError.set(errText(e, 'تعذّر بدء المحادثة')); },
		});
	}

	// ---- display ----
	initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')) || '؟'; }
	hm(iso: string) { const d = new Date(iso); return `${two(d.getHours())}:${two(d.getMinutes())}`; }
	listTime(iso: string | null) {
		if (!iso) return ''; const d = new Date(iso), now = new Date(); if (sameDay(d, now)) return this.hm(iso);
		const y = new Date(now); y.setDate(now.getDate() - 1); return sameDay(d, y) ? 'أمس' : `${d.getDate()}/${d.getMonth() + 1}`;
	}
	dayLabel(iso: string) { const d = new Date(iso), now = new Date(); if (sameDay(d, now)) return 'اليوم'; const y = new Date(now); y.setDate(now.getDate() - 1); return sameDay(d, y) ? 'أمس' : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; }
	newDay(i: number) { const t = this.thread(); return i === 0 || !sameDay(new Date(t[i].createdAt), new Date(t[i - 1].createdAt)); }
	private scrollBottom() { setTimeout(() => { const el = this.scroller?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }, 0); }
}
