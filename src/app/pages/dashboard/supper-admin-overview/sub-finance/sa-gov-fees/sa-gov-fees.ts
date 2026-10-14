import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/** No backend source exists for this page: it shows an honest empty state and disabled actions with a visible reason. */
@Component({
  selector: 'app-sa-gov-fees',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-gov-fees.html',
  styleUrl: './sa-gov-fees.css',
})
export class SaGovFees {
  readonly emptyTitle = 'لا توجد رسوم حكومية مسجّلة في المنصة';
  readonly emptyReason = 'لا يوجد مصدر بيانات للرسوم الحكومية؛ لذلك لا تُعرض أرقام أو إقرارات. الإجراءات أدناه معطّلة لهذا السبب.';
}
