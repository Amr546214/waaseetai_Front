import { Directive, signal, computed, inject, OnInit, ElementRef } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService } from '../../core/services/account.service';
import { AuthStore } from '../../core/store/auth.store';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { UserRole } from '../../core/models/auth.model';
import { applyServerFieldErrors, attemptSubmit, focusFirstInvalid, InvalidField } from '../../core/forms/form-helpers';
import { mapHttpError } from '../../core/forms/http-error';

export interface FlowStep {
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

@Directive()
export abstract class AddAccountBase implements OnInit {
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

  // Form models. One FormGroup per wizard panel so Next validates only the panel the user is on.
  private readonly requiredTrim = (c: AbstractControl) => (String(c.value ?? '').trim() ? null : { required: true });
  readonly spec = new FormGroup({
    specMain: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    specExp: new FormControl('3-5 سنوات', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly portfolio = new FormGroup({
    portfolioBio: new FormControl('', { nonNullable: true, validators: [this.requiredTrim, Validators.maxLength(1000)] }),
  });
  readonly channel = new FormGroup({
    chType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    chReach: new FormControl('', { nonNullable: true }),
  });
  readonly company = new FormGroup({
    coName: new FormControl('', { nonNullable: true, validators: [this.requiredTrim, Validators.maxLength(150)] }),
    coCrn: new FormControl('', { nonNullable: true, validators: [this.requiredTrim, Validators.maxLength(50)] }),
    coRole: new FormControl('', { nonNullable: true, validators: [this.requiredTrim, Validators.maxLength(100)] }),
  });
  /** Flat access for the template: [formControl]="ctl.specMain". */
  readonly ctl = {
    ...this.spec.controls, ...this.portfolio.controls, ...this.channel.controls, ...this.company.controls,
  };
  private readonly panelGroups: Record<string, FormGroup> = {
    'panel-spec': this.spec, 'panel-portfolio': this.portfolio, 'panel-channel': this.channel, 'panel-company': this.company,
  };
  private readonly fieldPanel: Record<string, string> = {
    specMain: 'panel-spec', specExp: 'panel-spec', portfolioBio: 'panel-portfolio', chType: 'panel-channel', chReach: 'panel-channel',
    coName: 'panel-company', coCrn: 'panel-company', coRole: 'panel-company',
  };
  readonly LABELS: Record<string, string> = {
    specMain: 'التخصص الرئيسي', specExp: 'سنوات الخبرة', portfolioBio: 'النبذة المهنية', chType: 'نوع القناة الرئيسية',
    chReach: 'عدد المتابعين', coName: 'اسم الشركة', coCrn: 'رقم السجل التجاري', coRole: 'المنصب',
  };
  /** What is missing on the current panel (shown by <ws-form-summary>). */
  missing = signal<InvalidField[]>([]);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Shown when the server fails or says something we cannot place on a field. Details stay in the console. */
  static readonly SUBMIT_FAILED_MESSAGE = 'تعذر إرسال طلب إضافة الحساب. حاول مرة أخرى أو تواصل مع الدعم.';

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
    this.missing.set([]);
    this.selectedType.set(type);
    this.flow.set(FLOWS[type] ? [...FLOWS[type]] : []);
    this.stepIdx.set(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private currentPanelId(): string | null {
    return this.flow()[this.stepIdx()]?.id ?? null;
  }

  nextStep() {
    const id = this.currentPanelId();
    const group = id ? this.panelGroups[id] : null;
    if (group) {
      const attempt = attemptSubmit(group, { root: this.host.nativeElement, labels: this.LABELS });
      this.missing.set(attempt.missing);
      if (!attempt.valid) return;
    }
    this.missing.set([]);
    if (this.stepIdx() < this.flow().length - 1) {
      this.stepIdx.update(v => v + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Clicking a row of the summary focuses that field. */
  focusItem(_item: InvalidField) {
    focusFirstInvalid(this.host.nativeElement);
  }

  prevStep() {
    this.missing.set([]);
    if (this.stepIdx() <= 1) {
      this.selectedType.set(null);
      this.stepIdx.set(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.stepIdx.update(v => v - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** First wizard step (index) whose panel has an invalid control, or -1. */
  private firstInvalidStep(): number {
    return this.flow().findIndex(step => {
      const g = this.panelGroups[step.id];
      if (!g) return false;
      g.updateValueAndValidity({ emitEvent: false });
      return g.invalid;
    });
  }

  submit() {
    const type = this.selectedType();
    if (!type || this.isSubmitting()) return;

    // Validate every panel of this flow (not only the one on screen); go back to the first incomplete one.
    const bad = this.firstInvalidStep();
    if (bad !== -1) {
      this.stepIdx.set(bad);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const group = this.panelGroups[this.flow()[bad].id];
      group.markAllAsTouched();
      this.errorMessage.set(null);
      // The panel is rendered after the step changes; validate/focus once it is in the DOM.
      setTimeout(() => {
        const attempt = attemptSubmit(group, { root: this.host.nativeElement, labels: this.LABELS });
        this.missing.set(attempt.missing);
        setTimeout(() => focusFirstInvalid(this.host.nativeElement), 60); // after change detection adds ng-invalid
      }, 30);
      return;
    }
    this.missing.set([]);

    const targetRole = this.mapTypeToRole(type);
    const profileMetadata: Record<string, any> = {
      specMain: this.ctl.specMain.value,
      specExp: this.ctl.specExp.value,
      portfolioBio: this.ctl.portfolioBio.value,
      skills: this.skills(),
      chType: this.ctl.chType.value,
      chReach: this.ctl.chReach.value,
      coName: this.ctl.coName.value,
      coCrn: this.ctl.coCrn.value,
      coRole: this.ctl.coRole.value
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
        this.handleSubmitError(err, targetRole);
      }
    });
  }

  /**
   * 400 with field errors -> under the right field (going back to its step); 409 "already owned" -> clear Arabic message
   * and refresh the owned roles; anything else (500, unknown) -> one fixed Arabic message. Never the server's English text.
   */
  private handleSubmitError(err: unknown, targetRole: UserRole) {
    const mapped = mapHttpError(err, { fallback: AddAccountBase.SUBMIT_FAILED_MESSAGE });
    if (mapped.kind === 'server' || mapped.kind === 'unknown') {
      console.error('[add-account] request failed', err);
    }

    const names = Object.keys(mapped.fieldErrors).filter(n => this.fieldPanel[n]);
    if (mapped.kind === 'backend-validation' && names.length) {
      const stepId = this.fieldPanel[names[0]];
      const idx = this.flow().findIndex(s => s.id === stepId);
      if (idx !== -1) this.stepIdx.set(idx);
      this.errorMessage.set(null);
      const own = Object.fromEntries(names.map(n => [n, mapped.fieldErrors[n]]));
      // Applied after the panel is rendered: binding a control to a fresh input revalidates it and would drop the error.
      setTimeout(() => {
        const group = this.panelGroups[stepId];
        applyServerFieldErrors(group, own);
        const attempt = attemptSubmit(group, { root: this.host.nativeElement, labels: this.LABELS });
        this.missing.set(attempt.missing);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => focusFirstInvalid(this.host.nativeElement), 60);
      }, 30);
      return;
    }

    if (mapped.kind === 'conflict' || /تمتلك هذا الحساب/.test(mapped.message)) {
      this.errorMessage.set(mapped.message);
      this.fetchAccountTypes(); // the card flips to "switch to this account"
    } else if (mapped.kind === 'server' || mapped.kind === 'unknown') {
      this.errorMessage.set(AddAccountBase.SUBMIT_FAILED_MESSAGE);
    } else {
      this.errorMessage.set(mapped.message);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (this.ctl.specMain.value) data.push({ key: 'التخصص', val: this.ctl.specMain.value });
      if (this.ctl.specExp.value) data.push({ key: 'سنوات الخبرة', val: this.ctl.specExp.value });
      if (this.ctl.portfolioBio.value) {
        const b = this.ctl.portfolioBio.value;
        data.push({ key: 'النبذة المهنية', val: b.substring(0, 60) + (b.length > 60 ? '...' : '') });
      }
    } else if (type === 'affiliate') {
      if (this.ctl.chType.value) data.push({ key: 'قناة التسويق', val: this.ctl.chType.value });
      if (this.ctl.chReach.value) data.push({ key: 'عدد المتابعين', val: this.ctl.chReach.value });
    } else {
      if (this.ctl.coName.value) data.push({ key: 'اسم الشركة', val: this.ctl.coName.value });
      if (this.ctl.coCrn.value) data.push({ key: 'رقم السجل', val: this.ctl.coCrn.value });
      if (this.ctl.coRole.value) data.push({ key: 'المنصب', val: this.ctl.coRole.value });
    }

    return data;
  }
}
