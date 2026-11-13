import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of,throwError} from 'rxjs';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {SaContent} from './sa-content';
import {AdminOperationsService} from '../../../../../core/services/admin-operations.service';
afterEach(()=>TestBed.resetTestingModule());
const row={slug:'about',title:'من نحن',draft:'saved draft',published:'live body',version:3,publishedAt:'2026-11-13',updatedAt:'2026-11-13'};
function mount(){const api={get:vi.fn(()=>of({success:true,data:[row]})),put:vi.fn(()=>of({success:true,data:{...row,version:4}}))};TestBed.configureTestingModule({imports:[SaContent],providers:[provideRouter([]),{provide:AdminOperationsService,useValue:api}]});const f=TestBed.createComponent(SaContent);f.detectChanges();return {f,c:f.componentInstance,api};}
describe('server content publication',()=>{
 it('keeps draft separate from publishing and requires reason and explicit confirmation',()=>{const {c,api}=mount();c.body='new body';c.save('PUBLISH');expect(api.put).not.toHaveBeenCalled();c.reason='correct wording';c.save('DRAFT');expect(api.put).toHaveBeenLastCalledWith('content/about',{body:'new body',version:3,action:'DRAFT',reason:'correct wording'});c.confirmed=true;c.save('PUBLISH');expect(api.put).toHaveBeenLastCalledWith('content/about',expect.objectContaining({action:'PUBLISH',version:4}));});
 it('preserves unsaved edit when server reports a version conflict',()=>{const {c,api}=mount();api.put.mockReturnValue(throwError(()=>({error:{message:'تغيرت الصفحة'}})) as any);c.body='my unsaved edit';c.reason='fix';c.save('DRAFT');expect(c.error()).toBe('تغيرت الصفحة');expect(c.body).toBe('my unsaved edit');expect(c.selected()?.version).toBe(3);});
});
