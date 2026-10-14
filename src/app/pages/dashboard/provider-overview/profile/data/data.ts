import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { Component, signal, OnInit, inject, PLATFORM_ID, computed, DestroyRef, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ProviderProfileService, CompletionMissingItem } from '../../../../../core/services/provider-profile.service';
import { HttpEventType } from '@angular/common/http';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { attemptSubmit, applyServerFieldErrors, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError, messageForBackendCode } from '../../../../../core/forms/http-error';
import { MB, validateFile } from '../../../../../core/forms/file-validation';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { OtpInputComponent } from '../../../../../shared/forms/otp-input.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { birthDateValidator, dobInputValue } from '../../../../../core/forms/birth-date';
import { canonicalStoredPhone, phoneCountryView, type PhoneCountryView } from '../../../../../core/forms/phone-countries';
import { SkillsPickerComponent } from '../../../../../shared/forms/skills-picker.component';
import { PaypalEmailConfirmComponent } from '../../../../../shared/forms/paypal-email-confirm.component';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { KycAccess, KycDocumentKey } from '../../../../../core/models/kyc-document.model';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';

/** Arabic names of the fields, used by the "what is missing" summary. */
const PROFILE_LABELS: Record<string, string> = {
  firstName: 'الاسم الأول', lastName: 'اسم العائلة', headline: 'المسمى المهني', specialty: 'التخصص الرئيسي',
  country: 'الدولة', city: 'المدينة', bio: 'الوصف المهني',
  websiteUrl: 'رابط معرض الأعمال', linkedinUrl: 'LinkedIn', githubUrl: 'GitHub',
};
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

/** Completion-box items that are fixed by ONE field: clicking the item goes to (and focuses) that field. */
const MISSING_ITEM_FIELD: Record<string, string> = { portfolio: 'websiteUrl' };

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
  /** A document already stored as PRIVATE: it has no previewUrl; it is opened through the access-link endpoint. */
  stored?: { key: KycDocumentKey; index?: number };
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
  imports: [CommonModule, RouterModule, ReactiveFormsModule, BioFieldDirective, FieldErrorComponent, FormSummaryComponent, KycDocumentLink, PaypalEmailConfirmComponent, OtpInputComponent, SkillsPickerComponent],
  templateUrl: './data.html',
  styleUrl: './data.css'
})
export class Data implements OnInit {
  currentTab = signal<string>('profile');
  avatarUrl = signal<string | null>(null);
  /** True only after the user picked a new image or explicitly removed it; an untouched avatar is never sent (never as null). */
  private avatarDirty = false;
  passwordFormVisible = signal<boolean>(false);

  // Dynamic relation states
  skillsList = signal<any[]>([]);
  portfolioList = signal<any[]>([]);

  /** What is missing after a failed save attempt, per tab (shown by <ws-form-summary>). */
  missingProfile = signal<InvalidField[]>([]);
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
  payoutForm!: FormGroup;
  savingPaypal = signal(false);
  /** The new PayPal email waiting for its e-mailed code (finance #33); null when no change is in progress. */
  pendingPaypalEmail = signal<string | null>(null);
  /** The PayPal email saved on the account ('' when none): decides "إضافة" (nothing saved yet) vs "تغيير" (one exists). */
  storedPaypalEmail = signal('');
  paypalHasEmail = computed(() => !!this.storedPaypalEmail().trim());
  /** Masked ACCOUNT email the code went to, and the mode the server decided for this request (shown in the confirmation panel). */
  paypalAccountEmailHint = signal('');
  paypalConfirmMode = signal<'add' | 'change'>('change');
  /** A failed first step (mail not sent, throttled, invalid): shown under the button; the OTP panel stays closed. */
  paypalRequestError = signal('');
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
  /** Where the identity document stands (from the backend, so it survives a refresh): waiting for the admin, approved, rejected, or not sent. */
  identityVerification = signal<{ status: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'NOT_SUBMITTED'; category?: 'DOCUMENTS' | 'KYC' | null; requestId: string | null; submittedAt: string | null; rejectionReason: string | null } | null>(null);
  identityPending = computed(() => this.identityVerification()?.status === 'PENDING_REVIEW');
  identityRejected = computed(() => this.identityVerification()?.status === 'REJECTED');
  identityVerified = computed(() => this.identityVerification()?.status === 'VERIFIED');
  identityRejectionReason = computed(() => this.identityVerification()?.rejectionReason ?? null);
  /** True right after the code was confirmed in this visit: the confirmation is shown prominently (a transient notification alone is easy to miss). */
  identityJustSubmitted = signal(false);
  otpEmailHint = signal('');
  pendingRequestId = signal('');
  pendingSensitiveCategory = signal<'DOCUMENTS' | null>(null);
  isSaving = signal(false);
  isVerifyingOtp = signal(false);
  documentUploads = signal<Record<string, DocumentUploadState>>({});

