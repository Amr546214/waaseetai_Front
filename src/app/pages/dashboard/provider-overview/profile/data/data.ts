import { Component, signal, OnInit, OnDestroy, inject, PLATFORM_ID, computed, DestroyRef, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { HttpEventType } from '@angular/common/http';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { attemptSubmit, applyServerFieldErrors, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError, messageForBackendCode } from '../../../../../core/forms/http-error';
import { MB, validateFile } from '../../../../../core/forms/file-validation';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';

/** Arabic names of the fields, used by the "what is missing" summary. */
const PROFILE_LABELS: Record<string, string> = {
  firstName: 'الاسم الأول', lastName: 'اسم العائلة', headline: 'المسمى المهني', specialty: 'التخصص الرئيسي',
  country: 'الدولة', city: 'المدينة', bio: 'الوصف المهني',
  websiteUrl: 'معرض الأعمال', linkedinUrl: 'LinkedIn', githubUrl: 'GitHub / Behance',
};
const CONTACT_LABELS: Record<string, string> = { email: 'البريد الإلكتروني', phoneNumber: 'رقم الجوال', alternativePhone: 'رقم WhatsApp' };
const PAYOUT_LABELS: Record<string, string> = { paypalPayoutEmail: 'بريد PayPal' };
const DOCS_LABELS: Record<string, string> = { idDocumentUrl: 'مستند الهوية' };
const PASSWORD_LABELS: Record<string, string> = { currentPassword: 'كلمة المرور الحالية', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور' };

/** DOM id of the control that carries each field (focus target for summary rows and server errors). Documents use `doc-card-<name>`. */
const FIELD_IDS: Record<string, string> = {
  firstName: 'pr-fname', lastName: 'pr-lname', headline: 'pr-title', specialty: 'pr-spec', country: 'pr-country', city: 'pr-city',
  bio: 'bio', websiteUrl: 'portfolio-url', linkedinUrl: 'linkedin-url', githubUrl: 'website-url',
  email: 'ct-email', phoneNumber: 'ct-phone', alternativePhone: 'ct-whatsapp',
  paypalPayoutEmail: 'pp-email', currentPassword: 'pwd-old', newPassword: 'pwd-new', confirmPassword: 'pwd-conf',
};

/** Backend rules (provider-profile.service.ts): name 60, headline 100, bio 500, http(s) URLs, phone 8-15 digits, password 8-72 + 3 groups. */
const URL_MESSAGE = 'الرابط غير صالح، يجب أن يبدأ بـ http:// أو https://';
const PHONE_MESSAGE = 'رقم الجوال غير صالح: من 8 إلى 15 رقمًا، ويمكن أن يبدأ بـ +';
const PASSWORD_GROUPS_MESSAGE = 'استخدم 3 أنواع على الأقل من: أحرف صغيرة، أحرف كبيرة، أرقام، رموز';
const WEAK_PASSWORD_MESSAGE = 'كلمة المرور الجديدة لا تحقق متطلبات الأمان: من 8 إلى 72 حرفًا مع 3 أنواع من الأحرف والأرقام والرموز';
const DOC_RULE = { maxBytes: 10 * MB, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], extensions: ['.pdf', '.jpg', '.jpeg', '.png'], typesLabel: 'PDF أو JPG أو PNG' };
const AVATAR_RULE = { maxBytes: 5 * MB, mimeTypes: ['image/png', 'image/jpeg'], extensions: ['.png', '.jpg', '.jpeg'], typesLabel: 'PNG أو JPG' };

const requiredTrim: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  String(c.value ?? '').trim() ? null : { required: true };
const maxTrim = (max: number): ValidatorFn => (c: AbstractControl): ValidationErrors | null => {
  const actualLength = String(c.value ?? '').trim().length;
  return actualLength > max ? { maxlength: { requiredLength: max, actualLength } } : null;
};
const httpUrl: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  try { return ['http:', 'https:'].includes(new URL(v).protocol) ? null : { url: true }; } catch { return { url: true }; }
};
const emailFormat: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : { email: true };
};
/** Same normalisation as the backend (strips spaces, brackets, dashes) before the 8-15 digit check. */
const phoneFormat: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').replace(/[\s()-]/g, '');
  return !v || /^\+?\d{8,15}$/.test(v) ? null : { pattern: true };
};
const passwordRules: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  if (!v) return null;
  if (v.length < 8) return { minlength: { requiredLength: 8, actualLength: v.length } };
  if (v.length > 72) return { maxlength: { requiredLength: 72, actualLength: v.length } };
  const groups = [/[a-z]/.test(v), /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  if (groups < 3) return { pattern: { requiredPattern: '3 groups' } };
  const current = c.parent?.get('currentPassword')?.value;
  return current && current === v ? { sameAsCurrent: true } : null;
};
const matchesNewPassword: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const other = c.parent?.get('newPassword')?.value;
  return c.value && other && c.value !== other ? { mismatch: true } : null;
};

