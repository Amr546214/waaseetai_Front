import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { UiNotificationService } from '../services/ui-notification.service';
import { ReportDocument, printHtmlDocument, reportDocumentHtml } from './report-document';

@Injectable({providedIn:'root'})
export class ReportPrintService {
  private readonly document=inject(DOCUMENT);
  private readonly platform=inject(PLATFORM_ID);
  private readonly notify=inject(UiNotificationService);
  private frame?:HTMLIFrameElement;
  readonly preparing=signal(false);
  constructor(){inject(DestroyRef).onDestroy(()=>this.frame?.remove());}
  print(report:ReportDocument):void {
    if(!isPlatformBrowser(this.platform)||this.preparing())return;
    if(!report.sections.length){this.notify.warning('لا توجد بيانات محمّلة للتصدير بعد.');return;}
    this.preparing.set(true);this.frame?.remove();
    const font=new URL('/assets/fonts/DINNextLTArabic-Regular-3.ttf',this.document.baseURI).href;
    const snapshot={...report,metadata:[...(report.metadata??[]),['تاريخ الاستخراج',new Date().toLocaleString('ar-EG')]] as Array<[string,unknown]>};
    void printHtmlDocument(this.document,reportDocumentHtml(snapshot,font),frame=>this.frame=frame)
      .catch(()=>this.notify.error('تعذّر تجهيز المستند للطباعة. حاول مرة أخرى.'))
      .finally(()=>this.preparing.set(false));
  }
}
