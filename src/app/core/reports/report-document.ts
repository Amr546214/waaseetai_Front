/** Data-only report model. A caller must provide its actual loaded rows and the scope they represent. */
export interface ReportSection { title: string; columns?: string[]; rows?: unknown[][]; facts?: Array<[string, unknown]>; text?: string; emptyText?: string }
export interface ReportDocument { title: string; subtitle?: string; metadata?: Array<[string, unknown]>; sections: ReportSection[]; note?: string }
export const reportEscape = (v: unknown): string => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reportCell(v: unknown): string {
  if (v == null) return '—';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '—' : v.toLocaleString('ar-EG');
  if (typeof v === 'number') return Number.isFinite(v) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v) : '—';
  return typeof v === 'string' ? v : typeof v === 'boolean' ? v ? 'نعم' : 'لا' : '—';
}
/** Format a stored financial value for paper without floating-point display artifacts. */
export function reportMoney(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}
export function reportDocumentHtml(report: ReportDocument, fontUrl: string): string {
  const landscape=report.sections.some(s=>(s.columns?.length??0)>7);
  const cell=(v:unknown)=>reportEscape(reportCell(v));
  const facts=(rows:Array<[string,unknown]>)=>`<dl>${rows.map(([label,value])=>`<div><dt>${reportEscape(label)}</dt><dd>${cell(value)}</dd></div>`).join('')}</dl>`;
  const sections=report.sections.map(section=>`<section><h2>${reportEscape(section.title)}</h2>${section.text?`<p class="section-text">${reportEscape(section.text)}</p>`:''}${section.facts?facts(section.facts):''}${section.columns?section.rows?.length?`<table><thead><tr>${section.columns.map(h=>`<th scope="col">${reportEscape(h)}</th>`).join('')}</tr></thead><tbody>${section.rows.map(row=>`<tr>${section.columns!.map((_,i)=>`<td>${cell(row[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`:`<p class="empty">${reportEscape(section.emptyText??'لا توجد بيانات مطابقة ضمن النطاق المحمّل.')}</p>`:''}</section>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${reportEscape(report.title)}</title><style>
  @font-face{font-family:ReportArabic;src:url(${JSON.stringify(fontUrl)}) format('truetype');font-weight:100 900}@page{size:A4 ${landscape?'landscape':'portrait'};margin:14mm}*{box-sizing:border-box}body{margin:0;color:#17243a;background:white;font:12px ReportArabic,Arial,sans-serif;line-height:1.75}header{border-bottom:3px solid #147d79;padding-bottom:14px;margin-bottom:18px}h1{font-size:25px;margin:0 0 6px}h2{font-size:15px;color:#155f63;margin:20px 0 8px;break-after:avoid}header p{color:#52647a;margin:0}dl{margin:8px 0 14px}dl>div{break-inside:avoid;display:flex;gap:16px;border-bottom:1px solid #e1e7eb;padding:8px 4px}dt{width:35%;color:#52647a;flex-shrink:0}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;margin:8px 0 16px}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:9px 8px;border-bottom:1px solid #dce4e9;text-align:start;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#edf3f5;color:#244154;font-weight:700}tbody tr:nth-child(even){background:#f8fafb}.empty{padding:12px;background:#f8fafb;color:#52647a}.section-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}footer{font-size:10px;color:#52647a;border-top:1px solid #ccd7df;padding-top:10px;margin-top:20px}p{orphans:3;widows:3}
  </style></head><body><header><h1>${reportEscape(report.title)}</h1>${report.subtitle?`<p>${reportEscape(report.subtitle)}</p>`:''}</header>${report.metadata?facts(report.metadata):''}${sections}<footer>${reportEscape(report.note??'مستند مستخرج من البيانات المحمّلة في المنصة. لا ينفّذ أي إجراء ولا يغيّر السجلات.')}</footer></body></html>`;
}

/** The only browser print boundary: an isolated, freshly constructed document, never the application window. */
export async function printHtmlDocument(owner: Document, html: string, onFrame: (frame: HTMLIFrameElement) => void): Promise<void> {
  const frame=owner.createElement('iframe');frame.title='مستند للطباعة';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;inset:0;width:0;height:0;border:0;visibility:hidden';owner.body.append(frame);onFrame(frame);
  try {
    const doc=frame.contentDocument, win=frame.contentWindow;
    if(!doc||!win)throw new Error('Print preview unavailable');
    doc.open();doc.write(html);doc.close();
    if(doc.fonts){await doc.fonts.load('12px ReportArabic');await doc.fonts.ready;}
    if(!frame.isConnected)return;
    win.addEventListener('afterprint',()=>frame.remove(),{once:true});win.focus();win.print();
  } catch(error){frame.remove();throw error;}
}
