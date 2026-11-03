import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {vi} from 'vitest';
import {ExportCss} from './export-css/export-css';
import {Health} from './health/health';
import {SiteIdentityService} from '../../../../core/identity/site-identity.service';
import {PlatformTokensStore} from './platform-tokens/platform-tokens.store';
const manifest=()=>({version:9,items:{'tokens.components':{value:{'--comp-card-radius':'20px'}}},tokensCss:':root{--comp-card-radius:20px}'});
describe('server-backed identity readers',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('exports a consistent server version and preserves it on refresh failure',async()=>{let ok=true;const identity={manifest:signal(manifest()),refresh:vi.fn(async()=>ok)};TestBed.configureTestingModule({providers:[{provide:SiteIdentityService,useValue:identity}]});const c=TestBed.runInInjectionContext(()=>new ExportCss());await c.refresh();expect(c.version()).toBe(9);expect(c.cssText()).toContain('border-radius:20px!important');const previous=c.cssText();ok=false;await c.refresh();expect(c.cssText()).toBe(previous);expect(c.version()).toBe(9);expect(c.message()).toContain('تعذّر');});
 it('does not claim clipboard success when the browser refuses access',async()=>{const identity={manifest:signal(manifest()),refresh:vi.fn(async()=>true)};TestBed.configureTestingModule({providers:[{provide:SiteIdentityService,useValue:identity}]});const c=TestBed.runInInjectionContext(()=>new ExportCss());Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});await c.refresh();await c.copy();expect(c.copied()).toBe(false);expect(c.message()).toContain('تعذّر النسخ');});
 it('health counts actual published overrides and joins real refresh results without local policy samples',async()=>{const m=manifest();const identity={manifest:signal(m),refresh:vi.fn(async()=>false)};const platform={load:vi.fn(async()=>{})};TestBed.configureTestingModule({providers:[{provide:SiteIdentityService,useValue:identity},{provide:PlatformTokensStore,useValue:platform}]});const c=TestBed.runInInjectionContext(()=>new Health());await c.scan();expect(c.publicReadOk()).toBe(false);expect(c.overrides()).toBe(1);expect(c.assets()).toBe(0);expect(platform.load).toHaveBeenCalledWith(true);});
});
