import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';
export interface OperationsAccess {
  officialDeployment: boolean;
  isSuperAdmin: boolean;
  available: boolean;
}
@Injectable({ providedIn: 'root' })
export class OperationsPanelService {
  private http = inject(HttpClient);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  private auth = inject(AuthStore);
  private request?: Subscription;
  private generation = 0;
  private caller = this.identity();
  readonly state = signal<OperationsAccess | null>(null);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly available = computed(
    () => this.identity() === this.caller && this.state()?.available === true,
  );
  constructor() {
    effect(() => {
      const next = this.identity();
      if (next !== this.caller) {
        this.caller = next;
        untracked(() => {
          this.reset();
          this.load();
        });
      }
    });
  }
  private identity() {
    const u = this.auth.currentUser();
    return u ? `${u.id}|${u.accountType}` : '';
  }
  private reset() {
    this.generation++;
    this.request?.unsubscribe();
    this.state.set(null);
    this.loaded.set(false);
    this.error.set('');
  }
  load(force = false) {
    if (!this.browser) return;
    const current = this.identity();
    if (current !== this.caller) {
      this.caller = current;
      this.reset();
    }
    const type = String(this.auth.currentUser()?.accountType || '');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(type)) {
      this.state.set({ officialDeployment: false, isSuperAdmin: false, available: false });
      return;
    }
    if (this.loaded() && !force) return;
    this.request?.unsubscribe();
    const generation = ++this.generation;
    this.loaded.set(true);
    this.error.set('');
    this.request = this.http
      .get<{ data: OperationsAccess }>(`${environment.url_api}/admin/system-settings/access`)
      .subscribe({
        next: (r) => {
          if (generation === this.generation && current === this.identity()) this.state.set(r.data);
        },
        error: () => {
          if (generation !== this.generation || current !== this.identity()) return;
          this.loaded.set(false);
          this.state.set(null);
          this.error.set('تعذر التحقق من صلاحية لوحة التشغيل؛ أعد المحاولة.');
        },
      });
  }
}
