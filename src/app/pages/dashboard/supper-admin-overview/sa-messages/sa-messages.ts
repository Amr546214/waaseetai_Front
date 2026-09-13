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
  conversations = signal<Conversation[]>([
    {
      id: 'c1', name: 'أحمد الغامدي', role: 'طالب خدمة فرد', type: 'sk', avatar: 'أح',
      lastMessage: 'تمام، سأراجع المستندات وأرد خلال ساعة', time: '10:42', unread: 0, online: true,
      messages: [
        { from: 'other', text: 'مرحباً، وصلني إشعار بأنك قبلت عرضي على مشروع تطوير الموقع. هل يمكننا مناقشة التفاصيل؟', time: '10:15' },
        { from: 'me', text: 'أهلاً أحمد، نعم وافقت على العرض. هل يمكنك توضيح المراحل التي تتبعها في التطوير؟', time: '10:28' },
        { from: 'other', text: 'بالتأكيد. المرحلة الأولى: تصميم الواجهة (أسبوع). المرحلة الثانية: التطوير (أسبوعان). المرحلة الثالثة: الاختبار والإطلاق (أسبوع). المجموع 4 أسابيع.', time: '10:33' },
        { from: 'me', text: 'ممتاز، هذا مناسب. هل يمكنك إرسال ملف بمتطلبات المشروع قبل توقيع العقد؟', time: '10:38' },
        { from: 'other', text: 'تمام، سأراجع المستندات وأرد خلال ساعة', time: '10:42' },
      ],
    },
    {
      id: 'c2', name: 'شركة التقنية المتقدمة', role: 'طالب خدمة شركة', type: 'co', avatar: 'شت',
      lastMessage: 'هل يمكن تعديل الموعد النهائي؟', time: 'أمس', unread: 3, online: false,
      messages: [
        { from: 'other', text: 'مرحباً، نود مراجعة بعض بنود العقد قبل التوقيع النهائي.', time: 'أمس 2:10 م' },
        { from: 'me', text: 'أهلاً بكم، تفضلوا بذكر البنود التي تودون مناقشتها.', time: 'أمس 2:30 م' },
        { from: 'other', text: 'هل يمكن تعديل الموعد النهائي؟', time: 'أمس 3:05 م' },
      ],
    },
    {
      id: 'c3', name: 'محمد الحربي', role: 'مقدم خدمة فرد', type: 'pr', avatar: 'مح',
      lastMessage: 'شكراً على التعاون', time: 'الأحد', unread: 0, online: false,
      messages: [
        { from: 'other', text: 'تم تسليم كافة الملفات النهائية للمشروع.', time: 'الأحد 11:00 ص' },
        { from: 'me', text: 'تم الاستلام والمراجعة، كل شيء ممتاز. شكراً لك.', time: 'الأحد 11:20 ص' },
        { from: 'other', text: 'شكراً على التعاون', time: 'الأحد 11:22 ص' },
      ],
    },
    {
      id: 'c4', name: 'سارة الزهراني', role: 'طالب خدمة فرد', type: 'sk', avatar: 'سز',
      lastMessage: 'أرسلت الملف المعدّل برجاء المراجعة', time: 'السبت', unread: 1, online: true,
      messages: [
        { from: 'other', text: 'أرسلت الملف المعدّل برجاء المراجعة', time: 'السبت 9:40 ص' },
      ],
    },
    {
      id: 'c5', name: 'فهد العتيبي', role: 'مقدم خدمة فرد', type: 'pr', avatar: 'فع',
      lastMessage: 'تم إنهاء المشروع بنجاح', time: '9/9', unread: 0, online: false,
      messages: [
        { from: 'other', text: 'تم إنهاء المشروع بنجاح', time: '9/9 4:00 م' },
      ],
    },
    {
      id: 'c6', name: 'نورة القحطاني', role: 'وسيط تسويقي', type: 'co', avatar: 'نق',
      lastMessage: 'سأرسل العقد المعدّل غداً', time: '7/9', unread: 0, online: false,
      messages: [
        { from: 'other', text: 'سأرسل العقد المعدّل غداً', time: '7/9 1:15 م' },
      ],
    },
  ]);

  searchTerm = signal('');
  selectedId = signal<string>('c1');
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
