import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { EscalationReadiness, SystemSettingsApi } from '../../../../../core/services/system-settings.store';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

const STATE: Record<string, string> = { ELIGIBLE: 'مؤهَّل', MISSING: 'لم يُحدَّد', NOT_FOUND: 'غير موجود', INACTIVE: 'حساب غير نشط', NOT_STAFF: 'ليس عضو فريق إداري', STAFF_INACTIVE: 'عضو فريق غير نشط', LACKS_PERMISSION: 'تنقصه صلاحيات', UNKNOWN: 'تعذّر التحقق' };
const SOURCE: Record<string, string> = { explicit: 'من إعداد صريح', default: 'القيم الافتراضية المضمّنة (لم يُحدَّد إعداد)', invalid: 'إعداد غير صالح' };

/** Read-only readiness of the AUTOMATIC support / dispute escalation. It never enables, schedules, assigns or notifies anything: there is deliberately no control on this page. */
@Component({
  selector: 'app-sa-escalation-readiness',
  standalone: true,
  imports: [RouterLink, WsDatePipe],
  templateUrl: './sa-escalation-readiness.html',
  styleUrl: '../sa-monitoring/sa-monitoring.css',
})
export class SaEscalationReadiness implements OnInit {
  private readonly api = inject(SystemSettingsApi);
  readonly data = signal<EscalationReadiness | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly state = STATE;
  readonly source = SOURCE;

  ngOnInit() { this.load(); }
  load() {
    this.busy.set(true); this.error.set('');
    this.api.escalationReadiness().pipe(timeout(12_000)).subscribe({
      next: r => { this.busy.set(false); if (r.success && r.data && Array.isArray(r.data.preconditions)) this.data.set(r.data); else this.error.set('تعذّر قراءة جاهزية التصعيد.'); },
      error: e => { this.busy.set(false); this.error.set(e?.status === 403 ? 'ليست لديك صلاحية لقراءة جاهزية التصعيد.' : 'تعذّر قراءة جاهزية التصعيد.'); },
    });
  }
}
