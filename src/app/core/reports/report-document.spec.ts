import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { vi } from 'vitest';
import { printHtmlDocument, reportCell, reportMoney, reportDocumentHtml } from './report-document';
import { walletReportSections } from './wallet-report';

describe('application report documents', () => {
  afterEach(() => { document.querySelectorAll('iframe').forEach(f => f.remove()); vi.restoreAllMocks(); });

  it('escapes titles, metadata, text and cells without copying application chrome', () => {
    const attack='<img src=x onerror=alert(1)>';
    const html=reportDocumentHtml({title:attack,metadata:[[attack,attack]],sections:[{title:attack,text:attack,columns:[attack],rows:[[attack]]}]},'https://example.test/font.ttf');
    const doc=new DOMParser().parseFromString(html,'text/html');
    expect(doc.querySelector('img,script,button,nav,canvas,app-root')).toBeNull();
    expect(doc.querySelector('h1')?.textContent).toBe(attack);
    expect(doc.querySelector('td')?.textContent).toBe(attack);
    expect(doc.documentElement.dir).toBe('rtl');
    expect(html).toContain('table-header-group');
    expect(html).toContain('break-inside:avoid');
  });

  it('keeps zero, negative numbers and per-row currencies, and marks missing values', () => {
    const html=reportDocumentHtml({title:'كشف',sections:[{title:'القيم',columns:['صفر','سالب','عملة','ناقص'],rows:[[0,-25.5,'90.00 SAR',null]]}]},'font.ttf');
    const doc=new DOMParser().parseFromString(html,'text/html');
    expect(Array.from(doc.querySelectorAll('td')).map(c=>c.textContent)).toEqual(['0','-25.5','90.00 SAR','—']);
    expect(reportMoney(8.729999999,'SAR')).toBe('8.73 SAR');expect(reportMoney(null,'USD')).toBe('—');
    expect(reportCell(NaN)).toBe('—');expect(reportCell({secret:'not a value'})).toBe('—');
  });

  it('uses an honest empty state and landscape paper for wide tables', () => {
    const html=reportDocumentHtml({title:'تقرير',sections:[{title:'نتائج',columns:Array(9).fill('عمود'),rows:[]}]},'font.ttf');
    expect(html).toContain('A4 landscape');expect(html).toContain('لا توجد بيانات مطابقة');expect(html).not.toContain('<td>0</td>');
  });

  it('prints only a new iframe document and leaves the source page and title alone', async () => {
    const before=document.title;let frame!:HTMLIFrameElement;
    const print=vi.fn();const parentPrint=vi.spyOn(window,'print').mockImplementation(()=>{});
    await printHtmlDocument(document,reportDocumentHtml({title:'فاتورة واحدة',sections:[{title:'بيانات',facts:[['المشروع','مشروع مختار']]}]},'font.ttf'), f=>{
      frame=f;vi.spyOn(f.contentWindow!,'print').mockImplementation(print);vi.spyOn(f.contentWindow!,'focus').mockImplementation(()=>{});
    });
    expect(parentPrint).not.toHaveBeenCalled();expect(print).toHaveBeenCalledOnce();
    expect(frame.contentDocument?.body.textContent).toContain('مشروع مختار');expect(document.title).toBe(before);
    frame.contentWindow!.dispatchEvent(new Event('afterprint'));expect(frame.isConnected).toBe(false);
  });

  it('waits for the report font and removes the iframe on print failure', async () => {
    let release!:()=>void;const ready=new Promise<void>(r=>release=r);let frame!:HTMLIFrameElement;
    const print=vi.fn(()=>{throw new Error('unavailable')});
    const pending=printHtmlDocument(document,'<html><body>تقرير</body></html>',f=>{
      frame=f;Object.defineProperty(f.contentDocument!,'fonts',{value:{load:()=>ready,ready:Promise.resolve()},configurable:true});
      vi.spyOn(f.contentWindow!,'focus').mockImplementation(()=>{});vi.spyOn(f.contentWindow!,'print').mockImplementation(print);
    });
    expect(print).not.toHaveBeenCalled();release();await expect(pending).rejects.toThrow('unavailable');expect(frame.isConnected).toBe(false);
  });

  it('keeps recorded wallet gross, deduction reason and net without inventing missing details', () => {
    expect(walletReportSections(null)[0].text).toContain('غير مسجّلة');
    const sections=walletReportSections({operation:'ADMIN_RELEASE',operationLabel:'صرف إداري',currency:'SAR',detailsRecorded:true,missingNote:null,gross:100,net:90,netMeaning:'WITHDRAWABLE',note:null,deductions:[{code:'PLATFORM',label:'عمولة المنصة',amount:10,ratePercent:10,level:2,levelRecorded:true,reason:'حسب سجل العملية'}]});
    expect(sections[0].facts).toContainEqual(['الإجمالي المسجل','100.00 SAR']);
    expect(sections[1].rows?.[0]).toEqual(['عمولة المنصة','10.00 SAR',10,2,'حسب سجل العملية']);
  });

  it('all app print entry points use the isolated report boundary', () => {
    const root=resolve(process.cwd(),'src/app');
    const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
    const offenders=walk(root).filter(p=>p.endsWith('.ts')&&!p.endsWith('.spec.ts')&&!p.endsWith('/core/reports/report-document.ts')).filter(p=>/\b(?:window|win|w|printWindow)\s*\.\s*print\s*\(|\bprintPage\s*\(/.test(readFileSync(p,'utf8'))).map(p=>relative(root,p));
    expect(offenders).toEqual([]);
  });
});
