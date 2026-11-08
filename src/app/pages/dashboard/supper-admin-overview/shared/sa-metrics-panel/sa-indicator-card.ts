import { Component, input } from '@angular/core';
import { TechIndicator } from '../../../../../core/services/system-settings.store';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

/** The single rendering of one indicator, used by the home page and every detail page. */
@Component({
  selector: 'app-sa-indicator-card',
  standalone: true,
  imports: [WsDatePipe],
  styles: [`:host{display:grid;gap:.3rem;align-content:start}h3,p{margin:0}.smp-val{font-size:1.4rem}.smp-unit{font-size:.85rem;font-weight:500;opacity:.8}.smp-na{opacity:.85}.smp-bad{color:var(--red,#d24646)}.smp-reason{font-size:.9rem}.smp-meta{font-size:.8rem;opacity:.8}time{direction:ltr;unicode-bidi:isolate}`],
  template: `
    @let i = indicator();
    <h3>{{ i.label }}</h3>
    @if (i.status === 'measured' && i.kind === 'datetime' && i.valueText) {
      <strong class="smp-val"><time [attr.datetime]="i.valueText">{{ i.valueText | wsDate:'datetime':'yyyy-MM-dd HH:mm' }}</time></strong>
    } @else if (i.status === 'measured' && i.valueText) {
      <strong class="smp-val" [attr.data-state]="i.state">{{ i.valueText }}</strong>
    } @else if (i.status === 'measured') {
      <strong class="smp-val">{{ display() }} <span class="smp-unit">{{ i.unit }}</span></strong>
    } @else if (i.status === 'error') {
      <strong class="smp-na smp-bad">تعذّرت القراءة</strong>
    } @else {
      <strong class="smp-na">غير متاح</strong>
    }
    @if (i.detail) { <p class="smp-reason">{{ i.detail }}</p> }
    @if (i.reason) { <p class="smp-reason">{{ i.reason }}</p> }
    @if (i.scope) { <p class="smp-meta">النطاق: {{ i.scope }}</p> }
    <p class="smp-meta">المصدر: {{ i.source }}</p>
    <p class="smp-meta">آخر قراءة: <time [attr.datetime]="i.readAt">{{ i.readAt | wsDate:'datetime':'yyyy-MM-dd HH:mm:ss' }}</time></p>`,
})
export class SaIndicatorCard {
  readonly indicator = input.required<TechIndicator>();
  display(): string { const v = this.indicator().value; return v === null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
}
