import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/** No backend source exists for this page: it shows an honest empty state and disabled actions with a visible reason. */
@Component({
  selector: 'app-sa-cashback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-cashback.html',
  styleUrl: './sa-cashback.css',
})
export class SaCashback {
  readonly emptyTitle = 'الكاش باك قيد القرار ولم يُفعَّل بعد';
  readonly emptyReason = 'لم يُعتمد قرار تفعيل الكاش باك بعد؛ لذلك لا توجد توزيعات أو أرقام لعرضها. الإجراءات أدناه معطّلة لهذا السبب.';
}
