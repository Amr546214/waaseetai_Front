import type { AdminFinanceOverview, AdminTransaction } from '../../../../core/services/admin-ops-api.service';
import { formatMoney } from '../../../../core/utils/money.util';
import { monthLabel, txParty, txStatusLabel, txTypeLabel } from './finance-ui';

const esc = (v: unknown) => String(v ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const number = (v: number | undefined | null) => v == null || !Number.isFinite(v) ? '—' : formatMoney(v, 2);
const date = (v: string | Date) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d); };
const table = (headers: string[], rows: unknown[][]) => `<table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

/** A financial statement built from API values, never a clone/screenshot of the dashboard DOM. */
export function financialReportHtml(overview: AdminFinanceOverview, transactions: AdminTransaction[], updatedAt: Date, fontUrl: string): string {
  const t = overview.totals;
  const money = (v: number | null | undefined) => `${number(v)} ${overview.currency}`;
  const rows = [
    ['الإيداعات المكتملة', money(t.depositsAmount), `${t.depositsCount} عملية`],
    ['إجمالي المبالغ المحرّرة', money(t.releasedGross), 'المبالغ المحرّرة من الضمان'],
    ['عمولة المنصة', money(t.platformCommission), 'من المبالغ المحرّرة'],
    ['صافي مقدمي الخدمة', money(t.providerNetReleased), 'بعد عمولة المنصة'],
    ['المبلغ المحجوز في الضمان', money(t.escrowHeldAmount), `${t.escrowHeldCount} مشروع`],
    ['رسوم بوابة الدفع', money(t.paymentGatewayFees), 'تكلفة مدفوعات، وليست إيرادًا للمنصة'],
  ];
  const statuses: Record<string,string> = { PENDING: 'قيد المراجعة', APPROVED: 'معتمد', PROCESSING: 'قيد التنفيذ', PAID: 'مدفوع', COMPLETED: 'مكتمل', REJECTED: 'مرفوض', CANCELLED: 'ملغى' };
  const buckets = (values: Record<string,{count:number;amount:number}>) => Object.entries(values).map(([key,v]) => [statuses[key] ?? key, v.count, money(v.amount)]);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>التقرير المالي</title><style>
    @font-face{font-family:ReportArabic;src:url(${JSON.stringify(fontUrl)}) format('truetype');font-weight:100 900}
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#17243a;font:12px ReportArabic,Arial,sans-serif;line-height:1.7}
    header{border-bottom:3px solid #147d79;padding-bottom:14px;margin-bottom:18px}h1{font-size:26px;margin:0 0 5px;letter-spacing:0}h2{font-size:15px;margin:20px 0 8px;break-after:avoid;color:#155f63}p{margin:4px 0}.meta{display:flex;justify-content:space-between;gap:15px;color:#52647a;font-size:11px}.note{color:#52647a;font-size:11px}.lead{margin:10px 0;padding:10px 12px;background:#eff7f6;border-inline-start:3px solid #147d79}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:12px;font-size:11px}thead{display:table-header-group}th{background:#edf3f5;color:#244154;font-weight:700}th,td{padding:9px 10px;text-align:start;border-bottom:1px solid #dce4e9;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}td:nth-child(2){font-variant-numeric:tabular-nums}tbody tr:nth-child(even){background:#f8fafb}.empty{padding:12px;border:1px solid #dce4e9;color:#52647a}footer{border-top:1px solid #ccd7df;margin-top:20px;padding-top:10px;color:#52647a;font-size:10px}h2,p{orphans:3;widows:3}
  </style></head><body>
    <header><h1>التقرير المالي للمنصة</h1><div class="meta"><span>بيانات مالية فعلية · ${esc(overview.currency)}</span><span>تاريخ البيانات: ${esc(date(updatedAt))}</span></div></header>
    <p class="lead">يعرض هذا التقرير الإجماليات المسجلة حتى تاريخ البيانات، والحركة الشهرية للفترة المبينة أدناه. المبالغ المحجوزة والسحوبات المعلقة ليست أرباحًا للمنصة.</p>
    <h2>الملخص المالي التراكمي</h2>${table(['البند','القيمة','التفاصيل'], rows)}
    <h2>الحركة الشهرية</h2>${overview.series.length ? table(['الشهر','الإيداعات','المحرّر من الضمان','السحوبات المدفوعة','عمولات الوسطاء'], overview.series.map(m => [monthLabel(m.month),money(m.deposits),money(m.releasedGross),money(m.withdrawalsPaid),money(m.affiliateCommissions)])) : '<p class="empty">لا توجد حركة شهرية مسجلة في الفترة.</p>'}
    <h2>طلبات السحب حسب الحالة</h2>${Object.keys(overview.withdrawals).length ? table(['الحالة','عدد الطلبات','المبلغ'],buckets(overview.withdrawals)) : '<p class="empty">لا توجد طلبات سحب مسجلة.</p>'}
    <h2>عمولات الوسطاء حسب الحالة</h2>${Object.keys(overview.affiliateCommissions).length ? table(['الحالة','عدد العمولات','المبلغ'],buckets(overview.affiliateCommissions)) : '<p class="empty">لا توجد عمولات وسطاء مسجلة.</p>'}
    <h2>آخر الحركات المالية المعروضة (${transactions.length})</h2><p class="note">هذه آخر الحركات المحمّلة في لوحة المالية، وليست كشفًا بجميع المعاملات.</p>
    ${transactions.length ? table(['التاريخ','نوع الحركة','الطرف','المبلغ والعملة','الحالة'], transactions.map(tx => [date(tx.createdAt),txTypeLabel(tx.type),txParty(tx),`${number(tx.amount)} ${tx.currency}`,txStatusLabel(tx.status)])) : '<p class="empty">لا توجد حركات مالية معروضة.</p>'}
    <footer>تقرير معلومات مالية مستخرج من سجلات المنصة. لا يمثل هذا المستند فاتورة ضريبية، ولا ينفّذ أي حركة مالية.</footer>
  </body></html>`;
}

export async function printFinancialReport(owner: Document, html: string, onFrame: (frame: HTMLIFrameElement) => void): Promise<void> {
  const frame = owner.createElement('iframe');
  frame.title = 'التقرير المالي للطباعة'; frame.tabIndex = -1; frame.setAttribute('aria-hidden','true');
  frame.style.cssText = 'position:fixed;inset:0;width:0;height:0;border:0;visibility:hidden';
  owner.body.append(frame); onFrame(frame);
  const doc = frame.contentDocument, win = frame.contentWindow;
  if (!doc || !win) throw new Error('Print preview unavailable');
  doc.open(); doc.write(html); doc.close();
  if (doc.fonts) { await doc.fonts.load('12px ReportArabic'); await doc.fonts.ready; }
  if (!frame.isConnected) return;
  win.addEventListener('afterprint', () => frame.remove(), { once:true });
  win.focus(); win.print();
}
