import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cookies.component.html',
  styleUrls: ['./cookies.component.css']
})
export class CookiesComponent implements OnInit, OnDestroy {
  functionalEnabled = true;
  analyticsEnabled = false;
  marketingEnabled = false;

  // Customize modal (design P-AU-016 #customize-modal) — draft values until saved
  modalOpen = false;
  draftFunctional = true;
  draftAnalytics = false;
  draftMarketing = false;
  @ViewChild('modalClose') private modalCloseBtn?: ElementRef<HTMLButtonElement>;

  // Toasts (design P-AU-016 #toast-wrap)
  toasts: { id: number; type: 'success' | 'error'; msg: string }[] = [];
  private toastSeq = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.functionalEnabled = localStorage.getItem('cookie-functional') !== 'false'; // default true
      this.analyticsEnabled = localStorage.getItem('cookie-analytics') === 'true';
      this.marketingEnabled = localStorage.getItem('cookie-marketing') === 'true';
    }
  }

  toggleFunctional(event: Event) {
    const target = event.target as HTMLInputElement;
    this.functionalEnabled = target.checked;
    this.savePreferences();
  }

  toggleAnalytics(event: Event) {
    const target = event.target as HTMLInputElement;
    this.analyticsEnabled = target.checked;
    this.savePreferences();
  }

  toggleMarketing(event: Event) {
    const target = event.target as HTMLInputElement;
    this.marketingEnabled = target.checked;
    this.savePreferences();
  }

  acceptAll() {
    this.functionalEnabled = true;
    this.analyticsEnabled = true;
    this.marketingEnabled = true;
    this.savePreferences();
    this.showToast('success', 'تم قبول جميع ملفات تعريف الارتباط');
  }

  rejectOptional() {
    this.functionalEnabled = false;
    this.analyticsEnabled = false;
    this.marketingEnabled = false;
    this.savePreferences();
    this.showToast('success', 'تم الاحتفاظ بالضروري فقط');
  }

  savePreferences() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cookie-functional', String(this.functionalEnabled));
      localStorage.setItem('cookie-analytics', String(this.analyticsEnabled));
      localStorage.setItem('cookie-marketing', String(this.marketingEnabled));
      localStorage.setItem('cookie-accepted', 'true');
    }
  }

  openModal() {
    this.draftFunctional = this.functionalEnabled;
    this.draftAnalytics = this.analyticsEnabled;
    this.draftMarketing = this.marketingEnabled;
    this.modalOpen = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => this.modalCloseBtn?.nativeElement.focus());
    }
  }

  closeModal() {
    if (!this.modalOpen) return;
    this.modalOpen = false;
    if (isPlatformBrowser(this.platformId)) document.body.style.overflow = '';
  }

  saveModalPrefs() {
    this.functionalEnabled = this.draftFunctional;
    this.analyticsEnabled = this.draftAnalytics;
    this.marketingEnabled = this.draftMarketing;
    this.savePreferences();
    this.closeModal();
    this.showToast('success', 'تم حفظ تفضيلاتك بنجاح');
  }

  acceptAllFromModal() {
    this.draftFunctional = true;
    this.draftAnalytics = true;
    this.draftMarketing = true;
    this.saveModalPrefs();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeModal();
  }

  private showToast(type: 'success' | 'error', msg: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, type, msg }];
    this.timers.push(setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 3300));
  }

  ngOnDestroy() {
    this.timers.forEach(t => clearTimeout(t));
    if (this.modalOpen && isPlatformBrowser(this.platformId)) document.body.style.overflow = '';
  }
}
