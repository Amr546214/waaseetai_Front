import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SUPPORT_AGENTS, SUPPORT_TICKETS, Ticket, TicketStatus } from '../sa-support.data';

@Component({
  selector: 'app-sa-support-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-support-detail.html',
  styleUrls: ['../sa-support.css', './sa-support-detail.css'],
})
export class SaSupportDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  toast = signal('');
  activeTicketId = signal<string | null>(null);
  draftReply = signal('');
  draftNote = signal('');
  showReassign = signal(false);

  readonly agents: string[] = SUPPORT_AGENTS;

  // MOCK — see sa-support.data.ts. Replies/notes/reassign/close/escalate only
  // update this local signal (no support-tickets backend yet); nothing is persisted.
  tickets = signal<Ticket[]>(SUPPORT_TICKETS);

  activeTicket = computed(() => this.tickets().find((t) => String(t.id) === this.activeTicketId()) ?? null);

  slaLate = computed(() => {
    const t = this.activeTicket();
    if (!t) return false;
    return t.responseHours > t.slaTargetHours;
  });

  slaProgressPct = computed(() => {
    const t = this.activeTicket();
    if (!t) return 0;
    const pct = Math.round((t.responseHours / t.slaTargetHours) * 100);
    return Math.min(pct, 100);
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.activeTicketId.set(params.get('id'));
      this.draftReply.set('');
      this.draftNote.set('');
      this.showReassign.set(false);
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/support']);
  }

  openRelated(id: string) {
    const t = this.tickets().find((x) => x.id === id);
    if (t) this.router.navigate(['/supper-admin-overview/support', t.id]);
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

  addNote() {
    const text = this.draftNote().trim();
    const ticket = this.activeTicket();
    if (!text || !ticket) return;
    this.tickets.update((list) =>
      list.map((t) =>
        t.id === ticket.id
          ? { ...t, notes: [...t.notes, { author: 'مدير النظام', time: 'الآن', text }] }
          : t
      )
    );
    this.draftNote.set('');
  }

  toggleReassign() {
    this.showReassign.update((v) => !v);
  }

  reassignAgent(agent: string) {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this.tickets.update((list) => list.map((t) => (t.id === ticket.id ? { ...t, assignedAgent: agent } : t)));
    this.showReassign.set(false);
    this.showToast(`تم إعادة تكليف التذكرة ${ticket.id} إلى ${agent}`);
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
