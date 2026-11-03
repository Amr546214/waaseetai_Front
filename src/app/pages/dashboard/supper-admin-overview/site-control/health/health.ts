import {IdentityFontsRuntime} from '../../../../../core/identity/identity-fonts.runtime';
import {Component,computed,inject,signal,ViewEncapsulation} from '@angular/core';
import {SiteIdentityService} from '../../../../../core/identity/site-identity.service';
import {PlatformTokensStore} from '../platform-tokens/platform-tokens.store';
@Component({selector:'sc-health',standalone:true,templateUrl:'./health.html',encapsulation:ViewEncapsulation.ShadowDom,styleUrls:['../site-control-base.css','./health.css']})
export class Health{
 readonly fonts=inject(IdentityFontsRuntime);readonly identity=inject(SiteIdentityService);readonly platform=inject(PlatformTokensStore);readonly busy=signal(false);readonly checked=signal(false);readonly publicReadOk=signal(false);
 readonly assets=computed(()=>Object.entries(this.identity.manifest().items).filter(([,i])=>!i.value).length);readonly overrides=computed(()=>Object.values(this.identity.manifest().items).reduce((n,i)=>n+Object.keys(i.value??{}).length,0));
 async ngOnInit(){await this.scan();}
 async scan(){if(this.busy())return;this.busy.set(true);try{const [ok]=await Promise.all([this.identity.refresh(true),this.platform.load(true)]);this.publicReadOk.set(ok);this.checked.set(true);}finally{this.busy.set(false);}}
}
