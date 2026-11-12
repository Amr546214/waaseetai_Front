import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SaRoles } from './sa-roles';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { environment } from '../../../../../environments/environment';

const base = `${environment.url_api}/admin/team`;
const role = (id: string, name: string) => ({ id, name, description: null, color: '#2BD4C7', permissions: [], permissionCount: 0, memberCount: 1, version: 1, updatedAt: '' });
const member = (name: string) => ({ userId: name, name, email: `${name}@example.test`, status: 'ACTIVE' });

describe('role cards and their recorded members', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const access = TestBed.inject(AdminAccessService);
    access.access.set({ userId: 'me', isSuperAdmin: true, staffStatus: 'ACTIVE', roleName: 'Super Admin', permissions: [], hasAnyPermission: true, state: 'SUPER_ADMIN', displayRole: 'Super Admin' });
    access.status.set('ready');
  });
  afterEach(() => { http.verify({ignoreCancelled: true}); TestBed.resetTestingModule(); });

  function mount() {
    const f=TestBed.createComponent(SaRoles);f.detectChanges();
    http.expectOne(`${base}/permissions`).flush({success:true,data:{permissions:[],groups:{},templates:[],superAdminOnly:[],ambiguities:[],superAdminCount:1}});
    http.expectOne(`${base}/roles`).flush({success:true,data:[role('r1','مشرف الدعم'),role('r2','المراجعة')]});
    http.expectOne(r=>r.url.endsWith('/access-audit')).flush({success:true,data:[]});f.detectChanges();
    return {f,c:f.componentInstance,el:f.nativeElement as HTMLElement};
  }
  const staffRequest = (id: string) => http.expectOne(r=>r.url===`${base}/staff`&&r.params.get('roleId')===id);

  it('clicking a card requests exactly that role and displays its real members', () => {
    const {f,el}=mount();el.querySelector<HTMLDivElement>('[data-testid=role-card]')!.click();f.detectChanges();
    expect(el.querySelector('[data-testid=role-members-modal]')!.textContent).toContain('جاري تحميل');
    staffRequest('r1').flush({success:true,data:{members:[member('أحمد')]}});f.detectChanges();
    const list=el.querySelector('[data-testid=role-members-list]')!;expect(list.textContent).toContain('أحمد');expect(list.textContent).toContain('نشط');
  });

  it('the edit button opens the role editor without opening its members', () => {
    const {f,el}=mount();el.querySelector<HTMLButtonElement>('[data-testid=role-edit]')!.click();f.detectChanges();
    expect(el.querySelector('[data-testid=role-modal]')).not.toBeNull();expect(el.querySelector('[data-testid=role-members-modal]')).toBeNull();
    http.expectNone(r=>r.url===`${base}/staff`);
  });

  it('keyboard activation works and Escape closes the member popup', () => {
    const {f,el}=mount();el.querySelector('[data-testid=role-card]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));f.detectChanges();
    staffRequest('r1').flush({success:true,data:{members:[]}});f.detectChanges();expect(el.querySelector('[data-testid=role-members-empty]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));f.detectChanges();expect(el.querySelector('[data-testid=role-members-modal]')).toBeNull();
  });

  it('Super Admin uses the account roster rather than treating it as a stored role', () => {
    const {f,el}=mount();el.querySelector<HTMLDivElement>('[data-testid=role-card-super-admin]')!.click();f.detectChanges();
    http.expectOne(`${environment.url_api}/admin/console/admins`).flush({success:true,data:[{id:'sa',name:'مدير النظام',email:'sa@example.test',status:'ACTIVE',accountType:'SUPER_ADMIN'},{id:'staff',name:'موظف عادي',accountType:'ADMIN'}]});f.detectChanges();
    expect(el.querySelector('[data-testid=role-members-list]')!.textContent).toContain('مدير النظام');expect(el.querySelector('[data-testid=role-members-list]')!.textContent).not.toContain('موظف عادي');
    http.expectNone(r=>r.url===`${base}/staff`);
  });

  it('late responses cannot overwrite another role or reopen a closed popup', () => {
    const {f,c,el}=mount();c.openRoleMembers(role('r1','مشرف الدعم'));const old=staffRequest('r1');
    c.openRoleMembers(role('r2','المراجعة'));const current=staffRequest('r2');
    current.flush({success:true,data:{members:[member('مراجع')]}});old.flush({success:true,data:{members:[member('قديم')]}});f.detectChanges();
    expect(el.querySelector('[data-testid=role-members-list]')!.textContent).toContain('مراجع');expect(c.roleMembers().map(x=>x.name)).toEqual(['مراجع']);
    c.openRoleMembers(role('r1','مشرف الدعم'));const late=staffRequest('r1');c.closeRoleMembers();late.flush({success:true,data:{members:[member('متأخر')]}});f.detectChanges();
    expect(c.roleMembers()).toEqual([]);expect(el.querySelector('[data-testid=role-members-modal]')).toBeNull();
  });

  it('a failed member load has a retry and never displays an empty success state', () => {
    const {f,c,el}=mount();c.openRoleMembers(role('r1','مشرف الدعم'));staffRequest('r1').flush({message:'تعذر التحميل'},{status:500,statusText:'Error'});f.detectChanges();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('تعذر التحميل');expect(el.querySelector('[data-testid=role-members-empty]')).toBeNull();
    c.retryMembers();staffRequest('r1').flush({success:true,data:{members:[member('عاد')]}});f.detectChanges();expect(c.roleMembers()[0].name).toBe('عاد');
  });

  it('a response after destroying the component cannot populate its popup', () => {
    const {f,c}=mount();c.openRoleMembers(role('r1','مشرف الدعم'));const late=staffRequest('r1');f.destroy();
    late.flush({success:true,data:{members:[member('متأخر')]}});expect(c.roleMembers()).toEqual([]);
  });
});
