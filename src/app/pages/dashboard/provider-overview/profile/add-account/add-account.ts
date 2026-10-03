import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService } from '../../../../../core/services/account.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { NotificationEngineService } from '../../../../../core/services/notification-engine.service';
import { UserRole } from '../../../../../core/models/auth.model';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';

interface FlowStep {
  id: string;
  label: string;
}

const FLOWS: Record<string, FlowStep[]> = {
  'provider-ind': [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-spec', label: 'التخصصات' },
    { id: 'panel-portfolio', label: 'نموذج الأعمال' },
    { id: 'panel-review', label: 'إرسال' }
  ],
  'affiliate': [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-channel', label: 'قناة التسويق' },
    { id: 'panel-review', label: 'إرسال' }
  ],
  'seeker-co': [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-company', label: 'بيانات الشركة' },
    { id: 'panel-review', label: 'إرسال' }
  ],
  'provider-co': [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-company', label: 'بيانات الشركة' },
    { id: 'panel-review', label: 'إرسال' }
  ],
  'seeker-ind': [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-review', label: 'إرسال' }
  ]
};

const TYPE_LABELS: Record<string, string> = {
  'provider-ind': 'مقدم خدمة فرد',
  'provider-co': 'مقدم خدمة شركة',
  'seeker-ind': 'طالب خدمة فرد',
  'seeker-co': 'طالب خدمة شركة',
  'affiliate': 'وسيط تسويقي'
};

const TYPE_COLORS: Record<string, string> = {
  'provider-ind': '#5DA0FF',
  'provider-co': '#0FA99A',
  'seeker-ind': '#2BD4C7',
  'seeker-co': '#2BD4C7',
  'affiliate': '#D98A0B'
};

