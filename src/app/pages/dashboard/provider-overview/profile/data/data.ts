import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { HttpEventType } from '@angular/common/http';

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

function ibanValidator(control: AbstractControl): ValidationErrors | null {
  const iban = String(control.value || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { iban: true };
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1 ? null : { iban: true };
}

@Component({
  selector: 'app-profile-data',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './data.html',
  styleUrl: './data.css'
})
export class Data implements OnInit {
  currentTab = signal<string>('profile');
  showGovModal = signal<boolean>(false);
  govModalField = signal<string>('');
  showToast = signal<string>('');
  bioCharCount = signal<number>(0);
  avatarUrl = signal<string | null>(null);
  passwordFormVisible = signal<boolean>(false);

  // Dynamic relation states
  skillsList = signal<any[]>([]);
  portfolioList = signal<any[]>([]);

  private fb = inject(FormBuilder);
  private profileService = inject(ProviderProfileService);
  private platformId = inject(PLATFORM_ID);

  profileForm!: FormGroup;
  contactForm!: FormGroup;
  bankingForm!: FormGroup;
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
  pendingSensitiveCategory = signal<'CONTACT' | 'BANKING' | 'DOCUMENTS' | null>(null);
  isSaving = signal(false);
  isVerifyingOtp = signal(false);
  uploadingDocument = signal<string | null>(null);
  documentUploads = signal<Record<string, DocumentUploadState>>({});

  completionPercent = signal(0);
  nextStepHint = signal({ percentage: 0, nextTargetPercentage: 0, message: '' });

  currentProfileData: any = null;

  ngOnInit() {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      headline: ['', [Validators.required, Validators.maxLength(100)]],
      hourlyRate: [0, Validators.min(0)],
      yearsOfExperience: [0, Validators.min(0)],
      availabilityStatus: ['AVAILABLE', Validators.required],
      specialty: ['', Validators.required],
      country: ['السعودية', Validators.required],
      city: ['الرياض', Validators.required],
      address: [''],
      bio: ['', Validators.maxLength(500)],
      websiteUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      linkedinUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      twitterUrl: [''],
      githubUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
      skillsArray: this.fb.array([]),
      languagesArray: this.fb.array([]),
      uiLanguage: ['ar'],
      timezone: ['Asia/Riyadh'],
      notifyEmail: [true],
      notifySms: [true],
      notifyInApp: [true],
      notifyWhatsapp: [false]
    });

    this.contactForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{8,15}$/)]],
      alternativePhone: ['', Validators.pattern(/^\+?[0-9]{8,15}$/)]
    });

    this.bankingForm = this.fb.group({
      accountHolderName: ['', Validators.required],
      ibanNumber: ['', [Validators.required]],
      bankName: ['', Validators.required]
    });

    this.docsForm = this.fb.group({
      idDocumentUrl: [''],
      certificatesUrl: [''],
      commercialRegistration: [''],
      vatCertificateUrl: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required]
    });

    this.profileForm.get('bio')?.valueChanges.subscribe(val => {
      this.bioCharCount.set(val?.length || 0);
    });

    if (isPlatformBrowser(this.platformId)) {
      this.loadProfile();
      this.loadActiveSessions();
      this.profileForm.valueChanges.subscribe(() => this.calculateCompletion());
      this.contactForm.valueChanges.subscribe(() => this.calculateCompletion());
      this.bankingForm.valueChanges.subscribe(() => this.calculateCompletion());
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
            country: profile.country || 'السعودية',
            city: profile.city || 'الرياض',
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

          this.bankingForm.patchValue({
            accountHolderName: profile.user?.accountHolderName || '',
            // The API deliberately returns a masked IBAN. A replacement must be entered in full.
            ibanNumber: String(profile.user?.ibanNumber || '').includes('*') ? '' : (profile.user?.ibanNumber || ''),
            bankName: profile.user?.bankName || ''
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
      error: (err) => console.error('Error loading profile', err)
    });
  }

  onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.displayToast('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarUrl.set(reader.result as string);
        this.displayToast('تم اختيار الصورة، سيتم حفظها عند النقر على حفظ');
      };
      reader.readAsDataURL(file);
    }
  }

  removeAvatar() {
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
    if (!skillName) return;

    const currentSkills = this.skillsArray.value as string[];
    if (!currentSkills.includes(skillName)) {
      const newSkills = [...currentSkills, skillName];
      this.profileService.updateSkills(newSkills).subscribe({
        next: (updatedProfile: any) => {
          this.skillsList.set(updatedProfile.skills);
          this.skillsArray.push(this.fb.control(skillName));
          skillInput.value = '';
          this.displayToast('تم إضافة المهارة بنجاح');
        }
      });
    }
  }

  removeSkill(index: number) {
    const currentSkills = [...this.skillsArray.value];
    currentSkills.splice(index, 1);
    this.profileService.updateSkills(currentSkills).subscribe({
      next: (updatedProfile: any) => {
        this.skillsList.set(updatedProfile.skills);
        this.skillsArray.removeAt(index);
        this.displayToast('تم إزالة المهارة بنجاح');
      }
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
    if (!title) return;
    this.profileService.addPortfolioItem({ title, projectUrl: url }).subscribe({
      next: (res) => {
        const current = this.portfolioList();
        this.portfolioList.set([...current, res]);
        this.displayToast('تم إضافة المشروع بنجاح');
      }
    });
  }

  deletePortfolioItem(id: string) {
    this.profileService.deletePortfolioItem(id).subscribe({
      next: () => {
        this.portfolioList.set(this.portfolioList().filter(p => p.id !== id));
        this.displayToast('تم حذف المشروع بنجاح');
      }
    });
  }

  setTab(tab: string) {
    this.currentTab.set(tab);
  }

  updateBioCount(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.bioCharCount.set(target.value.length);
  }

  openGovernedEdit(field: string) {
    this.govModalField.set(field);
    this.showGovModal.set(true);
  }

  closeGovernedEdit() {
    this.showGovModal.set(false);
  }

  confirmGovernedEdit() {
    this.closeGovernedEdit();
    this.displayToast('تم إنشاء طلب التعديل وإرساله للمراجعة');
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.displayToast('الرجاء التأكد من تعبئة الحقول المطلوبة');
      return;
    }

    const val = this.profileForm.value;

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
      next: (updated: any) => {
        this.displayToast('تم حفظ التغييرات بنجاح');
        this.loadProfile();
      },
      error: () => {
        this.displayToast('حدث خطأ أثناء حفظ البيانات');
      }
    });
  }

  saveContact() {
    if (this.contactForm.invalid) { this.contactForm.markAllAsTouched(); this.displayToast('تحقق من البريد ورقم الجوال'); return; }
    this.startSensitiveChange('CONTACT', this.contactForm.value);
  }

  saveBasics() {
    this.saveProfile();
    this.saveContact();
  }

  saveBanking() {
    if (this.bankingForm.invalid) {
      this.bankingForm.markAllAsTouched();
      if (this.bankingForm.get('ibanNumber')?.invalid) {
        this.displayToast('رقم IBAN غير صالح: تحقق من رمز الدولة ورقمي التحقق وبقية رقم الحساب');
      } else if (this.bankingForm.get('accountHolderName')?.invalid) {
        this.displayToast('اكتب اسم صاحب الحساب كما يظهر في البنك');
      } else {
        this.displayToast('اختر اسم البنك لإكمال الطلب');
      }
      return;
    }
    const value = this.bankingForm.value;
    this.startSensitiveChange('BANKING', { ...value, ibanNumber: String(value.ibanNumber).replace(/\s/g, '').toUpperCase() });
  }

  onIbanInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const normalized = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 34);
    this.bankingForm.get('ibanNumber')?.setValue(normalized, { emitEvent: false });
    input.value = normalized;
  }

  onDocSelected(event: Event, controlName: string) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        this.displayToast('حجم المستند يجب أن لا يتجاوز 10 ميجابايت');
        return;
      }
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        this.displayToast('الملفات المسموحة PDF أو JPG أو PNG فقط');
        return;
      }
      this.uploadingDocument.set(controlName);
      const previousPreview = this.documentState(controlName)?.previewUrl;
      if (previousPreview?.startsWith('blob:')) URL.revokeObjectURL(previousPreview);
      const previewUrl = URL.createObjectURL(file);
      this.setDocumentState(controlName, { name: file.name, progress: 0, status: 'uploading', previewUrl, mimeType: file.type });
      this.profileService.uploadDocument(file).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
            this.setDocumentState(controlName, { name: file.name, progress, status: 'uploading', previewUrl, mimeType: file.type });
          }
          if (event.type === HttpEventType.Response) {
            this.uploadingDocument.set(null);
            this.docsForm.get(controlName)?.setValue(event.body.data.url);
            this.setDocumentState(controlName, { name: event.body.data.name || file.name, progress: 100, status: 'uploaded', previewUrl, mimeType: file.type });
            this.displayToast('تم رفع الملف بأمان، أكد الطلب لحفظ التغيير');
          }
        },
        error: () => {
          this.uploadingDocument.set(null);
          this.setDocumentState(controlName, { name: file.name, progress: 0, status: 'error', previewUrl, mimeType: file.type });
          this.displayToast('تعذر رفع الملف');
        }
      });
    }
  }

  documentState(controlName: string): DocumentUploadState | null {
    return this.documentUploads()[controlName] || null;
  }

  removeDocument(controlName: string, input?: HTMLInputElement) {
    const previewUrl = this.documentState(controlName)?.previewUrl;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    this.docsForm.get(controlName)?.setValue('');
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
    if (!this.docsForm.get('idDocumentUrl')?.value) {
      this.displayToast('مستند الهوية مطلوب');
      return;
    }
    this.startSensitiveChange('DOCUMENTS', this.docsForm.value);
  }

  private startSensitiveChange(category: 'CONTACT' | 'BANKING' | 'DOCUMENTS', changes: Record<string, unknown>) {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.profileService.initiateSensitiveChange(category, changes).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.pendingSensitiveCategory.set(category);
        this.pendingRequestId.set(res.data.requestId);
        this.otpEmailHint.set(res.data.emailHint);
        this.otpCode.set('');
        this.showOtpModal.set(true);
      },
      error: (err: any) => {
        this.isSaving.set(false);
        const reason = err?.error?.message;
        const message = reason === 'EMAIL_ALREADY_USED'
          ? 'البريد الإلكتروني مستخدم في حساب آخر'
          : reason === 'OTP_EMAIL_DELIVERY_FAILED'
            ? 'تعذر إرسال رمز التحقق إلى بريدك. تحقق من إعدادات البريد وحاول مجددًا'
            : 'تعذر إنشاء طلب التعديل. حاول مرة أخرى';
        this.displayToast(message);
      }
    });
  }

  closeOtpModal() {
    this.showOtpModal.set(false);
    this.otpCode.set('');
  }

  updateOtpCode(event: Event) {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.otpCode.set(value);
  }

  verifyOtp() {
    if (this.otpCode().length !== 6 || this.isVerifyingOtp()) return;
    this.isVerifyingOtp.set(true);
    this.profileService.verifySensitiveChange(this.pendingRequestId(), this.otpCode()).subscribe({
      next: (res: any) => {
        this.isVerifyingOtp.set(false);
        this.showOtpModal.set(false);
        const underReview = res.data.status === 'PENDING_HUMAN_REVIEW';
        this.displayToast(underReview ? 'تم تأكيد البريد وإرسال الطلب للمراجعة' : 'تم تأكيد البريد وتطبيق التغيير بنجاح');
        this.loadProfile();
      },
      error: () => {
        this.isVerifyingOtp.set(false);
        this.displayToast('رمز التحقق غير صحيح أو انتهت صلاحيته');
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
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); this.displayToast('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { this.passwordForm.get('confirmPassword')?.setErrors({ mismatch: true }); this.displayToast('تأكيد كلمة المرور غير مطابق'); return; }
    const groups = [/[a-z]/.test(newPassword), /[A-Z]/.test(newPassword), /\d/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
    if (groups < 3) { this.displayToast('استخدم ثلاثة أنواع على الأقل: أحرف صغيرة وكبيرة وأرقام ورموز'); return; }
    this.isChangingPassword.set(true);
    this.profileService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.passwordForm.reset();
        this.passwordFormVisible.set(false);
        this.displayToast('تم تغيير كلمة المرور بنجاح');
      },
      error: (err: any) => {
        this.isChangingPassword.set(false);
        const reason = err?.error?.message;
        this.displayToast(reason === 'CURRENT_PASSWORD_INCORRECT' ? 'كلمة المرور الحالية غير صحيحة' : reason === 'PASSWORD_UNCHANGED' ? 'كلمة المرور الجديدة مطابقة للحالية' : reason === 'WEAK_PASSWORD' ? 'كلمة المرور الجديدة لا تحقق متطلبات الأمان' : 'تعذر تغيير كلمة المرور، حاول مجددًا');
      }
    });
  }

  loadActiveSessions() {
    this.sessionsLoading.set(true);
    this.profileService.getActiveSessions().subscribe({
      next: (response: any) => { this.activeSessions.set(response.data || []); this.sessionsLoading.set(false); },
      error: () => { this.sessionsLoading.set(false); this.displayToast('تعذر تحميل جلسات الدخول'); }
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
      error: () => { this.revokingSessionId.set(null); this.displayToast('تعذر إنهاء الجلسة'); }
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
      }
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
    const bForm = this.bankingForm.value;
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
    if (bForm.ibanNumber) {
      current += 15;
    } else {
      missing.push({ name: 'bank', weight: 15, hint: 'بيانات الحساب البنكي' });
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
    setTimeout(() => this.showToast.set(''), 3500);
  }
}
