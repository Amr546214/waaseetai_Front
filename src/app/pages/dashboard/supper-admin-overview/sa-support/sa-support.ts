import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type TicketStatus = 'open' | 'pending' | 'escalated' | 'resolved';
type FilterKey = 'all' | TicketStatus;

interface TicketMessage {
  from: 'user' | 'admin';
  text: string;
  time: string;
}

interface Ticket {
  id: string;
  subject: string;
  user: string;
  userAv: string;
  userBg: string;
  userType: string;
  category: string;
  status: TicketStatus;
  priority: 'high' | 'medium' | 'low';
  time: string;
  messages: TicketMessage[];
}

@Component({
  selector: 'app-sa-support',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-support.html',
  styleUrl: './sa-support.css',
})
export class SaSupport {
  toast = signal('');
  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  activeTicketId = signal<string | null>(null);
  draftReply = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'pending', label: 'بانتظار رد المستخدم' },
    { key: 'escalated', label: 'مصعَّد' },
  ];

  tickets = signal<Ticket[]>([
    {
      id: 'TK-2841', subject: 'لم يصلني المبلغ بعد إغلاق المشروع', user: 'محمد العمري', userAv: 'م', userBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      userType: 'مقدم فرد', category: 'الدفع والمالية', status: 'open', priority: 'high', time: 'قبل 2 ساعة',
      messages: [
        { from: 'user', text: 'أكملت المشروع قبل يومين وأغلقه الطالب لكن لم يصلني أي مبلغ.', time: 'اليوم 10:00 ص' },
        { from: 'admin', text: 'نتحقق من ذلك الآن. هل يمكنك مشاركة رقم المشروع؟', time: 'اليوم 10:15 ص' },
        { from: 'user', text: 'رقم المشروع PR-1285.', time: 'اليوم 10:20 ص' },
      ],
    },
    {
      id: 'TK-2838', subject: 'مشكلة في رفع ملف التسليم', user: 'سارة القحطاني', userAv: 'س', userBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
      userType: 'مقدم فرد', category: 'التقنية', status: 'open', priority: 'medium', time: 'قبل 4 ساعات',
      messages: [{ from: 'user', text: 'عندما أحاول رفع ملف PSD تظهر رسالة خطأ ولا يكتمل الرفع.', time: 'اليوم 8:30 ص' }],
    },
    {
      id: 'TK-2835', subject: 'الطالب لا يستجيب منذ أسبوع', user: 'أحمد الزهراني', userAv: 'أ', userBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      userType: 'مقدم فرد', category: 'العقود', status: 'escalated', priority: 'high', time: 'قبل يوم',
      messages: [
        { from: 'user', text: 'وقّعت العقد منذ أسبوع والطالب لا يرد على الرسائل ولا يُفرِج عن الضمان.', time: 'أمس 3:00 م' },
        { from: 'admin', text: 'سنراجع الحالة وسنتواصل مع الطالب مباشرة.', time: 'أمس 4:00 م' },
      ],
    },
    {
      id: 'TK-2830', subject: 'خطأ في فاتورة الاشتراك', user: 'شركة الخليج التقنية', userAv: 'خ', userBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      userType: 'طالب شركة', category: 'الدفع والمالية', status: 'pending', priority: 'low', time: 'قبل يومين',
      messages: [{ from: 'user', text: 'الفاتورة الشهرية أكبر من المبلغ المتفق عليه عند الاشتراك.', time: '2 يوليو 2026' }],
    },
    {
      id: 'TK-2825', subject: 'لا أستطيع الدخول لحسابي', user: 'نواف الحربي', userAv: 'ن', userBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      userType: 'طالب فرد', category: 'الحسابات', status: 'open', priority: 'medium', time: 'قبل 3 أيام',
      messages: [{ from: 'user', text: 'حاولت تسجيل الدخول بالبريد والرقم السري لكن يقول بيانات غير صحيحة.', time: '12 يوليو 2026' }],
    },
    {
      id: 'TK-2810', subject: 'استفسار عن رسوم العمولة', user: 'ريم البلوي', userAv: 'ر', userBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
      userType: 'مقدم فرد', category: 'أخرى', status: 'resolved', priority: 'low', time: 'قبل أسبوع',
      messages: [
        { from: 'user', text: 'ما هي نسبة عمولة المنصة على المشاريع؟', time: '5 يوليو 2026' },
        { from: 'admin', text: 'العمولة 10% من قيمة المشروع، وتقل مع ارتفاع مستوى العضوية.', time: '5 يوليو 2026' },
      ],
    },
  ]);

  filteredTickets = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.tickets().filter((t) => {
      const matchesFilter = f === 'all' || t.status === f;
      const matchesSearch = !q || t.id.toLowerCase().includes(q) || t.user.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  activeTicket = computed(() => this.tickets().find((t) => t.id === this.activeTicketId()) ?? null);

  counts = computed(() => {
    const list = this.tickets();
    return {
      all: list.length,
      open: list.filter((t) => t.status === 'open').length,
      pending: list.filter((t) => t.status === 'pending').length,
      escalated: list.filter((t) => t.status === 'escalated').length,
      resolved: list.filter((t) => t.status === 'resolved').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  openTicket(ticket: Ticket) {
    this.activeTicketId.set(ticket.id);
    this.draftReply.set('');
  }

  sendReply() {
    const text = this.draftReply().trim();
    const ticket = this.activeTicket();
    if (!text || !ticket) return;
    this.tickets.update((list) =>
      list.map((t) =>
        t.id === ticket.id
          ? { ...t, messages: [...t.messages, { from: 'admin', text, time: 'الآن' }] }
          : t
      )
    );
    this.draftReply.set('');
  }

  closeTicket() {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this.tickets.update((list) => list.map((t) => (t.id === ticket.id ? { ...t, status: 'resolved' as TicketStatus } : t)));
    this.showToast(`تم إغلاق التذكرة ${ticket.id}`);
  }

  escalateTicket() {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this.tickets.update((list) => list.map((t) => (t.id === ticket.id ? { ...t, status: 'escalated' as TicketStatus } : t)));
    this.showToast(`تم تصعيد التذكرة ${ticket.id}`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