  /** Both come from the backend (GET /provider/profile): the percentage and what is still needed, so they cannot disagree. */
  completionPercent = signal(0);
  /** True once the completion came from the server: the progress card never flashes 0% for a complete profile. */
  completionLoaded = signal(false);
  missingItems = signal<CompletionMissingItem[]>([]);
  hasMissing = computed(() => this.missingItems().some(i => i.status === 'missing' || i.status === 'rejected'));
  hasPending = computed(() => this.missingItems().some(i => i.status === 'pending_review'));

  currentProfileData: any = null;
  dobLocked = signal(false);
  readonly todayIso = new Date().toISOString().slice(0, 10);
  /** Contact details are DISPLAY-ONLY (the e-mail and the phone cannot be changed from the interface: no code, no request, no review). */
  contactEmail = signal('');
  contactPhone = signal<PhoneCountryView | null>(null);
  contactWhatsapp = signal('');
  /** WhatsApp (optional) is the only editable contact number: saved directly, no code, no review. */
  whatsappControl = new FormControl<string>('', { nonNullable: true, validators: [(c: AbstractControl): ValidationErrors | null => { const v = String(c.value ?? '').replace(/[\s()-]/g, ''); return !v || /^\+?\d{8,15}$/.test(v) ? null : { whatsapp: true }; }] });
  savingWhatsapp = signal(false);
  skillNames = computed(() => (this.skillsList() || []).map((sk: any) => sk.name as string));

  // ── taxonomy: main specialty (the marketplace Category, stored as its slug), sub-specialties and the skills catalog of that field ──
  categories = signal<Array<{ id: string; slug: string; nameAr: string; specialties?: Array<{ id: string; nameAr: string }> }>>([]);
  subSpecOptions = signal<string[]>([]);
  selectedSubSpecs = signal<string[]>([]);
  skillOptions = signal<string[]>([]);
  /** The stored main specialty is older free text that is not a marketplace specialty: shown so the provider knows to pick a real one. */
  legacySpecialty = signal('');
  specialtyWarning = signal('');
  private storedMainSpecialty = '';
  private storedSubSpecialties: string[] = [];

