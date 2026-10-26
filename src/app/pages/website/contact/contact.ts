import { Component, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlatformInfoService } from '../../../core/services/platform-info.service';
import { FieldProblem, reportProblems } from '../../../shared/forms/form-error-focus';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
  private readonly host = inject(ElementRef<HTMLElement>);
  /** the WhatsApp card shows the `supportPhone` setting (the built-in number while it is empty) */
  readonly platform = inject(PlatformInfoService);
  submitted = signal(false);
  sending = signal(false);

  form = {
    name: '',
    email: '',
    type: '',
    message: ''
  };

  /** Field problems in page order: name, e-mail, message (the type is optional). */
  problems(): FieldProblem[] {
    const out: FieldProblem[] = [];
    if (!this.form.name.trim()) out.push({ field: 'f-name', message: 'أدخل اسمك', label: 'الاسم' });
    const email = this.form.email.trim();
    if (!email) out.push({ field: 'f-email', message: 'أدخل بريدك الإلكتروني', label: 'البريد الإلكتروني' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.push({ field: 'f-email', message: 'البريد الإلكتروني غير صالح', label: 'البريد الإلكتروني' });
    if (!this.form.message.trim()) out.push({ field: 'f-msg', message: 'اكتب رسالتك', label: 'رسالتك' });
    return out;
  }

  submitForm(e: Event) {
    e.preventDefault();
    if (this.sending()) return;
    const problems = this.problems();
    if (problems.length) {
      // Red + aria-invalid + a message under each field; the first one gets the cursor below the header. Typed values stay.
      void reportProblems(this.host.nativeElement, problems);
      return;
    }
    this.submitted.set(true);
  }
}
