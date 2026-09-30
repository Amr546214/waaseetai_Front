import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-provider-help',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './help.html',
  styles: [`
    :host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
    @keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    @keyframes ha-blink { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
    .ha-typing { display: inline-flex; gap: 5px; align-items: center; }
    .ha-typing span { width: 7px; height: 7px; border-radius: 50%; background: #A56BE0; animation: ha-blink 1.2s infinite; }
    .ha-typing span:nth-child(2) { animation-delay: .2s; }
    .ha-typing span:nth-child(3) { animation-delay: .4s; }

    .help-answer { margin-top: 16px; border-top: 1px solid rgba(123,47,190,.2); padding-top: 16px; animation: ws-fade .3s ease both; }
    .ha-q { display: flex; justify-content: flex-start; margin-bottom: 13px; }
    .ha-q span { background: linear-gradient(135deg,#2BD4C7,#2B7FFF); color: #070D24; font-weight: 700; font-size: 13px; padding: 10px 15px; border-radius: 14px; border-top-right-radius: 5px; max-width: 80%; line-height: 1.5; }
    
    .ha-ai { display: flex; gap: 11px; align-items: flex-start; }
    .ha-orb { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; background: radial-gradient(circle at 35% 30%,#A56BE0,#7B2FBE 70%); box-shadow: 0 0 16px rgba(123,47,190,.4); }
    
    .ha-body { flex: 1; min-width: 0; }
    .ha-text { background: linear-gradient(135deg,rgba(123,47,190,.15),rgba(165,107,224,.05)); border: 1px solid rgba(123,47,190,.26); border-radius: 14px; border-top-right-radius: 5px; padding: 13px 16px; font-size: 14px; line-height: 1.75; color: #fff; }
    :host-context([data-theme='light']) .ha-text { background: linear-gradient(135deg,rgba(123,47,190,.08),rgba(165,107,224,.04)); border-color: rgba(123,47,190,.22); color: #1E293B; }
    
    .ha-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
    .ha-link { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; background: rgba(123,47,190,.10); border: 1px solid rgba(123,47,190,.26); border-radius: 9px; font-size: 12px; font-weight: 700; color: var(--ai-txt,#A56BE0); text-decoration: none; transition: background .15s; }
    .ha-link:hover { background: rgba(123,47,190,.2); }
    :host-context([data-theme='light']) .ha-link { background: rgba(123,47,190,.06); border-color: #D9C7EC; }

    .faq-a { max-height: 0; overflow: hidden; transition: max-height .25s ease; }
    .faq-item.open .faq-a { max-height: 240px; }
    .faq-item.open .faq-q-arrow { transform: rotate(180deg); }

    .qcat { display: flex; align-items: flex-start; gap: 12px; background: linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 16px; cursor: pointer; transition: border-color .15s, transform .15s; text-decoration: none; }
    .qcat:hover { border-color: rgba(43,212,199,.22); transform: translateY(-2px); }
    
    .faq-item { background: linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; margin-bottom: 10px; overflow: hidden; }
    .faq-q { display: flex; align-items: center; gap: 12px; width: 100%; padding: 15px 18px; background: transparent; border: 0; cursor: pointer; font-family: inherit; text-align: right; direction: rtl; }
    .faq-q-txt { flex: 1; font-size: 13.5px; font-weight: 700; color: #fff; }
    .faq-q-arrow { width: 16px; height: 16px; color: #6B7699; flex-shrink: 0; transition: transform .2s; }
    
    .tk-card { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 13px; padding: 15px 18px; margin-bottom: 10px; transition: border-color .15s; cursor: pointer; text-decoration: none; }
    .tk-card:hover { border-color: rgba(43,212,199,.18); }
    
    .chan { background: linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 18px; text-align: center; text-decoration: none; display: block; transition: border-color .15s, transform .15s; }
    .chan:hover { border-color: rgba(43,212,199,.22); transform: translateY(-2px); }

    /* Light Theme Support */
    :host-context([data-theme='light']) .help-hero { background: linear-gradient(135deg,rgba(123,47,190,.10),rgba(43,127,255,.06)) !important; border-color: rgba(123,47,190,.22) !important; }
    :host-context([data-theme='light']) .help-search { background: #fff !important; border-color: #D9C7EC !important; }
    :host-context([data-theme='light']) .help-search input { color: #0F172A !important; }
    :host-context([data-theme='light']) .help-sg { background: #fff !important; border-color: #D8DFEC !important; color: #475569 !important; }
    :host-context([data-theme='light']) .qcat { background: #fff !important; border-color: #E7EAF1 !important; }
    :host-context([data-theme='light']) .qcat-ttl { color: #0F172A !important; }
    :host-context([data-theme='light']) .faq-item { background: #fff !important; border-color: #E7EAF1 !important; }
    :host-context([data-theme='light']) .faq-q-txt { color: #0F172A !important; }
    :host-context([data-theme='light']) .faq-a-inner { color: #475569 !important; }
    :host-context([data-theme='light']) .tk-card { background: #fff !important; border-color: #E7EAF1 !important; }
    :host-context([data-theme='light']) .tk-ttl { color: #0F172A !important; }
    :host-context([data-theme='light']) .chan { background: #fff !important; border-color: #E7EAF1 !important; }
    :host-context([data-theme='light']) .chan-ttl { color: #0F172A !important; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Help {
  readonly assistant = inject(AssistantStore);
  private authStore = inject(AuthStore);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  searchQuery = signal<string>('');
  searchedQuery = signal<string>('');

  faqState = signal<boolean[]>([false, false, false, false, false]);

  // The help search box now asks the ONE real shared assistant (WaseetAI
  // help via the backend) and shows the streamed answer in the dashboard
  // Avatar panel. The previous client-side keyword match + setTimeout
  // "answer" was removed.
  askAI() {
    const q = this.searchQuery().trim();
    if (!q) {
      this.showToast('اكتب سؤالك أولًا');
      return;
    }
    this.searchedQuery.set(q);
    this.assistant.openAndAsk(q);
  }

  fillQ(text: string) {
    this.searchQuery.set(text);
    this.askAI();
  }

  toggleFaq(index: number) {
    const state = [...this.faqState()];
    state[index] = !state[index];
    this.faqState.set(state);
  }

  retry() {
    this.hasError.set(false);
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
    }, 1000);
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}