  ngOnInit() {
    // e.g. the withdraw page links to ?tab=payout to add the PayPal email.
    const tab = this.route.snapshot.queryParamMap.get('tab');
    // ?tab= opens the matching tab (the withdraw page -> payout; "edit and send again" on a rejected request -> docs / contact)
    if (tab === 'payout' || tab === 'docs' || tab === 'contact') this.currentTab.set(tab);

    this.profileForm = this.fb.group({
      firstName: ['', [requiredTrim, maxTrim(60)]],
      lastName: ['', [requiredTrim, maxTrim(60)]],
      headline: ['', [requiredTrim, maxTrim(100)]],
      hourlyRate: [0, Validators.min(0)],
      yearsOfExperience: [0, Validators.min(0)],
      availabilityStatus: ['AVAILABLE', Validators.required],
      specialty: ['', requiredTrim],
      // Date of birth: private to the owner, optional, frozen once the account is verified.
      dob: ['', birthDateValidator],
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
      this.loadTaxonomy();
      this.loadActiveSessions();
    }
  }

  get skillsArray() {
    return this.profileForm.get('skillsArray') as FormArray;
  }

  get languagesArray() {
    return this.profileForm.get('languagesArray') as FormArray;
  }

  loadProfile() {
    this.profileService.getProfile().subscribe({
      next: (profile: any) => {
        if (profile) {
          this.currentProfileData = profile;
          this.dobLocked.set(profile.kycStatus === 'VERIFIED' && !!profile.dob);
          if (this.dobLocked()) this.profileForm.get('dob')?.disable({ emitEvent: false }); else this.profileForm.get('dob')?.enable({ emitEvent: false });
          this.profileForm.patchValue({
            firstName: profile.user?.firstName || '',
            lastName: profile.user?.lastName || '',
            headline: profile.headline || '',
            specialty: profile.mainSpecialty || '',
            dob: dobInputValue(profile.dob),
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

          // The avatar the provider edits lives on the provider profile (the legacy user column is only a fallback).
          this.avatarUrl.set(profile.avatarUrl || profile.user?.avatarUrl || null);
          this.avatarDirty = false;

          // The stored pair is shown as ONE consistent number (flag + country + code + local number); an older row saved next to the wrong code is repaired for display.
          this.contactEmail.set(profile.user?.email || '');
          this.contactPhone.set(phoneCountryView(canonicalStoredPhone(profile.user?.phoneCountryCode, profile.user?.phoneNumber)));
          this.contactWhatsapp.set(profile.user?.alternativePhone || '');
          this.whatsappControl.setValue(profile.user?.alternativePhone || '', { emitEvent: false });

          this.payoutForm.patchValue({
            paypalPayoutEmail: profile.paypalPayoutEmail || ''
          });
          this.storedPaypalEmail.set((profile.paypalPayoutEmail || '').trim());

          this.docsForm.patchValue({
            idDocumentUrl: profile.user?.idDocumentUrl || '',
            certificatesUrl: profile.certUrls?.[0] || '',
            commercialRegistration: profile.user?.commercialRegistration || '',
            vatCertificateUrl: profile.user?.vatCertificateUrl || ''
          });
          const loadedDocuments: Record<string, DocumentUploadState> = {};
          // A stored PRIVATE document comes back as null plus a "<field>Access" marker; it is opened through the access-link endpoint.
          const stored: Record<string, { url?: string | null; access?: KycAccess | null; key?: KycDocumentKey; index?: number }> = {
            idDocumentUrl: { url: profile.user?.idDocumentUrl, access: profile.user?.idDocumentUrlAccess, key: 'user_id_document' },
            certificatesUrl: { url: profile.certUrls?.[0], access: profile.certUrlsAccess?.[0], key: 'provider_certificate', index: 0 },
            commercialRegistration: { url: profile.user?.commercialRegistration },
            vatCertificateUrl: { url: profile.user?.vatCertificateUrl, access: profile.user?.vatCertificateUrlAccess, key: 'user_vat_certificate' }
          };
          for (const [controlName, doc] of Object.entries(stored)) {
            if (doc.access?.private && doc.key) {
              loadedDocuments[controlName] = { name: 'مستند محفوظ', progress: 100, status: 'uploaded', stored: { key: doc.key, index: doc.index } };
            } else if (doc.url) {
              loadedDocuments[controlName] = { name: this.fileNameFromUrl(doc.url), progress: 100, status: 'uploaded', previewUrl: doc.url };
            }
          }
          // An ID sent in the SETUP lives in the front-ID column (a private reference, never returned): while it waits for the review, or once it is approved,
          // it is shown as stored (preview link), so the page never asks for the same file again. A refused one is not shown: it must be replaced.
          const idStatus = profile.identityVerification?.status;
          if (!loadedDocuments['idDocumentUrl'] && profile.frontIdUrlAccess?.private && (idStatus === 'PENDING_REVIEW' || idStatus === 'VERIFIED')) {
            loadedDocuments['idDocumentUrl'] = { name: 'مستند الهوية المرسل', progress: 100, status: 'uploaded', stored: { key: 'provider_front_id' } };
          }
          this.documentUploads.set(loadedDocuments);
          // The stored ID document is not visible to this page, so it cannot be re-sent: "required" is satisfied by it until the user replaces or removes it.
          if (loadedDocuments['idDocumentUrl']?.stored) {
            this.docsForm.get('idDocumentUrl')?.clearValidators();
            this.docsForm.get('idDocumentUrl')?.updateValueAndValidity();
          }

          // Specialty: the stored value is normalised to a marketplace category (slug / id / Arabic name); anything else is flagged as older free text.
          this.storedMainSpecialty = String(profile.mainSpecialty || '');
          this.storedSubSpecialties = Array.isArray(profile.subSpecialties) ? profile.subSpecialties : [];
          this.selectedSubSpecs.set([...this.storedSubSpecialties]);
          this.applyTaxonomy();

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

          this.applyCompletion(profile);
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
      this.avatarDirty = true;
      this.ui.info('تم اختيار الصورة، سيتم حفظها عند النقر على حفظ');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeAvatar() {
    this.avatarError.set('');
    this.avatarUrl.set(null);
    this.avatarDirty = true;
    this.ui.info('تم إزالة الصورة محلياً، احفظ التغييرات للتأكيد');
  }

  getInitials() {
    const f = this.profileForm?.get('firstName')?.value || '';
    const l = this.profileForm?.get('lastName')?.value || '';
    if (f || l) return (f.charAt(0) + l.charAt(0)).trim();
    return 'مخ';
  }

  /** The skills picker (catalog of the chosen field): every add/remove is saved at once, exactly like the old chip editor. */
  onSkillsChange(next: string[]) {
    this.skillError.set('');
    this.profileService.updateSkills(next).subscribe({
      next: (updatedProfile: any) => {
        this.skillsList.set(updatedProfile.skills);
        this.skillsArray.clear();
        (updatedProfile.skills || []).forEach((sk: any) => this.skillsArray.push(this.fb.control(sk.name)));
        this.ui.success('تم تحديث المهارات');
        this.loadProfile();
      },
      error: (err) => this.skillError.set(mapHttpError(err, { fallback: 'تعذر تحديث المهارات، حاول مرة أخرى' }).message)
    });
  }

  // ── taxonomy ──
  private loadTaxonomy() {
    this.profileService.getSpecialtyCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => { this.categories.set(res?.success ? res.data : []); this.applyTaxonomy(); },
      error: () => this.categories.set([])
    });
  }

  private categoryOf(value: string) {
    const v = (value || '').trim();
    return this.categories().find(c => c.slug === v || c.id === v || c.nameAr === v) ?? null;
  }

  /** Needs both the profile and the taxonomy: shows the stored main specialty as the matching category (or flags older free text). */
  private applyTaxonomy() {
    if (!this.categories().length || !this.currentProfileData) return;
    const category = this.categoryOf(this.storedMainSpecialty);
    if (category) {
      this.legacySpecialty.set('');
      this.profileForm.get('specialty')?.setValue(category.slug, { emitEvent: false });
      this.subSpecOptions.set((category.specialties ?? []).map(sp => sp.nameAr));
      this.loadSkillOptions(category.slug);
    } else {
      this.legacySpecialty.set(this.storedMainSpecialty);
      this.profileForm.get('specialty')?.setValue('', { emitEvent: false });
      this.subSpecOptions.set([]);
      this.skillOptions.set([]);
    }
  }

  private loadSkillOptions(slug: string) {
    this.profileService.getSkillsCatalog(slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.skillOptions.set(res?.success ? (res.data?.skills ?? []) : []),
      error: () => this.skillOptions.set([])
    });
  }

  /** The provider picked another main specialty: show its sub-specialties and skills, and warn what will be removed when saving. */
  onSpecialtyChanged() {
    const category = this.categoryOf(String(this.profileForm.get('specialty')?.value || ''));
    this.specialtyWarning.set('');
    this.legacySpecialty.set('');
    if (!category) { this.subSpecOptions.set([]); this.skillOptions.set([]); return; }
    const options = (category.specialties ?? []).map(sp => sp.nameAr);
    this.subSpecOptions.set(options);
    const keptSubs = this.selectedSubSpecs().filter(n => options.includes(n));
    const droppedSubs = this.selectedSubSpecs().length - keptSubs.length;
    this.selectedSubSpecs.set(keptSubs);
    this.profileService.getSkillsCatalog(category.slug).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        const skills = res?.success ? (res.data?.skills ?? []) : [];
        this.skillOptions.set(skills);
        const sameField = this.categoryOf(this.storedMainSpecialty)?.slug === category.slug;
        const droppedSkills = sameField ? 0 : (this.skillsList() || []).filter((sk: any) => !skills.includes(sk.name)).length;
        const parts = [droppedSubs ? `${droppedSubs} تخصص فرعي` : '', droppedSkills ? `${droppedSkills} مهارة` : ''].filter(Boolean);
        if (parts.length) this.specialtyWarning.set(`عند الحفظ ستُزال ${parts.join(' و')} لا تتبع التخصص الجديد.`);
      },
      error: () => this.skillOptions.set([])
    });
  }

  toggleSubSpec(name: string) {
    this.selectedSubSpecs.update(list => list.includes(name) ? list.filter(n => n !== name) : (list.length >= 30 ? list : [...list, name]));
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
        this.ui.success('تم إضافة المشروع بنجاح');
      },
      error: (err) => this.ui.httpError(err, { fallback: 'تعذر إضافة المشروع، حاول مرة أخرى' })
    });
  }

  deletePortfolioItem(id: string) {
    this.profileService.deletePortfolioItem(id).subscribe({
      next: () => {
        this.portfolioList.set(this.portfolioList().filter(p => p.id !== id));
        this.ui.success('تم حذف المشروع بنجاح');
      },
      error: (err) => this.ui.httpError(err, { fallback: 'تعذر حذف المشروع، حاول مرة أخرى' })
    });
  }

  setTab(tab: string) {
    this.currentTab.set(tab);
    for (const m of [this.missingProfile, this.missingPayout, this.missingDocs, this.missingPassword]) m.set([]);
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
    // the error-message interceptor replaces `message` with Arabic and keeps the original code (and its ':arg') in rawMessage
    const raw = err?.error?.rawMessage ?? err?.error?.message;
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
      // sent only when the user changed it: a new image, or null for an explicit removal
      ...(this.avatarDirty ? { avatarUrl: this.avatarUrl() } : {}),
      headline: val.headline,
      bio: val.bio,
      hourlyRate: val.hourlyRate,
      yearsOfExperience: val.yearsOfExperience,
      availabilityStatus: val.availabilityStatus,
      mainSpecialty: val.specialty,
      ...(val.dob && !this.dobLocked() ? { dob: val.dob } : {}),
      subSpecialties: this.selectedSubSpecs(),
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
        this.ui.success('تم حفظ التغييرات بنجاح');
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

  saveWhatsapp() {
    if (this.savingWhatsapp()) return;
    this.whatsappControl.markAsTouched();
    if (this.whatsappControl.invalid) return;
    this.savingWhatsapp.set(true);
    this.profileService.updateWhatsapp(this.whatsappControl.value).subscribe({
      next: res => {
        this.savingWhatsapp.set(false);
        this.contactWhatsapp.set(res.data.alternativePhone || '');
        this.whatsappControl.setValue(res.data.alternativePhone || '', { emitEvent: false });
        this.whatsappControl.markAsPristine();
        this.ui.success(res.message || 'تم حفظ رقم WhatsApp');
      },
      error: (err: any) => {
        this.savingWhatsapp.set(false);
        this.whatsappControl.setErrors({ server: mapHttpError(err, { fallback: 'تعذر حفظ رقم WhatsApp، حاول مرة أخرى' }).message });
      }
    });
  }

  savePaypal() {
    if (this.savingPaypal()) return;
    const attempt = attemptSubmit(this.payoutForm, { root: this.panel('payout'), labels: PAYOUT_LABELS });
    this.missingPayout.set(attempt.missing);
    if (!attempt.valid) return;
    const email = String(this.payoutForm.value.paypalPayoutEmail || '').trim();
    this.savingPaypal.set(true);
    this.paypalRequestError.set('');
    // A PayPal email is never saved directly: a code is e-mailed to the account email first (finance #33).
    this.profileService.requestPaypalEmailChange(email).subscribe({
      next: (r) => {
        this.savingPaypal.set(false);
        this.missingPayout.set([]);
        // "أرسلنا رمزًا" is said (and the OTP panel opened) ONLY when the server confirms the mail was accepted.
        if (r.emailSent === true) {
          this.paypalAccountEmailHint.set(r.emailHint || '');
          this.paypalConfirmMode.set(r.mode ?? (this.paypalHasEmail() ? 'change' : 'add'));
          this.pendingPaypalEmail.set(email);
          this.ui.info(`أرسلنا رمز التحقق إلى بريد حسابك${r.emailHint ? ': ' + r.emailHint : ''}`);
        } else {
          this.pendingPaypalEmail.set(null);
          this.paypalRequestError.set('تعذر إرسال رمز التحقق، حاول مرة أخرى');
        }
      },
      error: (err: any) => {
        this.savingPaypal.set(false);
        const mapped = mapHttpError(err, { fallback: 'تعذر حفظ بريد PayPal، حاول مرة أخرى' });
        const fieldMsg = mapped.fieldErrors['paypalPayoutEmail'] || (mapped.kind === 'backend-validation' && !Object.keys(mapped.fieldErrors).length ? mapped.message : '');
        this.pendingPaypalEmail.set(null);
        if (fieldMsg && this.serverFieldError(this.payoutForm, 'paypalPayoutEmail', fieldMsg, i => this.missingPayout.set(i), PAYOUT_LABELS)) return;
        // mail not sent (503), too many requests (429), anything else: said under the button, the user stays on the input form
        this.paypalRequestError.set(err?.status === 503 ? 'تعذر إرسال رمز التحقق، حاول مرة أخرى' : mapHttpError(err, { fallback: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' }).message);
      }
    });
  }

  onPaypalConfirmed(email: string) {
    this.pendingPaypalEmail.set(null);
    const wasAdd = !this.paypalHasEmail();
    this.payoutForm.patchValue({ paypalPayoutEmail: email });
    this.storedPaypalEmail.set(email);
    this.ui.success(wasAdd ? 'تمت إضافة بريد PayPal. السحب عبر PayPal متوقف لمدة 24 ساعة' : 'تم تغيير بريد PayPal. السحب عبر PayPal متوقف لمدة 24 ساعة');
    this.refreshCompletion();
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
          this.ui.success('تم رفع الملف بأمان، أكد الطلب لحفظ التغيير');
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
    if (controlName === 'idDocumentUrl') {
      this.docsForm.get('idDocumentUrl')?.setValidators(Validators.required);
      this.docsForm.get('idDocumentUrl')?.updateValueAndValidity();
    }
    this.setDocFileError(controlName, '');
    if (input) input.value = '';
    const next = { ...this.documentUploads() };
    delete next[controlName];
    this.documentUploads.set(next);
    this.ui.info('تم حذف المستند من التعديلات الحالية. اضغط حفظ لتأكيد التغيير');
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
    // one request waiting for the admin is enough: no second one is created
    if (this.identityPending()) { this.ui.info('طلب التحقق من الهوية قيد مراجعة الإدارة بالفعل'); return; }
    const attempt = attemptSubmit(this.docsForm, { root: this.panel('docs'), labels: DOCS_LABELS });
    this.missingDocs.set(attempt.missing);
    if (!attempt.valid) {
      this.focusField(attempt.missing[0].path);
      return;
    }
    // A stored private document that was not touched is simply left out of the request: the backend keeps what is stored.
    // An empty value would mean "remove it".
    const changes: Record<string, unknown> = { ...this.docsForm.value };
    for (const key of Object.keys(changes)) if (this.documentState(key)?.stored) delete changes[key];
    if (Object.keys(changes).length === 0) {
      this.ui.info('لا توجد تغييرات للحفظ');
      return;
    }
    this.startSensitiveChange('DOCUMENTS', changes);
  }

  private startSensitiveChange(category: 'DOCUMENTS', changes: Record<string, unknown>) {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.profileService.initiateSensitiveChange(category, changes).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
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
  private handleSensitiveError(category: 'DOCUMENTS', err: any) {
    const raw = this.rawCode(err);
    const form = this.docsForm;
    const labels = DOCS_LABELS;
    const setSummary = (i: InvalidField[]) => this.missingDocs.set(i);
    const field = raw ? ({
      INVALID_EMAIL: 'email', EMAIL_ALREADY_USED: 'email', INVALID_PHONE: 'phoneNumber', INVALID_PHONE_COUNTRY: 'phoneNumber', PHONE_ALREADY_USED: 'phoneNumber',
      INVALID_ALTERNATIVE_PHONE: 'alternativePhone', ID_DOCUMENT_REQUIRED: 'idDocumentUrl', INVALID_DOCUMENT_URL: raw.arg,
    } as Record<string, string>)[raw.code] : undefined;
    const message = raw ? messageForBackendCode(raw.code) : null;
    if (field && message && this.serverFieldError(form, field, message, setSummary, labels)) return;
    const fallback = 'تعذر إنشاء طلب التعديل. حاول مرة أخرى';
    this.notifyHttpError(err, { fallback });
    // 409: a request is already waiting for the admin - show that state instead of leaving the form looking unsent
    if (raw?.code === 'REQUEST_ALREADY_PENDING' || err?.error?.message === 'REQUEST_ALREADY_PENDING') this.loadProfile();
  }

  closeOtpModal() {
    this.showOtpModal.set(false);
    this.otpCode.set('');
    this.otpError.set('');
  }

  verifyOtp() {
    if (this.isVerifyingOtp()) return;
    if (this.otpCode().length !== 6) {
      this.otpError.set('أدخل رمز التحقق المكوّن من 6 أرقام');
      (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('#sens-otp-0')?.focus();
      return;
    }
    this.isVerifyingOtp.set(true);
    this.profileService.verifySensitiveChange(this.pendingRequestId(), this.otpCode()).subscribe({
      next: (res: any) => {
        this.isVerifyingOtp.set(false);
        this.showOtpModal.set(false);
        this.otpError.set('');
        this.missingDocs.set([]);
        const underReview = res.data.status === 'PENDING_HUMAN_REVIEW';
        const isDocuments = this.pendingSensitiveCategory() === 'DOCUMENTS';
        if (underReview && isDocuments) {
          // The request was saved and now waits for the admin: say it, keep saying it (the backend state is reloaded below), and block a resend.
          this.identityVerification.set({ status: 'PENDING_REVIEW', requestId: this.pendingRequestId(), submittedAt: new Date().toISOString(), rejectionReason: null });
          this.identityJustSubmitted.set(true);
          this.docsForm.get('idDocumentUrl')?.setErrors(null);
          this.setTab('docs');
          setTimeout(() => (this.panel('docs') as HTMLElement | null)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 30);
          this.ui.success('تم استلام طلب التحقق من الهوية وهو قيد مراجعة الإدارة');
        } else {
          this.ui.success(underReview ? 'تم تأكيد البريد وإرسال الطلب للمراجعة' : 'تم تأكيد البريد وتطبيق التغيير بنجاح');
        }
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
        this.ui.success('تم تغيير كلمة المرور بنجاح');
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
        this.ui.success('تم إنهاء الجلسة بنجاح');
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
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short', timeZone: providerTimeZone() }).format(date);
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

  private applyCompletion(profile: any) {
    this.completionPercent.set(Number(profile?.completionPercentage) || 0);
    this.completionLoaded.set(true);
    this.missingItems.set(Array.isArray(profile?.missingItems) ? profile.missingItems : []);
    if (profile?.identityVerification?.status) this.identityVerification.set(profile.identityVerification);
  }

  /** Re-reads only the completion (percentage + missing items) after a save that does not reload the forms. */
  private refreshCompletion() {
    this.profileService.getProfile().subscribe({ next: (profile: any) => this.applyCompletion(profile), error: () => { /* keeps the last value */ } });
  }

  /** "Complete your profile" box: opens the tab that fixes the item and brings its panel into view. */
  openMissingItem(item: CompletionMissingItem) {
    this.setTab(item.tab);
    setTimeout(() => {
      // An item that is fixed by one field goes straight to that field (scrolled into view and focused); the rest open their tab panel.
      const fieldPath = MISSING_ITEM_FIELD[item.key];
      if (fieldPath && (this.host.nativeElement as HTMLElement).querySelector(`#${FIELD_IDS[fieldPath]}`)) { this.focusField(fieldPath); return; }
      const panel = this.panel(item.tab);
      panel?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }, 30);
  }
}
