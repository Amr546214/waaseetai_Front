import { printHtmlDocument } from '../../../../../../core/reports/report-document';
/** Print an isolated snapshot so dashboard navigation and publish/consent controls never enter the PDF. */
export async function printReviewDocument(
  source: HTMLElement,
  title: string,
  onFrame: (frame: HTMLIFrameElement) => void,
): Promise<void> {
  const owner = source.ownerDocument;
  const fontUrl = new URL('/assets/fonts/DINNextLTArabic-Regular-3.ttf', owner.baseURI).href;
  const style = `
    @font-face { font-family: ReviewArabic; src: url(${JSON.stringify(fontUrl)}) format('truetype'); font-weight: 100 900; }
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17243a; background: white; font-family: ReviewArabic, Arial, sans-serif; font-size: 12px; line-height: 1.7; }
    h2,h3,h4,p,dl,dd,ul { margin: 0; }
    button { display: none !important; }
    .review-cover { padding-bottom: 12px; }
    .review-cover-top,.review-title-row,.review-section-heading,.review-list li,.review-files-heading { display: flex; justify-content: space-between; gap: 12px; }
    .review-cover-top { color: #52647a; font-size: 10px; margin-bottom: 10px; }
    h2 { font-size: 22px; line-height: 1.6; }
    h3 { font-size: 13px; } h4 { font-size: 12px; margin-top: 9px; }
    .review-description,.review-outputs p,.review-custom-conditions { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 7px; }
    .review-outputs { margin-top: 10px; padding-inline-start: 10px; border-inline-start: 2px solid #127d76; }
    .review-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-block: 1px solid #ccd5df; margin-bottom: 6px; }
    .review-facts > div { display: grid; gap: 3px; padding: 9px; }
    .review-facts span,dt { color: #52647a; font-size: 11px; }
    .review-facts strong { font-size: 15px; }
    .review-sections { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); }
    .review-section { min-width: 0; padding: 12px 8px; break-inside: avoid; }
    .review-section + .review-section { border-inline-start: 1px solid #e0e5eb; }
    .review-section-heading { margin-bottom: 10px; }
    .review-section-heading h3 > span { color: #127d76; margin-inline-end: 4px; }
    dl > div { margin-bottom: 7px; } dd { overflow-wrap: anywhere; white-space: pre-wrap; font-size: 11px; }
    .review-list { list-style: none; padding: 0; margin-top: 6px; font-size: 11px; }
    .review-list li { margin-bottom: 4px; } .review-list li span { overflow-wrap: anywhere; min-width: 0; } small { flex-shrink: 0; }
    .review-extra { border-top: 1px solid #ccd5df; padding: 12px 0; }
    .review-extra ul { padding-inline-start: 18px; overflow-wrap: anywhere; }
    .review-empty-conditions { display: block; font-size: 11px; padding: 8px 0; }
    .review-document-note { border-top: 1px solid #ccd5df; padding-top: 8px; color: #52647a; font-size: 10px; }
    h2,h3,h4 { break-after: avoid; } p,li { orphans: 3; widows: 3; }
  `;
  const snapshot = source.cloneNode(true) as HTMLElement;
  snapshot.querySelectorAll('button,script,form,nav').forEach(node => node.remove());
  const escape = (value: string) => value.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  await printHtmlDocument(owner, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${style.replaceAll('ReviewArabic','ReportArabic')}</style></head><body>${snapshot.outerHTML}</body></html>`, onFrame);
}
