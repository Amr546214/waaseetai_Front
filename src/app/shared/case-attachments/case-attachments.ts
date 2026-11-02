import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CaseFile { id: string; name: string; mimeType: string; bytes: number; ownerId: string; createdAt: string }
interface Reply<T> { success: boolean; data?: T; message?: string }

@Component({
  selector: 'app-case-attachments', standalone: true,
  template: `<section class="files" aria-label="المرفقات">
    <h3>{{ writable ? 'أدلة النزاع' : 'المرفقات' }}</h3>
    @if (loading()) { <p role="status">جارٍ تحميل المرفقات…</p> }
    @if (loadError()) { <p role="alert">{{ loadError() }}</p><button type="button" (click)="load()">إعادة تحميل المرفقات</button> }
    @for (file of files(); track file.id) {
      <div class="file"><button type="button" [disabled]="opening()" (click)="open(file)">{{ file.name }}</button><small>{{ (file.bytes / 1024).toFixed(1) }} KB</small></div>
    }
    @if (!loading() && !loadError() && !files().length) { <p>لا توجد مرفقات إضافية</p> }
    @if (writable) {
      <label>إضافة أدلة (JPG، PNG، PDF — خمسة ملفات، 10 ميجابايت لكل ملف)
        <input type="file" multiple accept="image/jpeg,image/png,application/pdf" [disabled]="saving()" (change)="select($event)" />
      </label>
      @for (file of selected; track $index) { <div class="file"><span>{{ file.name }}</span><button type="button" [disabled]="saving()" (click)="remove($index)">إزالة</button></div> }
      <button type="button" [disabled]="saving() || !selected.length" (click)="upload()">{{ saving() ? 'جارٍ حفظ الأدلة…' : 'حفظ الأدلة' }}</button>
    }
    @if (actionError()) { <p role="alert">{{ actionError() }}</p> }
    @if (saved()) { <p role="status">تم حفظ الأدلة في النزاع</p> }
  </section>`,
  styles: [`.files{margin:16px 0;padding:16px;border:1px solid var(--bdr,#64748b);border-radius:12px;overflow-wrap:anywhere;color:inherit}.file{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0}button{cursor:pointer;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:6px 10px}button:disabled{opacity:.5;cursor:default}input{display:block;max-width:100%;margin:8px 0}small{opacity:.7}p{margin:8px 0}`],
})
export class CaseAttachments implements OnChanges, OnDestroy {
  @Input({ required: true }) path = '';
  @Input() writable = false;
  private http = inject(HttpClient);
  private subscriptions = new Subscription();
  files = signal<CaseFile[]>([]); loading = signal(false); loadError = signal('');
  saving = signal(false); opening = signal(false); actionError = signal(''); saved = signal(false);
  selected: File[] = [];
  private requestKey = crypto.randomUUID();
  private pendingTab: Window | null = null;
  private endpoint() { return `${environment.url_api}/${this.path}/attachments`; }
  ngOnChanges(changes?: SimpleChanges) {
    if (changes && !changes['path']) return;
    this.subscriptions.unsubscribe(); this.subscriptions = new Subscription();
    this.pendingTab?.close(); this.pendingTab = null;
    this.selected = []; this.files.set([]); this.requestKey = crypto.randomUUID();
    this.saving.set(false); this.opening.set(false); this.actionError.set(''); this.saved.set(false); this.load();
  }
  ngOnDestroy() { this.subscriptions.unsubscribe(); this.pendingTab?.close(); }
  load() {
    if (!this.path) return;
    this.loading.set(true); this.loadError.set('');
    this.subscriptions.add(this.http.get<Reply<CaseFile[]>>(this.endpoint()).subscribe({
      next: r => { this.loading.set(false); if (r.success && Array.isArray(r.data)) this.files.set(r.data); else this.loadError.set('تعذر تحميل المرفقات'); },
      error: () => { this.loading.set(false); this.loadError.set('تعذر تحميل المرفقات؛ لم تُحذف ملفاتك'); },
    }));
  }
  select(event: Event) {
    const input = event.target as HTMLInputElement; const files = [...this.selected, ...Array.from(input.files || [])]; input.value = '';
    this.actionError.set(''); this.saved.set(false);
    if (files.length > 5 || files.some(f => !['image/jpeg','image/png','application/pdf'].includes(f.type) || !f.size || f.size > 10 * 1024 * 1024)) {
      this.actionError.set('اختر حتى خمسة ملفات JPG أو PNG أو PDF، بحد أقصى 10 ميجابايت لكل ملف'); return;
    }
    this.selected = files; this.requestKey = crypto.randomUUID();
  }
  remove(index: number) { this.selected = this.selected.filter((_, i) => i !== index); this.requestKey = crypto.randomUUID(); this.saved.set(false); }
  upload() {
    if (!this.writable || this.saving() || !this.selected.length) return;
    const body = new FormData(); body.append('requestKey', this.requestKey); this.selected.forEach(f => body.append('attachments', f));
    this.saving.set(true); this.actionError.set(''); this.saved.set(false);
    this.subscriptions.add(this.http.post<Reply<CaseFile[]>>(this.endpoint(), body).subscribe({
      next: r => { this.saving.set(false); if (r.success && Array.isArray(r.data)) { this.files.set(r.data); this.selected = []; this.requestKey = crypto.randomUUID(); this.saved.set(true); } else this.actionError.set(r.message || 'تعذر حفظ الأدلة'); },
      error: e => { this.saving.set(false); this.actionError.set(e?.error?.message || 'تعذر حفظ الأدلة؛ الملفات المختارة محفوظة لإعادة المحاولة'); },
    }));
  }
  open(file: CaseFile) {
    if (this.opening()) return;
    const tab = window.open('about:blank', '_blank'); this.pendingTab = tab; if (tab) tab.opener = null;
    this.opening.set(true); this.actionError.set('');
    this.subscriptions.add(this.http.get<Reply<{url: string}>>(`${this.endpoint()}/${encodeURIComponent(file.id)}/download`).subscribe({
      next: r => { this.opening.set(false); this.pendingTab = null; if (r.success && r.data?.url.startsWith('https://') && tab) tab.location.replace(r.data.url); else { tab?.close(); this.actionError.set('تعذر فتح المرفق؛ تحقق من السماح بالنوافذ المنبثقة'); } },
      error: e => { this.opening.set(false); this.pendingTab = null; tab?.close(); this.actionError.set(e?.error?.message || 'تعذر فتح المرفق'); },
    }));
  }
}
