import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface RoleRow { role: string; label: string; description: string; members: number }
interface Capability { key: string; label: string; admin: boolean; superAdmin: boolean }
interface RolesOverview { roles: RoleRow[]; accountTypes: { accountType: string; count: number }[]; suspendedAccounts: number; adminCapabilities: Capability[] }

const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: '#FF8C69', ADMIN: '#D98A0B', PROVIDER: '#59C1F5', CLIENT: '#2BD4C7', AFFILIATE: '#0FA99A' };
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CLIENT_INDIVIDUAL: 'طالب خدمة فرد', CLIENT_COMPANY: 'طالب خدمة شركة', PROVIDER_INDIVIDUAL: 'مقدم خدمة فرد', PROVIDER_COMPANY: 'مقدم خدمة شركة',
  MARKETING_BROKER: 'وسيط تسويقي', ADMIN: 'إداري', SUPER_ADMIN: 'مدير عام', EMPLOYEE: 'موظف',
};

@Component({
  selector: 'app-sa-roles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-roles.html',
  styleUrl: './sa-roles.css',
})
export class SaRoles implements OnInit {
  private http = inject(HttpClient);

  data = signal<RolesOverview | null>(null);
  loading = signal(true);
  error = signal('');

  /** Why the create / edit / toggle controls are disabled: there is no permissions model on the server yet. */
  readonly fixedRolesNote = 'الأدوار ثابتة في النظام ولا تُدار من هنا بعد';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ success: boolean; data: RolesOverview }>(`${environment.url_api}/admin/users/roles-overview`).subscribe({
      next: (res) => { this.data.set(res.data); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.message || 'تعذر تحميل الأدوار، حاول مرة أخرى'); this.loading.set(false); },
    });
  }

  color(role: string) { return ROLE_COLORS[role] ?? '#5DA0FF'; }
  typeLabel(t: string) { return ACCOUNT_TYPE_LABELS[t] ?? t; }
}
