import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/** No backend source exists for this page: it shows an honest empty state and disabled actions with a visible reason. */
@Component({
  selector: 'app-sa-future-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-future-billing.html',
  styleUrl: './sa-future-billing.css',
})
export class SaFutureBilling {
  readonly emptyTitle = 'الفوترة المستقبلية غير مفعّلة';
  readonly emptyReason = 'لا توجد فوترة مجدولة أو تكامل فوترة خارجي في المنصة حاليًا؛ لذلك لا تُعرض فواتير أو أرقام. الإجراءات أدناه معطّلة لهذا السبب.';
}