interface DocumentUploadState {
  name: string;
  progress: number;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  previewUrl?: string;
  mimeType?: string;
}

interface ActiveSession {
  id: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-profile-data',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, BioFieldDirective, FieldErrorComponent, FormSummaryComponent],
  templateUrl: './data.html',
  styleUrl: './data.css'
})
export class Data implements OnInit, OnDestroy {
  currentTab = signal<string>('profile');
  showToast = signal<string>('');
  avatarUrl = signal<string | null>(null);
  passwordFormVisible = signal<boolean>(false);

  // Dynamic relation states
  skillsList = signal<any[]>([]);
  portfolioList = signal<any[]>([]);

  /** What is missing after a failed save attempt, per tab (shown by <ws-form-summary>). */
  missingProfile = signal<InvalidField[]>([]);
  missingContact = signal<InvalidField[]>([]);
  missingPayout = signal<InvalidField[]>([]);
  missingDocs = signal<InvalidField[]>([]);
  missingPassword = signal<InvalidField[]>([]);
  /** Inline Arabic problems that are not form-control errors. */
  avatarError = signal('');
  skillError = signal('');
  otpError = signal('');
  docFileErrors = signal<Record<string, string>>({});
  isSavingProfile = signal(false);

  private host = inject(ElementRef<HTMLElement>);
  private ui = inject(UiNotificationService);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  // Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
  readonly countryNames = COUNTRY_NAMES;
  readonly citiesOf = citiesOf;
  readonly cityPlaceholder = cityPlaceholder;
  private profileService = inject(ProviderProfileService);
  private platformId = inject(PLATFORM_ID);
  private authStore = inject(AuthStore);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  profileForm!: FormGroup;
  contactForm!: FormGroup;
  payoutForm!: FormGroup;
  savingPaypal = signal(false);
  docsForm!: FormGroup;
  passwordForm!: FormGroup;
  isChangingPassword = signal(false);
  activeSessions = signal<ActiveSession[]>([]);
  sessionsLoading = signal(false);
  revokingSessionId = signal<string | null>(null);

  showRequestsModal = signal(false);
  requestsList = signal<any[]>([]);
  showOtpModal = signal(false);
  otpCode = signal('');
  otpEmailHint = signal('');
  pendingRequestId = signal('');
  pendingSensitiveCategory = signal<'CONTACT' | 'DOCUMENTS' | null>(null);
  isSaving = signal(false);
  isVerifyingOtp = signal(false);
  documentUploads = signal<Record<string, DocumentUploadState>>({});

  completionPercent = signal(0);
  nextStepHint = signal({ percentage: 0, nextTargetPercentage: 0, message: '' });

  currentProfileData: any = null;

  ngOnInit() {
    // e.g. the withdraw page links to ?tab=payout to add the PayPal email.
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'payout') this.currentTab.set('payout');

    this.profileForm = this.fb.group({
      firstName: ['', [requiredTrim, maxTrim(60)]],
      lastName: ['', [requiredTrim, maxTrim(60)]],
      headline: ['', [requiredTrim, maxTrim(100)]],
      hourlyRate: [0, Validators.min(0)],
      yearsOfExperience: [0, Validators.min(0)],
      availabilityStatus: ['AVAILABLE', Validators.required],
      specialty: ['', requiredTrim],
      country: ['', Validators.required],
      city: ['', Validators.required],
      address: [''],
      bio: ['', Validators.maxLength(500)],
      websiteUrl: ['', httpUrl],
      linkedinUrl: ['', httpUrl],
      twitterUrl: [''],
      githubUrl: ['', httpUrl],
      skillsArray: this.fb.array([]),
      languagesArray: this.fb.array([]),
      uiLanguage: ['ar'],
      timezone: ['Asia/Riyadh'],
      notifyEmail: [true],
      notifySms: [true],
      notifyInApp: [true],
      notifyWhatsapp: [false]
    });

    linkCountryCity(this.profileForm, this.destroyRef);

    this.contactForm = this.fb.group({
      email: ['', [requiredTrim, emailFormat]],
      phoneNumber: ['', [requiredTrim, phoneFormat]],
      alternativePhone: ['', phoneFormat]
    });

    this.payoutForm = this.fb.group({
      paypalPayoutEmail: ['', paypalEmailValidators]
    });

