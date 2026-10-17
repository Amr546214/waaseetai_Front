import type { AssistantMessage } from '../store/assistant.store';
import { isObsoleteKnowledgeRefusal, normalizeAssistantMessageText } from './assistant-errors';

export interface AssistantConversation {
	id: string;
	title: string;
	updatedAt: number;
	pinned?: boolean;
	messages: AssistantMessage[];
}
export interface AssistantHistory {
	version: 2;
	conversations: AssistantConversation[];
	activeId: string | null;
}
export const HISTORY_LIMIT = 20;
export const emptyHistory = (): AssistantHistory => ({ version: 2, conversations: [], activeId: null });
export function newConversationId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function conversationTitle(messages: readonly AssistantMessage[]): string {
	return messages.find(m => m.role === 'user')?.text.replace(/\s+/g, ' ').trim().slice(0, 70) || 'محادثة جديدة';
}
export function cleanMessages(value: unknown): AssistantMessage[] {
	if (!Array.isArray(value)) return [];
	return value.filter(m => m && !m.streaming && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string' && m.text.length <= 30_000).slice(-100).map(m => ({
		role: m.role, text: normalizeAssistantMessageText(m.text, m.role),
		...(Number.isFinite(m.createdAt) ? { createdAt: m.createdAt } : {}),
		...(Array.isArray(m.citations) && !(m.role === 'assistant' && isObsoleteKnowledgeRefusal(m.text)) ? { citations: m.citations.filter((c: any) => c && typeof c.title === 'string' && typeof c.docId === 'string').slice(0, 20).map((c: any) => ({ docId: c.docId.slice(0, 500), title: c.title.slice(0, 500), ...(typeof c.url === 'string' ? { url: c.url.slice(0, 2048) } : {}), ...(typeof c.section === 'string' ? { section: c.section.slice(0, 500) } : {}), ...(Number.isFinite(c.line) ? { line: c.line } : {}) })) } : {}),
	}));
}
export function readHistory(raw: string | null): AssistantHistory {
	try {
		const value = JSON.parse(raw ?? 'null');
		if (value?.version === 1 && Array.isArray(value.messages)) {
			const messages = cleanMessages(value.messages);
			if (!messages.length) return emptyHistory();
			const id = newConversationId();
			return { version: 2, activeId: id, conversations: [{ id, title: conversationTitle(messages), updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(), messages }] };
		}
		if (value?.version !== 2 || !Array.isArray(value.conversations)) return emptyHistory();
		const ids = new Set<string>();
		const conversations: AssistantConversation[] = [];
		for (const c of value.conversations) {
			if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 200 || ids.has(c.id) || !Number.isFinite(c.updatedAt)) continue;
			ids.add(c.id);
			const messages = cleanMessages(c.messages);
			conversations.push({ id: c.id, title: typeof c.title === 'string' && c.title.trim() ? c.title.trim().slice(0, 70) : conversationTitle(messages), updatedAt: c.updatedAt, pinned: c.pinned === true, messages });
		}
		conversations.sort((a, b) => b.updatedAt - a.updatedAt);
		const active = conversations.find(c => c.id === value.activeId);
		const bounded = conversations.slice(0, HISTORY_LIMIT);
		if (active && !bounded.includes(active)) bounded[bounded.length - 1] = active;
		return { version: 2, conversations: bounded, activeId: active?.id ?? bounded[0]?.id ?? null };
	} catch { return emptyHistory(); }
}
/** Imports create fresh ids, so a file cannot overwrite another local conversation. */
export function mergeHistory(current: AssistantHistory, imported: unknown): AssistantHistory {
	const parsed = readHistory(JSON.stringify(imported));
	const incoming = parsed.conversations.map(c => ({ ...c, id: newConversationId(), updatedAt: Date.now() }));
	return readHistory(JSON.stringify({ version: 2, activeId: current.activeId, conversations: [...incoming, ...current.conversations] }));
}
