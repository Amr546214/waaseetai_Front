import {Component,inject,signal,ViewEncapsulation} from '@angular/core';
import {SiteIdentityService} from '../../../../../core/identity/site-identity.service';
import {buildPresentationCss} from '../../../../../core/identity/presentation-controls';
@Component({selector:'sc-export-css',standalone:true,templateUrl:'./export-css.html',encapsulation:ViewEncapsulation.ShadowDom,styleUrls:['../site-control-base.css','./export-css.css']})
export class ExportCss {
 readonly identity=inject(SiteIdentityService);readonly cssText=signal('');readonly copied=signal(false);readonly message=signal('');readonly busy=signal(false);readonly version=signal<number|null>(null);
 private snapshot='';
 ngOnInit(){void this.refresh();}
 async refresh(){if(this.busy())return;this.busy.set(true);this.message.set('');try{if(!await this.identity.refresh(true))throw new Error('تعذّر قراءة النسخة المنشورة. احتُفظ بالتصدير السابق.');const m=this.identity.manifest();this.snapshot=JSON.stringify(m,null,2);this.version.set(m.version);this.cssText.set('/* Waseet identity version '+m.version+'. Literal-colour and asset bindings require the platform identity runtime. */\n'+m.tokensCss+'\n'+buildPresentationCss(m.items));this.copied.set(false);}catch(e){this.message.set(e instanceof Error?e.message:'تعذّر التحديث');}finally{this.busy.set(false);}}
 async copy(){try{await navigator.clipboard.writeText(this.cssText());this.copied.set(true);this.message.set('تم نسخ النسخة المعروضة.');}catch{this.copied.set(false);this.message.set('تعذّر النسخ. استخدم تنزيل الملف.');}}
 download(kind:'css'|'json'='css'){const text=kind==='css'?this.cssText():this.snapshot;if(!text)return;const url=URL.createObjectURL(new Blob([text],{type:kind==='css'?'text/css':'application/json'}));const a=document.createElement('a');a.href=url;a.download='waseet-identity-v'+this.version()+'.'+kind;a.click();URL.revokeObjectURL(url);}
}