@Component({
  selector: 'app-profile-add-account',
  standalone: true,
  imports: [CommonModule, FormsModule, BioFieldDirective],
  templateUrl: './add-account.html',
  styles: [`
    @keyframes ws-fade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes skel-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .wz-panel {
      display: none;
      animation: ws-fade 0.2s ease forwards;
    }
    .wz-panel.show {
      display: block;
    }
    .role-disabled {
      cursor: default;
    }
    .state-card {
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      backdrop-filter: blur(12px);
      border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .role-card {
      position: relative;
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.02)));
      border: 1.5px solid var(--sec-bd, rgba(255,255,255,.10));
      border-radius: 16px;
      padding: 22px 16px 18px;
      cursor: pointer;
      transition: border-color .2s, background .2s, transform .15s;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .role-card:not(.role-disabled):hover {
      border-color: rgba(43, 212, 199, 0.40);
      background: linear-gradient(135deg, rgba(43, 212, 199, 0.07), rgba(43, 127, 255, 0.04));
      transform: translateY(-2px);
    }
    :host-context(body.light-theme) .role-card,
    :host-context(body.theme-light) .role-card,
    :host-context(.light-theme) .role-card,
    :host-context(.theme-light) .role-card {
      background: #fff;
      border-color: #E7EAF1;
    }
    :host-context(body.light-theme) .role-card:not(.role-disabled):hover,
    :host-context(body.theme-light) .role-card:not(.role-disabled):hover,
    :host-context(.light-theme) .role-card:not(.role-disabled):hover,
    :host-context(.theme-light) .role-card:not(.role-disabled):hover {
      background: #f0fbfa;
      border-color: rgba(43, 212, 199, 0.5);
    }
    .role-cta {
      width: 100%;
      padding: 10px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 9px;
      font-size: 13px;
      font-weight: 800;
      color: var(--txt, #fff);
      cursor: pointer;
      font-family: inherit;
      transition: all .18s;
      margin-top: auto;
    }
    .role-card:not(.role-disabled):hover .role-cta {
      background: linear-gradient(135deg, #2BD4C7, #2B7FFF);
      color: #070D24;
      border-color: transparent;
    }
    :host-context(body.light-theme) .role-cta,
    :host-context(body.theme-light) .role-cta,
    :host-context(.light-theme) .role-cta,
    :host-context(.theme-light) .role-cta {
      background: #f1f5f9;
      border-color: #E7EAF1;
      color: #0F172A;
    }
    .form-card {
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      backdrop-filter: blur(12px);
      border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
      border-radius: 16px;
      padding: 22px;
      margin-bottom: 14px;
    }
    :host-context(body.light-theme) .form-card,
    :host-context(body.theme-light) .form-card,
    :host-context(.light-theme) .form-card,
    :host-context(.theme-light) .form-card {
      background: #fff;
      border-color: #E7EAF1;
    }
    .inp-field {
      background: var(--inp-bg, rgba(255,255,255,.05));
      border: 1px solid var(--sec-bd, rgba(255,255,255,.10));
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      color: var(--txt, #fff);
      font-family: inherit;
      width: 100%;
      transition: border-color .15s;
    }
    .inp-field:focus {
      outline: none;
      border-color: rgba(43,212,199,.40);
    }
    :host-context(body.light-theme) .inp-field,
    :host-context(body.theme-light) .inp-field,
    :host-context(.light-theme) .inp-field,
    :host-context(.theme-light) .inp-field {
      background: #f8fafc;
      border-color: #D8DFEC;
      color: #0F172A;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddAccount implements OnInit {
  private accountService = inject(AccountService);
  public authStore = inject(AuthStore);
  private router = inject(Router);
  public notifEngine = inject(NotificationEngineService);

  UserRole = UserRole;

  selectedType = signal<string | null>(null);
  stepIdx = signal<number>(0);
  flow = signal<FlowStep[]>([]);
  isSuccess = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  isLoadingRoles = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ownedRoles = signal<UserRole[]>([]);
  activeRole = signal<UserRole | null>(null);
  createdRole = signal<UserRole | null>(null);

  // Form Models
  specMain = signal('');
  specExp = signal('3-5 سنوات');
  portfolioBio = signal('');
  chType = signal('');
  chReach = signal('');
  coName = signal('');
  coCrn = signal('');
  coRole = signal('');

  skills = signal<string[]>(['Figma', 'Adobe XD']);
  skillInput = signal('');

  currentUser = this.authStore.currentUser;

  userAccountType = computed(() => {
    return this.currentUser()?.accountType || null;
  });

  effectiveActiveRole = computed<UserRole>(() => {
    if (this.activeRole()) return this.activeRole()!;
    const user = this.currentUser();
    if (user?.activeRole) return user.activeRole;
    const accType = user?.accountType;
    if (accType?.includes('PROVIDER')) return UserRole.PROVIDER;
    if (accType?.includes('MARKETING')) return UserRole.AFFILIATE;
    return UserRole.CLIENT;
  });

  effectiveOwnedRoles = computed<UserRole[]>(() => {
    const fromApi = this.ownedRoles();
    const user = this.currentUser();
    const derivedFromAcc = user?.accountType?.includes('PROVIDER') 
      ? UserRole.PROVIDER 
      : user?.accountType?.includes('MARKETING') 
        ? UserRole.AFFILIATE 
        : UserRole.CLIENT;
    
    const set = new Set<UserRole>([derivedFromAcc]);
    if (user?.roles) {
      user.roles.forEach(r => set.add(r));
    }
    if (fromApi) {
      fromApi.forEach(r => set.add(r));
    }
    return Array.from(set);
  });

  defaultFlow: FlowStep[] = [
    { id: 'panel-1', label: 'اختيار النوع' },
    { id: 'panel-2', label: 'البيانات الخاصة' },
    { id: 'panel-3', label: 'إرسال' }
  ];

  currentFlow = computed(() => {
    const sel = this.selectedType();
    return sel ? this.flow() : this.defaultFlow;
  });

  ngOnInit() {
    this.fetchAccountTypes();
  }

  fetchAccountTypes() {
    this.isLoadingRoles.set(true);
    this.accountService.getAvailableAccountTypes().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.ownedRoles.set(res.data.ownedRoles || []);
          this.activeRole.set(res.data.activeRole || null);
        }
        this.isLoadingRoles.set(false);
      },
      error: () => {
        const user = this.currentUser();
        if (user) {
          if (user.roles) this.ownedRoles.set(user.roles);
          if (user.activeRole) this.activeRole.set(user.activeRole);
        }
        this.isLoadingRoles.set(false);
      }
    });
  }

  mapTypeToRole(type: string): UserRole {
    if (type === 'provider-ind' || type === 'provider-co') return UserRole.PROVIDER;
    if (type === 'affiliate') return UserRole.AFFILIATE;
    return UserRole.CLIENT;
  }

  getRoleLabel(role: UserRole): string {
    switch (role) {
      case UserRole.PROVIDER: return 'مقدم الخدمة';
      case UserRole.AFFILIATE: return 'الوسيط التسويقي';
      case UserRole.CLIENT: default: return 'طالب الخدمة';
    }
  }

  isRoleOwned(typeKey: string): boolean {
    const role = this.mapTypeToRole(typeKey);
    return this.effectiveOwnedRoles().includes(role);
  }

  isRoleActive(typeKey: string): boolean {
    const accType = this.userAccountType();
    const activeRole = this.effectiveActiveRole();

    if (accType === 'PROVIDER_INDIVIDUAL' && typeKey === 'provider-ind') return true;
    if (accType === 'PROVIDER_COMPANY' && typeKey === 'provider-co') return true;
    if (accType === 'CLIENT_INDIVIDUAL' && typeKey === 'seeker-ind') return true;
    if (accType === 'CLIENT_COMPANY' && typeKey === 'seeker-co') return true;
    if (accType === 'MARKETING_BROKER' && typeKey === 'affiliate') return true;

    // Fallback based on activeRole
    const role = this.mapTypeToRole(typeKey);
    if (activeRole === role) {
      if (role === UserRole.PROVIDER && typeKey === 'provider-ind' && (!accType || !accType.includes('COMPANY'))) return true;
      if (role === UserRole.CLIENT && typeKey === 'seeker-ind' && (!accType || !accType.includes('COMPANY'))) return true;
      if (role === UserRole.AFFILIATE && typeKey === 'affiliate') return true;
    }

    return false;
  }

  // Phase 3 item 2 ("تعطيل حسابات الشركات وفق الملاحظة"): this self-service
  // flow can never actually produce a real company account — addAccountType()
  // only ever grants the generic PROVIDER/CLIENT role (see mapTypeToRole()
  // above); accountType (the field that actually distinguishes *_COMPANY
  // from *_INDIVIDUAL) is fixed at signup and is never touched here. Before
  // this fix, selecting "provider-co"/"seeker-co" silently added a plain
  // individual-equivalent role while collecting company name/CR number that
  // were never used to create a real company account — misleading. Disabled
  // unconditionally until a real company-account creation path exists,
  // rather than faking one.
  isRoleUnavailable(typeKey: string): boolean {
    return typeKey === 'provider-co' || typeKey === 'seeker-co';
  }

  selectType(type: string) {
    if (this.isRoleActive(type) || this.isRoleUnavailable(type)) {
      return;
    }

    if (this.isRoleOwned(type)) {
      const role = this.mapTypeToRole(type);
      this.switchToRole(role);
      return;
    }

    this.errorMessage.set(null);
    this.selectedType.set(type);
    this.flow.set(FLOWS[type] ? [...FLOWS[type]] : []);
    this.stepIdx.set(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep() {
    if (this.stepIdx() < this.flow().length - 1) {
      this.stepIdx.update(v => v + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep() {
    if (this.stepIdx() <= 1) {
      this.selectedType.set(null);
      this.stepIdx.set(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.stepIdx.update(v => v - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  submit() {
    const type = this.selectedType();
    if (!type) return;

    const targetRole = this.mapTypeToRole(type);

    const profileMetadata: Record<string, any> = {
      specMain: this.specMain(),
      specExp: this.specExp(),
      portfolioBio: this.portfolioBio(),
      skills: this.skills(),
      chType: this.chType(),
      chReach: this.chReach(),
      coName: this.coName(),
      coCrn: this.coCrn(),
      coRole: this.coRole()
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.accountService.addAccountType(targetRole, profileMetadata).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isSuccess.set(true);
        this.createdRole.set(targetRole);
        this.activeRole.set(targetRole);
        if (!this.ownedRoles().includes(targetRole)) {
          this.ownedRoles.update(r => [...r, targetRole]);
        }
        this.notifEngine.triggerToast({
          title: 'تم تفعيل الحساب بنجاح',
          message: `تم إضافة وتفعيل حساب ${this.getRoleLabel(targetRole)} لملفك الشخصي بنجاح.`
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message || err?.message || 'حدث خطأ أثناء إضافة الحساب';
        this.errorMessage.set(msg);
      }
    });
  }

  switchToRole(targetRole?: UserRole | null) {
    const roleToSwitch = targetRole || this.createdRole();
    if (!roleToSwitch) return;

    if (roleToSwitch === this.activeRole() && !this.isSuccess()) {
      return;
    }

    this.accountService.switchActiveRole(roleToSwitch).subscribe({
      next: () => {
        this.notifEngine.triggerToast({
          title: 'تم تبديل اللوحة بنجاح',
          message: `تم التبديل إلى لوحة ${this.getRoleLabel(roleToSwitch)} بنجاح.`
        });
        
        let targetUrl = '/client-overview';
        if (roleToSwitch === UserRole.PROVIDER) {
          targetUrl = '/provider-overview';
        } else if (roleToSwitch === UserRole.AFFILIATE) {
          targetUrl = '/marketer-overview';
        }

        if (typeof window !== 'undefined') {
          window.location.href = targetUrl;
        } else {
          this.router.navigate([targetUrl]);
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'تعذر الانتقال إلى الحساب';
        this.errorMessage.set(msg);
      }
    });
  }

  addSkill() {
    const val = this.skillInput().trim();
    if (val && !this.skills().includes(val)) {
      this.skills.update(s => [...s, val]);
      this.skillInput.set('');
    }
  }

  removeSkill(skill: string) {
    this.skills.update(s => s.filter(x => x !== skill));
  }

  handleSkillKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addSkill();
    }
  }

  getTypeLabel(type: string | null): string {
    return type ? (TYPE_LABELS[type] || '—') : '—';
  }

  getTypeColor(type: string | null): string {
    return type ? (TYPE_COLORS[type] || '#2BD4C7') : '#2BD4C7';
  }

  getReviewData() {
    const type = this.selectedType();
    const data: { key: string; val: string }[] = [];

    if (type === 'provider-ind') {
      if (this.specMain()) data.push({ key: 'التخصص', val: this.specMain() });
      if (this.specExp()) data.push({ key: 'سنوات الخبرة', val: this.specExp() });
      if (this.portfolioBio()) {
        const b = this.portfolioBio();
        data.push({ key: 'النبذة المهنية', val: b.substring(0, 60) + (b.length > 60 ? '...' : '') });
      }
    } else if (type === 'affiliate') {
      if (this.chType()) data.push({ key: 'قناة التسويق', val: this.chType() });
      if (this.chReach()) data.push({ key: 'عدد المتابعين', val: this.chReach() });
    } else {
      if (this.coName()) data.push({ key: 'اسم الشركة', val: this.coName() });
      if (this.coCrn()) data.push({ key: 'رقم السجل', val: this.coCrn() });
      if (this.coRole()) data.push({ key: 'المنصب', val: this.coRole() });
    }

    return data;
  }
}
