import type { AdminFinanceOverview, AdminTransaction } from '../../../../core/services/admin-ops-api.service';
import { formatMoney } from '../../../../core/utils/money.util';
import { ReportDocument, ReportSection, printHtmlDocument, reportDocumentHtml } from '../../../../core/reports/report-document';
import { monthLabel, txParty, txStatusLabel, txTypeLabel } from './finance-ui';

export function adminFinanceDocument(overview: AdminFinanceOverview, transactions?: AdminTransaction[], title='التقرير المالي للمنصة'):ReportDocument {
  const t=overview.totals, money=(v:number)=>`${formatMoney(v,2)} ${overview.currency}`;
  const statuses:Record<string,string>={PENDING:'قيد المراجعة',APPROVED:'معتمد',PROCESSING:'قيد التنفيذ',PAID:'مدفوع',COMPLETED:'مكتمل',REJECTED:'مرفوض',CANCELLED:'ملغى'};
  const buckets=(values:Record<string,{count:number;amount:number}>)=>Object.entries(values).map(([key,v])=>[statuses[key]??key,v.count,money(v.amount)]);
  const sections:ReportSection[]=[
    {title:'الملخص المالي التراكمي',columns:['البند','القيمة','التفاصيل'],rows:[
      ['الإيداعات المكتملة',money(t.depositsAmount),`${t.depositsCount} عملية`],['إجمالي المبالغ المحرّرة',money(t.releasedGross),'المبالغ المحرّرة من الضمان'],
      ['عمولة المنصة',money(t.platformCommission),'من المبالغ المحرّرة'],['صافي مقدمي الخدمة',money(t.providerNetReleased),'بعد عمولة المنصة'],
      ['المبلغ المحجوز في الضمان',money(t.escrowHeldAmount),`${t.escrowHeldCount} مشروع`],['رسوم بوابة الدفع',money(t.paymentGatewayFees),'تكلفة مدفوعات، وليست إيرادًا للمنصة']]},
    {title:'الحركة الشهرية',columns:['الشهر','الإيداعات','المحرّر من الضمان','السحوبات المدفوعة','عمولات الوسطاء'],rows:overview.series.map(m=>[monthLabel(m.month),money(m.deposits),money(m.releasedGross),money(m.withdrawalsPaid),money(m.affiliateCommissions)])},
    {title:'طلبات السحب حسب الحالة',columns:['الحالة','عدد الطلبات','المبلغ'],rows:buckets(overview.withdrawals)},
    {title:'عمولات الوسطاء حسب الحالة',columns:['الحالة','عدد العمولات','المبلغ'],rows:buckets(overview.affiliateCommissions)},
  ];
  if(transactions)sections.push({title:`الحركات المالية المحمّلة (${transactions.length})`,text:'هذه الحركات المحمّلة المطابقة للفلاتر والصفحة الحالية، وليست كشفًا بجميع المعاملات.',columns:['التاريخ','نوع الحركة','الطرف','المبلغ والعملة','الحالة'],rows:transactions.map(tx=>[new Date(tx.createdAt).toLocaleString('ar-EG'),txTypeLabel(tx.type),txParty(tx),`${formatMoney(tx.amount,2)} ${tx.currency}`,txStatusLabel(tx.status)])});
  return {title,subtitle:'إجماليات تراكمية وحركة شهرية من السجلات الفعلية. المبالغ المحجوزة والسحوبات المعلقة ليست أرباحًا للمنصة.',metadata:[['العملة',overview.currency]],sections,note:'تقرير معلومات مالية مستخرج من سجلات المنصة. لا يمثل فاتورة ضريبية، ولا ينفّذ أي حركة مالية.'};
}
export function financialReportHtml(overview:AdminFinanceOverview,transactions:AdminTransaction[],updatedAt:Date,fontUrl:string):string {
  const report=adminFinanceDocument(overview,transactions);report.metadata!.push(['تاريخ البيانات',updatedAt]);return reportDocumentHtml(report,fontUrl);
}
export const printFinancialReport=printHtmlDocument;
