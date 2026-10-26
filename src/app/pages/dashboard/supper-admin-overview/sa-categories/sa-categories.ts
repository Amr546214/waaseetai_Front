import { WsBasePipe } from '../../../../shared/money/money.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsDateTextPipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface LevelRow { level: number; name: string; commissionPercent: number; color: string; thresholds: { points: number; projects: number; rating: number }; providers: number }
interface TopProvider { userId: string; name: string; specialty: string | null; level: number; levelName: string; points: number; rating: number; completedProjects: number; revenue: number; memberSince: string | null }
interface ProviderLevels { levels: LevelRow[]; totalProviders: number; providersWithoutLevelRow: number; topProviders: TopProvider[] }

@Component({
  selector: 'app-sa-categories',
  standalone: true,
  imports: [WsBasePipe, WsDateTextPipe, CommonModule, RouterLink],
  templateUrl: './sa-categories.html',
  styleUrl: './sa-categories.css',
})
export class SaCategories implements OnInit {
  private http = inject(HttpClient);

  data = signal<ProviderLevels | null>(null);
  loading = signal(true);
  error = signal('');
  searchTerm = signal('');

  /** The 15-level ladder is the owner-approved table (config file on the server): read-only here. */
  readonly readOnlyReason = 'مستويات مقدمي الخدمة معتمدة من ملف نسب المنصة ولا تُعدَّل من الواجهة';

  readonly levels = computed(() => this.data()?.levels ?? []);
  readonly maxProviders = computed(() => Math.max(1, ...this.levels().map((l) => l.providers)));
  readonly filteredProviders = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this.data()?.topProviders ?? [];
    return q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.specialty ?? '').toLowerCase().includes(q)) : list;
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ success: boolean; data: ProviderLevels }>(`${environment.url_api}/admin/users/provider-levels`).subscribe({
      next: (res) => { this.data.set(res.data); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.message || 'تعذر تحميل المستويات، حاول مرة أخرى'); this.loading.set(false); },
    });
  }

  initial(name: string) { return (name || '?').charAt(0); }
}
