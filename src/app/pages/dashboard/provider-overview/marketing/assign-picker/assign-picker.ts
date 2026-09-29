import { Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import { avatarGradient, initials } from '../marketing-utils';

/**
 * Company-only "الإسناد" combobox (P-CO-MK-006/007 إنشاء): pick a team member
 * from the real company roster, or "كل الشركة" (null).
 */
@Component({
  selector: 'app-marketing-assign-picker',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['../marketing-shared.css'],
  template: `
    <div class="assign-combo">
      <button type="button" class="assign-trigger" [class.open]="open()" (click)="open.set(!open())" [disabled]="disabled()">
        @if (selectedMember(); as m) {
          <span class="assign-av" [style.background]="bg(m.id)">{{ ini(m.name) }}</span><span>{{ m.name }}</span>
        } @else {
          <span class="assign-av">★</span><span>كل الشركة</span>
        }
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      @if (open()) {
        <div class="assign-panel">
          <input class="f-inp assign-search" type="search" placeholder="ابحث باسم عضو الفريق..." [ngModel]="query()" (ngModelChange)="query.set($event)">
          <div class="assign-grid">
            @if (!query()) {
              <div class="assign-card" [class.sel]="!value()" (click)="pick(null)">
                <div class="assign-av">★</div>
                <div class="assign-b"><div class="assign-name">كل الشركة</div><div class="assign-meta">لا يختص بعضو معيّن — يشمل كل مقدّمي الخدمة</div></div>
                <div class="assign-check"></div>
              </div>
            }
            @for (m of filtered(); track m.id) {
              <div class="assign-card" [class.sel]="value() === m.id" (click)="pick(m.id)">
                <div class="assign-av" [style.background]="bg(m.id)">{{ ini(m.name) }}</div>
                <div class="assign-b"><div class="assign-name">{{ m.name }}</div><div class="assign-meta">{{ m.jobTitle }}{{ m.status !== 'ACTIVE' ? ' · ' + (m.status === 'PENDING' ? 'دعوة معلقة' : 'غير نشط') : '' }}</div></div>
                <div class="assign-check"></div>
              </div>
            }
            @if (!filtered().length && (query() || !members().length)) {
              <div class="assign-empty">{{ members().length ? 'لا يوجد عضو مطابق' : 'لا يوجد أعضاء في فريق الشركة بعد' }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MarketingAssignPicker {
  private host = inject(ElementRef<HTMLElement>);

  members = input<CompanyTeamMember[]>([]);
  disabled = input<boolean>(false);
  value = model<string | null>(null);

  open = signal(false);
  query = signal('');

  readonly ini = initials;
  readonly bg = avatarGradient;

  selectedMember = computed(() => this.members().find(m => m.id === this.value()) ?? null);
  filtered = computed(() => {
    const q = this.query().trim();
    return this.members().filter(m => !q || m.name.includes(q) || m.jobTitle.includes(q));
  });

  pick(id: string | null): void {
    this.value.set(id);
    this.open.set(false);
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }
}
