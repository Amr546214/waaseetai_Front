import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

interface Message { id: string; body: string; authorKind: 'PARTICIPANT' | 'STAFF'; own: boolean; createdAt: string; }
interface Thread { messages: Message[]; before: string | null; canSend: boolean; open: boolean; }

@Component({
  selector: 'app-dispute-chat',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="thread" aria-label="محادثة النزاع">
      <header>
        <h3>محادثة النزاع</h3>
        <button type="button" (click)="load()" [disabled]="loading() || sending()">تحديث الرسائل</button>
      </header>
      <p class="hint">الرسائل هنا مرئية لطرفي النزاع والإدارة.</p>
      @if (loadError()) { <p role="alert">{{ loadError() }}</p> }
      @if (loading()) { <p role="status">جاري تحميل الرسائل…</p> }
      @if (loaded() && !messages().length && !loading()) { <p>لا توجد رسائل بعد.</p> }
      @if (before()) { <button type="button" (click)="load(true)" [disabled]="loading() || sending()">عرض رسائل أقدم</button> }
      <ol aria-label="رسائل النزاع">
        @for (message of messages(); track message.id) {
          <li [class.own]="message.own">
            <div class="meta">
              <strong>{{ message.own ? 'أنت' : message.authorKind === 'STAFF' ? 'إدارة النزاع' : 'طرف النزاع' }}</strong>
              <time [attr.datetime]="message.createdAt">{{ message.createdAt | date:'short' }}</time>
            </div>
            <p>{{ message.body }}</p>
          </li>
        }
      </ol>
      @if (loaded() && canSend()) {
        <form (submit)="send($event)">
          <label>
            رسالة إلى أطراف النزاع
            <textarea rows="3" maxlength="2000" [value]="draft()" (input)="draft.set($any($event.target).value)" [disabled]="sending()" required></textarea>
          </label>
          <button type="submit" [disabled]="sending() || loading() || !draft().trim()">إرسال الرسالة</button>
        </form>
      } @else if (loaded()) {
        <p class="hint">{{ open() ? 'يمكنك قراءة المحادثة، لكن لا تملك صلاحية الإرسال.' : 'النزاع مغلق. الرسائل السابقة للقراءة فقط.' }}</p>
      }
      @if (sendError()) { <p role="alert">{{ sendError() }}</p> }
    </section>
  `,
  styles: [`
    .thread { display: grid; gap: .65rem; padding: 1rem; border: 1px solid var(--border, #445065); border-radius: .75rem; }
    header, .meta { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
    h3, p, ol { margin: 0; }
    .hint, time { opacity: .8; font-size: .85rem; }
    ol { list-style: none; padding: 0; display: grid; gap: .5rem; max-height: 26rem; overflow-y: auto; }
    li { padding: .6rem .75rem; border: 1px solid var(--border, #445065); border-radius: .5rem; min-width: 0; }
    li.own { border-inline-start: 3px solid var(--primary, #29b9c5); }
    li p { white-space: pre-wrap; overflow-wrap: anywhere; }
    form, label { display: grid; gap: .4rem; }
    textarea, button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--border, #445065); border-radius: .45rem; padding: .4rem .65rem; }
    textarea { width: 100%; resize: vertical; }
    button { width: fit-content; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    [role=alert] { color: var(--red, #ff8c69); }
  `],
})
export class DisputeChat {
  readonly path = input.required<string>();
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private generation = 0;
  readonly messages = signal<Message[]>([]);
  readonly before = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly open = signal(false);
  readonly canSend = signal(false);
  readonly sending = signal(false);
  readonly draft = signal('');
  readonly loadError = signal('');
  readonly sendError = signal('');

  constructor() {
    effect(() => {
      this.path();
      untracked(() => {
        ++this.generation;
        this.messages.set([]);
        this.before.set(null);
        this.loaded.set(false);
        this.canSend.set(false);
        this.loading.set(false);
        this.sending.set(false);
        this.draft.set('');
        this.sendError.set('');
        this.load();
      });
    });
  }

  private url(): string { return `${environment.url_api}/${this.path()}/messages`; }

  load(older = false): void {
    if (this.loading()) return;
    const cursor = older ? this.before() : null;
    if (older && !cursor) return;
    const run = this.generation;
    this.loading.set(true);
    this.loadError.set('');
    const params = cursor ? new HttpParams().set('before', cursor) : new HttpParams();
    this.http.get<{ data: Thread }>(this.url(), { params }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (this.generation === run) this.loading.set(false); }),
    ).subscribe({
      next: ({ data }) => {
        if (run !== this.generation) return;
        this.messages.update(current => older
          ? [...data.messages, ...current.filter(message => !data.messages.some(previous => previous.id === message.id))]
          : data.messages);
        this.before.set(data.before);
        this.canSend.set(data.canSend);
        this.open.set(data.open);
        this.loaded.set(true);
      },
      error: () => { if (run === this.generation) this.loadError.set('تعذّر تحميل رسائل النزاع. حاول التحديث مرة أخرى.'); },
    });
  }

  send(event: Event): void {
    event.preventDefault();
    const body = this.draft().trim();
    if (!this.canSend() || this.sending() || this.loading() || !body || body.length > 2000) return;
    const run = this.generation;
    this.sending.set(true);
    this.sendError.set('');
    this.http.post<{ data: Message }>(this.url(), { body }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (this.generation === run) this.sending.set(false); }),
    ).subscribe({
      next: ({ data }) => {
        if (run !== this.generation) return;
        this.messages.update(current => current.some(message => message.id === data.id) ? current : [...current, data]);
        this.draft.set('');
      },
      error: (error: HttpErrorResponse) => {
        if (run !== this.generation) return;
        if (error.status === 403 || error.status === 409) {
          this.canSend.set(false);
          this.load();
        }
        this.sendError.set(error.status === 409 ? 'النزاع مغلق؛ لم تُرسل الرسالة.' : error.status === 403
          ? 'ليست لديك صلاحية الإرسال.' : 'تعذّر إرسال الرسالة. حدّث المحادثة قبل إعادة المحاولة.');
      },
    });
  }
}
