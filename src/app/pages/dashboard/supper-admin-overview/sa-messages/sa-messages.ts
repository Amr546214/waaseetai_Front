import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type PartyType = 'sk' | 'pr' | 'co';

interface ChatMessage {
  from: 'me' | 'other';
  text: string;
  time: string;
}

interface Conversation {
  id: string;
  name: string;
  role: string;
  type: PartyType;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-sa-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-messages.html',
  styleUrl: './sa-messages.css',
})
export class SaMessages {
  // No admin conversations endpoint exists: the page used to ship six invented people/threads (with a fake online flag).
  // It now starts empty instead of presenting invented conversations.
  conversations = signal<Conversation[]>([]);

  searchTerm = signal('');
  selectedId = signal<string>('');
  draft = signal('');

  filteredConversations = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this.conversations();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q));
  });

  selected = computed(() => this.conversations().find((c) => c.id === this.selectedId()) ?? null);

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  openConversation(id: string) {
    this.selectedId.set(id);
    this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  onDraftChange(value: string) {
    this.draft.set(value);
  }

  sendMessage() {
    const text = this.draft().trim();
    const conv = this.selected();
    if (!text || !conv) return;
    const now = new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    this.conversations.update((list) =>
      list.map((c) =>
        c.id === conv.id
          ? { ...c, messages: [...c.messages, { from: 'me', text, time: now }], lastMessage: text, time: now }
          : c,
      ),
    );
    this.draft.set('');
  }
}