    this.docsForm = this.fb.group({
      idDocumentUrl: ['', Validators.required],
      certificatesUrl: [''],
      commercialRegistration: [''],
      vatCertificateUrl: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordRules]],
      confirmPassword: ['', [Validators.required, matchesNewPassword]]
    });
    // The two dependent rules (differs from current / equals confirmation) follow the field they compare with.
    this.passwordForm.get('currentPassword')!.valueChanges.subscribe(() => this.passwordForm.get('newPassword')!.updateValueAndValidity({ emitEvent: false }));
    this.passwordForm.get('newPassword')!.valueChanges.subscribe(() => this.passwordForm.get('confirmPassword')!.updateValueAndValidity({ emitEvent: false }));

    if (isPlatformBrowser(this.platformId)) {
      this.loadProfile();
      this.loadActiveSessions();
      this.profileForm.valueChanges.subscribe(() => this.calculateCompletion());
      this.contactForm.valueChanges.subscribe(() => this.calculateCompletion());
      this.payoutForm.valueChanges.subscribe(() => this.calculateCompletion());
      this.docsForm.valueChanges.subscribe(() => this.calculateCompletion());
    }
  }

  get skillsArray() {
    return this.profileForm.get('skillsArray') as FormArray;
  }

  get languagesArray() {
    return this.profileForm.get('languagesArray') as FormArray;
  }

  get contactEmailControl(): FormControl {
    return this.contactForm.get('email') as FormControl;
  }

  get contactPhoneControl(): FormControl {
    return this.contactForm.get('phoneNumber') as FormControl;
  }

  loadProfile() {
    this.profileService.getProfile().subscribe({
      next: (profile: any) => {
        if (profile) {
          this.currentProfileData = profile;
          this.profileForm.patchValue({
            firstName: profile.user?.firstName || '',
            lastName: profile.user?.lastName || '',
            headline: profile.headline || '',
            specialty: profile.mainSpecialty || '',
            bio: profile.bio || '',
            hourlyRate: profile.hourlyRate || 0,
            yearsOfExperience: profile.yearsOfExperience || 0,
            availabilityStatus: profile.availabilityStatus || 'AVAILABLE',
            country: normalizeCountry(profile.country),
            city: profile.city || '',
            address: profile.location || '',
            websiteUrl: profile.websiteUrl || '',
            linkedinUrl: profile.linkedinUrl || '',
            twitterUrl: profile.twitterUrl || '',
            githubUrl: profile.githubUrl || '',
            uiLanguage: profile.preferences?.uiLanguage || 'ar',
            timezone: profile.preferences?.timezone || 'Asia/Riyadh',
            notifyEmail: profile.preferences?.notifyEmail ?? true,
            notifySms: profile.preferences?.notifySms ?? true,
            notifyInApp: profile.preferences?.notifyInApp ?? true,
            notifyWhatsapp: profile.preferences?.notifyWhatsapp ?? false,
          });

          this.avatarUrl.set(profile.user?.avatarUrl || null);

          this.contactForm.patchValue({
            email: profile.user?.email || '',
            phoneNumber: profile.user?.phoneNumber || '',
            alternativePhone: profile.user?.alternativePhone || ''
          });

          this.payoutForm.patchValue({
            paypalPayoutEmail: profile.paypalPayoutEmail || ''
          });

          this.docsForm.patchValue({
            idDocumentUrl: profile.user?.idDocumentUrl || '',
            certificatesUrl: profile.certUrls?.[0] || '',
            commercialRegistration: profile.user?.commercialRegistration || '',
            vatCertificateUrl: profile.user?.vatCertificateUrl || ''
          });
          const loadedDocuments: Record<string, DocumentUploadState> = {};
          for (const controlName of ['idDocumentUrl', 'certificatesUrl', 'commercialRegistration', 'vatCertificateUrl']) {
            const url = controlName === 'certificatesUrl' ? profile.certUrls?.[0] : profile.user?.[controlName];
            if (url) loadedDocuments[controlName] = { name: this.fileNameFromUrl(url), progress: 100, status: 'uploaded', previewUrl: url };
          }
          this.documentUploads.set(loadedDocuments);

          // Sync relations
          this.skillsList.set(profile.skills || []);
          this.portfolioList.set(profile.portfolioItems || []);

          this.skillsArray.clear();
          (profile.skills || []).forEach((s: any) => {
            this.skillsArray.push(this.fb.control(s.name));
          });
          this.languagesArray.clear();
          (profile.languages || []).forEach((value: string) => {
            const [name, proficiency = 'مبتدئ'] = value.split('|');
            this.languagesArray.push(this.fb.group({ name: [name], proficiency: [proficiency] }));
          });

          this.calculateCompletion();
        }
      },
      error: (err) => {
        console.error('Error loading profile', err);
        this.ui.httpError(err, { fallback: 'تعذر تحميل بيانات الملف المهني. أعد تحميل الصفحة قبل الحفظ' });
      }
    });
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const problem = validateFile(file, AVATAR_RULE);
    if (problem) {
      this.avatarError.set(problem);
      input.value = '';
      return;
    }
    this.avatarError.set('');
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarUrl.set(reader.result as string);
      this.displayToast('تم اختيار الصورة، سيتم حفظها عند النقر على حفظ');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeAvatar() {
    this.avatarError.set('');
    this.avatarUrl.set(null);
    this.displayToast('تم إزالة الصورة محلياً، احفظ التغييرات للتأكيد');
  }

  getInitials() {
    const f = this.profileForm?.get('firstName')?.value || '';
    const l = this.profileForm?.get('lastName')?.value || '';
    if (f || l) return (f.charAt(0) + l.charAt(0)).trim();
    return 'مخ';
  }

  addSkill(skillInput: HTMLInputElement) {
    const skillName = skillInput.value.trim();
    if (!skillName) { this.skillError.set('اكتب اسم المهارة أولًا'); return; }

    const currentSkills = this.skillsArray.value as string[];
    if (currentSkills.includes(skillName)) { this.skillError.set('هذه المهارة مضافة مسبقًا'); return; }
    this.skillError.set('');
    const newSkills = [...currentSkills, skillName];
    this.profileService.updateSkills(newSkills).subscribe({
      next: (updatedProfile: any) => {
        this.skillsList.set(updatedProfile.skills);
        this.skillsArray.push(this.fb.control(skillName));
        skillInput.value = '';
        this.displayToast('تم إضافة المهارة بنجاح');
      },
      error: (err) => this.skillError.set(mapHttpError(err, { fallback: 'تعذر إضافة المهارة، حاول مرة أخرى' }).message)
    });
  }

  removeSkill(index: number) {
    const currentSkills = [...this.skillsArray.value];
    currentSkills.splice(index, 1);
    this.skillError.set('');
    this.profileService.updateSkills(currentSkills).subscribe({
      next: (updatedProfile: any) => {
        this.skillsList.set(updatedProfile.skills);
        this.skillsArray.removeAt(index);
        this.displayToast('تم إزالة المهارة بنجاح');
      },
      error: (err) => this.skillError.set(mapHttpError(err, { fallback: 'تعذر إزالة المهارة، حاول مرة أخرى' }).message)
    });
  }

  addLanguage() {
    this.languagesArray.push(this.fb.group({
      name: [''],
      proficiency: ['مبتدئ']
    }));
  }

  removeLanguage(index: number) {
    this.languagesArray.removeAt(index);
  }

  addPortfolioItem(title: string, url: string) {
    if (!title?.trim()) { this.ui.warning('أدخل عنوان المشروع أولًا'); return; }
    if (url && httpUrl(new FormControl(url))) { this.ui.warning(`رابط المشروع: ${URL_MESSAGE}`); return; }
    this.profileService.addPortfolioItem({ title, projectUrl: url }).subscribe({
      next: (res) => {
        const current = this.portfolioList();
        this.portfolioList.set([...current, res]);
        this.displayToast('تم إضافة المشروع بنجاح');
      },
      error: (err) => this.ui.httpError(err, { fallback: 'تعذر إضافة المشروع، حاول مرة أخرى' })
    });
  }

  deletePortfolioItem(id: string) {
    this.profileService.deletePortfolioItem(id).subscribe({
      next: () => {
        this.portfolioList.set(this.portfolioList().filter(p => p.id !== id));
        this.displayToast('تم حذف المشروع بنجاح');
      },
      error: (err) => this.ui.httpError(err, { fallback: 'تعذر حذف المشروع، حاول مرة أخرى' })
    });
  }

  setTab(tab: string) {
    this.currentTab.set(tab);
    for (const m of [this.missingProfile, this.missingContact, this.missingPayout, this.missingDocs, this.missingPassword]) m.set([]);
  }

  // ---- shared helpers -------------------------------------------------------------------------------------------

  private panel(tab: string): HTMLElement | null {
    return (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#prof-panel-${tab}`);
  }

  /** Focuses the control (or document card) that carries `path`. Called after the panel is rendered. */
  focusField(path: string) {
    const id = FIELD_IDS[path] ?? `doc-card-${path}`;
    const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`);
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
      if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  onSummarySelect(item: InvalidField) { this.focusField(item.path); }

  /** Raw backend code ("INVALID_URL:githubUrl" -> { code: 'INVALID_URL', arg: 'githubUrl' }), or null. */
  private rawCode(err: any): { code: string; arg: string } | null {
    const raw = err?.error?.message;
    if (typeof raw !== 'string') return null;
    const [code, ...rest] = raw.trim().split(':');
    return /^[A-Z_]+$/.test(code) ? { code, arg: rest.join(':').trim() } : null;
  }

  /**
   * Puts a server message on the control it belongs to (with summary + focus) and returns true,
   * or returns false when the field is not on this form so the caller shows a notification instead.
   */
  private serverFieldError(form: FormGroup, name: string, message: string, summary: (items: InvalidField[]) => void, labels: Record<string, string>): boolean {
    if (!form.get(name) || applyServerFieldErrors(form, { [name]: message }).length) return false;
    summary([{ path: name, label: labels[name] ?? name, message }]);
    this.focusField(name);
    return true;
  }

  private notifyHttpError(err: unknown, options: { fallback: string; unauthorizedIs?: 'credentials' | 'session' }) {
    const mapped = mapHttpError(err, options);
    this.ui.toast(mapped.kind === 'pending-review' ? 'warning' : 'error', mapped.message, { title: mapped.title });
    return mapped;
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  saveProfile() {
    if (this.isSavingProfile()) return;
    const attempt = attemptSubmit(this.profileForm, { root: this.panel('profile'), labels: PROFILE_LABELS });
    this.missingProfile.set(attempt.missing);
    if (!attempt.valid) return;

    const val = this.profileForm.value;
    this.isSavingProfile.set(true);

    this.profileService.updateBasicInfo({
      firstName: val.firstName,
      lastName: val.lastName,
      avatarUrl: this.avatarUrl(),
      headline: val.headline,
      bio: val.bio,
      hourlyRate: val.hourlyRate,
      yearsOfExperience: val.yearsOfExperience,
      availabilityStatus: val.availabilityStatus,
      mainSpecialty: val.specialty,
      country: val.country,
      city: val.city,
      location: val.address,
      websiteUrl: val.websiteUrl,
      linkedinUrl: val.linkedinUrl,
      twitterUrl: val.twitterUrl,
      githubUrl: val.githubUrl,
      languages: (val.languagesArray || []).filter((l: any) => l.name?.trim()).map((l: any) => `${l.name.trim()}|${l.proficiency}`),
      preferences: {
        uiLanguage: val.uiLanguage,
        timezone: val.timezone,
        notifyEmail: val.notifyEmail,
        notifySms: val.notifySms,
        notifyInApp: val.notifyInApp,
        notifyWhatsapp: val.notifyWhatsapp
      }
    }).subscribe({
      next: () => {
        this.isSavingProfile.set(false);
        this.missingProfile.set([]);
        this.displayToast('تم حفظ التغييرات بنجاح');
        this.loadProfile();
      },
      error: (err: any) => {
        this.isSavingProfile.set(false);
        const raw = this.rawCode(err);
        // INVALID_URL:githubUrl -> the githubUrl field.
        if (raw?.code === 'INVALID_URL' && this.serverFieldError(this.profileForm, raw.arg, URL_MESSAGE, i => this.missingProfile.set(i), PROFILE_LABELS)) return;
        const mapped = mapHttpError(err, { fallback: 'تعذر حفظ البيانات، حاول مرة أخرى' });
        const matched = Object.keys(mapped.fieldErrors).filter(k => this.profileForm.get(k));
        if (matched.length && applyServerFieldErrors(this.profileForm, mapped.fieldErrors).length < Object.keys(mapped.fieldErrors).length) {
          this.missingProfile.set(matched.map(k => ({ path: k, label: PROFILE_LABELS[k] ?? k, message: mapped.fieldErrors[k] })));
          this.focusField(matched[0]);
          return;
        }
        this.notifyHttpError(err, { fallback: 'تعذر حفظ البيانات، حاول مرة أخرى' });
      }
    });
  }

  saveContact() {
    if (this.isSaving()) return;
    const attempt = attemptSubmit(this.contactForm, { root: this.panel('contact'), labels: CONTACT_LABELS });
    this.missingContact.set(attempt.missing);
    if (!attempt.valid) return;
    this.startSensitiveChange('CONTACT', this.contactForm.value);
  }

  savePaypal() {
    if (this.savingPaypal()) return;
    const attempt = attemptSubmit(this.payoutForm, { root: this.panel('payout'), labels: PAYOUT_LABELS });
    this.missingPayout.set(attempt.missing);
    if (!attempt.valid) return;
    const email = String(this.payoutForm.value.paypalPayoutEmail || '').trim();
    this.savingPaypal.set(true);
    this.profileService.savePaypalPayoutEmail(email).subscribe({
      next: () => {
        this.savingPaypal.set(false);
        this.missingPayout.set([]);
        this.displayToast('تم حفظ بريد PayPal لاستلام المدفوعات');
      },
      error: (err: any) => {
        this.savingPaypal.set(false);
        const mapped = mapHttpError(err, { fallback: 'تعذر حفظ بريد PayPal، حاول مرة أخرى' });
        const fieldMsg = mapped.fieldErrors['paypalPayoutEmail'] || (mapped.kind === 'backend-validation' && !Object.keys(mapped.fieldErrors).length ? mapped.message : '');
        if (fieldMsg && this.serverFieldError(this.payoutForm, 'paypalPayoutEmail', fieldMsg, i => this.missingPayout.set(i), PAYOUT_LABELS)) return;
        this.notifyHttpError(err, { fallback: 'تعذر حفظ بريد PayPal، حاول مرة أخرى' });
      }
    });
  }

  /** True while any document is still uploading (saving then would send an empty/old URL). */
  docsUploading = computed(() => Object.values(this.documentUploads()).some(d => d.status === 'uploading'));

  private setDocFileError(controlName: string, message: string) {
    this.docFileErrors.update(current => {
      const next = { ...current };
      if (message) next[controlName] = message; else delete next[controlName];
      return next;
    });
  }

  onDocSelected(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const problem = validateFile(file, DOC_RULE);
    if (problem) {
      this.setDocFileError(controlName, problem);
      input.value = '';
      return;
    }
    this.setDocFileError(controlName, '');
    const previousPreview = this.documentState(controlName)?.previewUrl;
    if (previousPreview?.startsWith('blob:')) URL.revokeObjectURL(previousPreview);
    const previewUrl = URL.createObjectURL(file);
    this.setDocumentState(controlName, { name: file.name, progress: 0, status: 'uploading', previewUrl, mimeType: file.type });
    this.profileService.uploadDocument(file).subscribe({
      next: (ev: any) => {
        if (ev.type === HttpEventType.UploadProgress) {
          const progress = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
          this.setDocumentState(controlName, { name: file.name, progress, status: 'uploading', previewUrl, mimeType: file.type });
        }
        if (ev.type === HttpEventType.Response) {
          this.docsForm.get(controlName)?.setValue(ev.body.data.url);
          this.setDocumentState(controlName, { name: ev.body.data.name || file.name, progress: 100, status: 'uploaded', previewUrl, mimeType: file.type });
          this.displayToast('تم رفع الملف بأمان، أكد الطلب لحفظ التغيير');
        }
      },
      error: (err: any) => {
        this.setDocumentState(controlName, { name: file.name, progress: 0, status: 'error', previewUrl, mimeType: file.type });
        this.setDocFileError(controlName, mapHttpError(err, { fallback: 'تعذر رفع الملف، حاول مرة أخرى' }).message);
      }
    });
    input.value = '';
  }

  documentState(controlName: string): DocumentUploadState | null {
    return this.documentUploads()[controlName] || null;
  }

  removeDocument(controlName: string, input?: HTMLInputElement) {
    const previewUrl = this.documentState(controlName)?.previewUrl;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    this.docsForm.get(controlName)?.setValue('');
    this.setDocFileError(controlName, '');
    if (input) input.value = '';
    const next = { ...this.documentUploads() };
    delete next[controlName];
    this.documentUploads.set(next);
    this.calculateCompletion();
    this.displayToast('تم حذف المستند من التعديلات الحالية. اضغط حفظ لتأكيد التغيير');
  }

  isImageDocument(file: DocumentUploadState): boolean {
    return file.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp)(?:\?|$)/i.test(file.previewUrl || file.name);
  }

  previewDocument(controlName: string) {
    const url = this.documentState(controlName)?.previewUrl || this.docsForm.get(controlName)?.value;
    if (url && isPlatformBrowser(this.platformId)) window.open(url, '_blank', 'noopener,noreferrer');
  }

  private setDocumentState(controlName: string, state: DocumentUploadState) {
    this.documentUploads.update(current => ({ ...current, [controlName]: state }));
  }

  private fileNameFromUrl(url: string): string {
    const raw = decodeURIComponent(String(url).split('/').pop() || 'مستند محفوظ');
    const withoutOwnerPrefix = raw.replace(/^[^_]+_/, '');
    return withoutOwnerPrefix || 'مستند محفوظ';
  }

  saveDocs() {
    if (this.isSaving() || this.docsUploading()) return;
    const attempt = attemptSubmit(this.docsForm, { root: this.panel('docs'), labels: DOCS_LABELS });
    this.missingDocs.set(attempt.missing);
    if (!attempt.valid) {
      this.focusField(attempt.missing[0].path);
      return;
    }
    this.startSensitiveChange('DOCUMENTS', this.docsForm.value);
  }

  private startSensitiveChange(category: 'CONTACT' | 'DOCUMENTS', changes: Record<string, unknown>) {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.profileService.initiateSensitiveChange(category, changes).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.missingContact.set([]);
        this.missingDocs.set([]);
        this.pendingSensitiveCategory.set(category);
        this.pendingRequestId.set(res.data.requestId);
        this.otpEmailHint.set(res.data.emailHint);
        this.otpCode.set('');
        this.otpError.set('');
        this.showOtpModal.set(true);
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.handleSensitiveError(category, err);
      }
    });
  }

  /** Backend code -> the field it belongs to (OTP_EMAIL_DELIVERY_FAILED and unknown codes go to a notification). */
  private handleSensitiveError(category: 'CONTACT' | 'DOCUMENTS', err: any) {
    const raw = this.rawCode(err);
    const form = category === 'CONTACT' ? this.contactForm : this.docsForm;
    const labels = category === 'CONTACT' ? CONTACT_LABELS : DOCS_LABELS;
    const setSummary = (i: InvalidField[]) => (category === 'CONTACT' ? this.missingContact : this.missingDocs).set(i);
    const field = raw ? ({
      INVALID_EMAIL: 'email', EMAIL_ALREADY_USED: 'email', INVALID_PHONE: 'phoneNumber', PHONE_ALREADY_USED: 'phoneNumber',
      INVALID_ALTERNATIVE_PHONE: 'alternativePhone', ID_DOCUMENT_REQUIRED: 'idDocumentUrl', INVALID_DOCUMENT_URL: raw.arg,
    } as Record<string, string>)[raw.code] : undefined;
    const message = raw ? messageForBackendCode(raw.code) : null;
    if (field && message && this.serverFieldError(form, field, message, setSummary, labels)) return;
    const fallback = 'تعذر إنشاء طلب التعديل. حاول مرة أخرى';
    this.notifyHttpError(err, { fallback });
  }

  closeOtpModal() {
    this.showOtpModal.set(false);
    this.otpCode.set('');
    this.otpError.set('');
  }

  updateOtpCode(event: Event) {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.otpCode.set(value);
    this.otpError.set('');
  }

  verifyOtp() {
    if (this.isVerifyingOtp()) return;
    if (this.otpCode().length !== 6) {
      this.otpError.set('أدخل رمز التحقق المكوّن من 6 أرقام');
      (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#otp-code')?.focus();
      return;
    }
    this.isVerifyingOtp.set(true);
    this.profileService.verifySensitiveChange(this.pendingRequestId(), this.otpCode()).subscribe({
      next: (res: any) => {
        this.isVerifyingOtp.set(false);
        this.showOtpModal.set(false);
        this.otpError.set('');
        const underReview = res.data.status === 'PENDING_HUMAN_REVIEW';
        this.displayToast(underReview ? 'تم تأكيد البريد وإرسال الطلب للمراجعة' : 'تم تأكيد البريد وتطبيق التغيير بنجاح');
        this.loadProfile();
      },
      error: (err: any) => {
        this.isVerifyingOtp.set(false);
        const raw = this.rawCode(err);
        // The modal covers the page, so the problem is shown inside it.
        this.otpError.set(raw?.code === 'INVALID_OR_EXPIRED_OTP'
          ? 'رمز التحقق غير صحيح أو انتهت صلاحيته'
          : mapHttpError(err, { fallback: 'تعذر تأكيد الرمز، حاول مرة أخرى' }).message);
      }
    });
  }

  passwordStrength() {
    const value = String(this.passwordForm?.get('newPassword')?.value || '');
    if (!value) return { percent: 0, label: 'قوة كلمة المرور', color: 'transparent' };
    const groups = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    const score = Math.min(4, (value.length >= 8 ? 1 : 0) + (value.length >= 12 ? 1 : 0) + Math.min(2, groups - 1));
    return score <= 1 ? { percent: 25, label: 'ضعيفة', color: '#FF6B6B' }
      : score === 2 ? { percent: 50, label: 'متوسطة', color: '#FFB400' }
      : score === 3 ? { percent: 75, label: 'جيدة', color: '#2B7FFF' }
      : { percent: 100, label: 'قوية', color: '#2BD4C7' };
  }

  changePassword() {
    if (this.isChangingPassword()) return;
    const attempt = attemptSubmit(this.passwordForm, { root: this.panel('security'), labels: PASSWORD_LABELS });
    const pw = this.passwordForm.get('newPassword')!;
    const confirm = this.passwordForm.get('confirmPassword')!;
    // The generic kit text for these keys is not specific enough for the password rules.
    this.missingPassword.set(attempt.missing.map(m =>
      m.path === 'newPassword' && pw.hasError('pattern') ? { ...m, message: PASSWORD_GROUPS_MESSAGE }
      : m.path === 'newPassword' && pw.hasError('sameAsCurrent') ? { ...m, message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' }
      : m.path === 'confirmPassword' && confirm.hasError('mismatch') ? { ...m, message: 'تأكيد كلمة المرور غير مطابق' }
      : m));
    if (!attempt.valid) return;
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.isChangingPassword.set(true);
    this.profileService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.passwordForm.reset();
        this.missingPassword.set([]);
        this.passwordFormVisible.set(false);
        this.displayToast('تم تغيير كلمة المرور بنجاح');
      },
      error: (err: any) => {
        this.isChangingPassword.set(false);
        const raw = this.rawCode(err);
        const setSummary = (i: InvalidField[]) => this.missingPassword.set(i);
        if (raw?.code === 'CURRENT_PASSWORD_INCORRECT' && this.serverFieldError(this.passwordForm, 'currentPassword', messageForBackendCode(raw.code)!, setSummary, PASSWORD_LABELS)) return;
        if (raw?.code === 'PASSWORD_UNCHANGED' && this.serverFieldError(this.passwordForm, 'newPassword', messageForBackendCode(raw.code)!, setSummary, PASSWORD_LABELS)) return;
        if (raw?.code === 'WEAK_PASSWORD' && this.serverFieldError(this.passwordForm, 'newPassword', WEAK_PASSWORD_MESSAGE, setSummary, PASSWORD_LABELS)) return;
        this.notifyHttpError(err, { fallback: 'تعذر تغيير كلمة المرور، حاول مجددًا', unauthorizedIs: 'credentials' });
      }
    });
  }

  loadActiveSessions() {
    this.sessionsLoading.set(true);
    this.profileService.getActiveSessions().subscribe({
      next: (response: any) => { this.activeSessions.set(response.data || []); this.sessionsLoading.set(false); },
      error: (err) => { this.sessionsLoading.set(false); this.notifyHttpError(err, { fallback: 'تعذر تحميل جلسات الدخول' }); }
    });
  }

  revokeSession(session: ActiveSession) {
    if (session.isCurrent || this.revokingSessionId()) return;
    this.revokingSessionId.set(session.id);
    this.profileService.revokeSession(session.id).subscribe({
      next: () => {
        this.revokingSessionId.set(null);
        this.activeSessions.update(items => items.filter(item => item.id !== session.id));
        this.displayToast('تم إنهاء الجلسة بنجاح');
      },
      error: (err) => { this.revokingSessionId.set(null); this.notifyHttpError(err, { fallback: 'تعذر إنهاء الجلسة' }); }
    });
  }

  sessionLastSeen(value: string) {
    const date = new Date(value);
    const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return 'نشطة الآن';
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    if (diffMinutes < 1440) return `منذ ${Math.floor(diffMinutes / 60)} ساعة`;
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  openRequestsModal() {
    this.profileService.getChangeRequests(this.currentTab()).subscribe({
      next: (requests) => {
        this.requestsList.set(requests);
        this.showRequestsModal.set(true);
      },
      error: (err) => this.notifyHttpError(err, { fallback: 'تعذر تحميل طلبات التعديل' })
    });
  }

  closeRequestsModal() {
    this.showRequestsModal.set(false);
  }

  calculateCompletion() {
    const profile = this.currentProfileData;
    if (!profile) return;

    const pForm = this.profileForm.value;
    const cForm = this.contactForm.value;
    const dForm = this.docsForm.value;

    let current = 0;
    let missing: { name: string; weight: number; hint: string }[] = [];

    // Tab 1: 40%
    if (this.avatarUrl() || profile.user?.avatarUrl) {
      current += 10;
    } else {
      missing.push({ name: 'avatar', weight: 10, hint: 'صورة شخصية' });
    }

    if (pForm.firstName && pForm.lastName && pForm.headline && pForm.hourlyRate && pForm.yearsOfExperience) {
      current += 10;
    } else {
      missing.push({ name: 'basicInfo', weight: 10, hint: 'البيانات الأساسية' });
    }

    if (pForm.bio && pForm.bio.length >= 50) {
      current += 10;
    } else {
      missing.push({ name: 'bio', weight: 10, hint: 'وصفًا مهنيًا' });
    }

    if (this.portfolioList().length > 0) {
      current += 10;
    } else {
      missing.push({ name: 'portfolio', weight: 10, hint: 'أمثلة أعمال' });
    }

    // Tab 2: 20%
    if (cForm.phoneNumber) {
      current += 10;
    } else {
      missing.push({ name: 'phone', weight: 10, hint: 'رقم الجوال' });
    }

    if (pForm.city && pForm.country) {
      current += 10;
    } else {
      missing.push({ name: 'location', weight: 10, hint: 'المدينة والدولة' });
    }

    // Tab 3: 15%
    if (this.payoutForm.get('paypalPayoutEmail')?.valid) {
      current += 15;
    } else {
      missing.push({ name: 'payout', weight: 15, hint: 'حساب PayPal لاستلام المدفوعات' });
    }

    // Tab 4: 15%
    if (dForm.idDocumentUrl || profile.user?.idDocumentUrl) {
      current += 15;
    } else {
      missing.push({ name: 'id', weight: 15, hint: 'مستندات إثبات الهوية' });
    }

    // Tab 5: 10% (Security - Defaulting to 10 for now as MFA is visually active)
    current += 10;

    let nextTarget = current;
    let hintMsg = '';

    if (missing.length > 0) {
      // Sort by weight descending to prioritize biggest impacts
      missing.sort((a, b) => b.weight - a.weight);

      const topMissing = missing.slice(0, 2);
      const addedWeight = topMissing.reduce((sum, item) => sum + item.weight, 0);
      nextTarget = current + addedWeight;

      const hints = topMissing.map(m => m.hint).join(' و');
      hintMsg = `أضف ${hints} لرفع الاكتمال إلى ${nextTarget}%`;
    } else {
      hintMsg = 'ملفك المهني مكتمل 100%! أنت جاهز للعمل.';
    }

    this.completionPercent.set(current);
    this.nextStepHint.set({
      percentage: current,
      nextTargetPercentage: nextTarget,
      message: hintMsg
    });
  }

  displayToast(msg: string) {
    this.showToast.set(msg);
    // Keep the handle: an older timer must never clear a newer toast.
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.showToast.set(''); this.toastTimer = null; }, 3500);
  }
}
