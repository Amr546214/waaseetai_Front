
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig } from '@storybook/angular-vite';

import { provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { of, Subject, NEVER, throwError } from 'rxjs';
import { userEvent, within } from 'storybook/test';

import { Login } from './login';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { SocialAuthService } from '@abacritt/angularx-social-login';

// صفحة وهمية للروابط داخل Storybook
@Component({
  selector: 'storybook-empty-page',
  standalone: true,
  template: '',
})
class EmptyPage {}

// نوع استجابة الـBackend الوهمية
type MockMode = 'error' | 'loading' | 'rateLimit';

let mockMode: MockMode = 'error';

// منع طلبات HTTP الحقيقية من خلال هذا الـHttpClient
const mockHttpClient = {
  get: () => NEVER,
  post: () => NEVER,
  put: () => NEVER,
  patch: () => NEVER,
  delete: () => NEVER,
};

// محاكاة استجابات تسجيل الدخول
const mockAuthApi = {
  login: () => {
    // حالة التحميل
    if (mockMode === 'loading') {
      return NEVER;
    }

    // حالة تجاوز عدد محاولات تسجيل الدخول
    if (mockMode === 'rateLimit') {
      return throwError(() => ({
        status: 429,
        error: {
          message: 'طلبات كثيرة جدًا، يرجى المحاولة لاحقًا',
        },
      }));
    }

    // خطأ تسجيل الدخول المعتاد
    return throwError(() => ({
      status: 401,
      error: {
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      },
    }));
  },

  googleAuth: () => NEVER,
};

// بيانات مستخدم وهمية
const mockAuthStore = {
  currentUser: signal(null),
  authenticate: () => {},
  setPendingVerification: () => {},
};

// محاكاة خدمة Google
const mockSocialAuth = {
  authState: new Subject<any>(),
  initState: of(undefined),
};

// الإعدادات المشتركة لكل Stories
const meta: Meta<Login> = {
  title: 'Waseet AI/Auth/Login',
  component: Login,

  decorators: [
    applicationConfig({
      providers: [
        provideRouter([
          { path: '**', component: EmptyPage },
        ]),

        { provide: HttpClient, useValue: mockHttpClient },
        { provide: AuthApiService, useValue: mockAuthApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: SocialAuthService, useValue: mockSocialAuth },
      ],
    }),
  ],

  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<Login>;

// ====================================
// 1. Default
// ====================================

export const Default: Story = {
  beforeEach: () => {
    mockMode = 'error';
  },
};

// ====================================
// 2. Validation Error
// ====================================

export const ValidationError: Story = {
  beforeEach: () => {
    mockMode = 'error';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'دخول' })
    );
  },
};

// ====================================
// 3. Loading
// ====================================

export const Loading: Story = {
  beforeEach: () => {
    mockMode = 'loading';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const email = canvas.getByRole('textbox', {
      name: /البريد الإلكتروني/,
    });

    const password =
      canvasElement.querySelector<HTMLInputElement>('#password');

    if (!password) {
      throw new Error('Password input not found');
    }

    await userEvent.type(email, 'demo@example.com');
    await userEvent.type(password, 'DemoPassword123!');

    await userEvent.click(
      canvas.getByRole('button', { name: 'دخول' })
    );
  },
};

// ====================================
// 4. API Error
// ====================================

export const ApiError: Story = {
  beforeEach: () => {
    mockMode = 'error';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const email = canvas.getByRole('textbox', {
      name: /البريد الإلكتروني/,
    });

    const password =
      canvasElement.querySelector<HTMLInputElement>('#password');

    if (!password) {
      throw new Error('Password input not found');
    }

    await userEvent.type(email, 'demo@example.com');
    await userEvent.type(password, 'WrongPassword123!');

    await userEvent.click(
      canvas.getByRole('button', { name: 'دخول' })
    );
  },
};

// ====================================
// 5. Invalid Email
// ====================================

export const InvalidEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const email = canvas.getByRole('textbox', {
      name: /البريد الإلكتروني/,
    });

    await userEvent.click(email);
    await userEvent.type(email, 'invalid-email');

    await userEvent.tab();
  },
};

// ====================================
// 6. Show / Hide Password
// ====================================

export const ShowHidePassword: Story = {
  play: async ({ canvasElement }) => {
    const password =
      canvasElement.querySelector<HTMLInputElement>('#password');

    const toggle =
      canvasElement.querySelector<HTMLButtonElement>('#pw-toggle');

    if (!password || !toggle) {
      throw new Error('Password controls not found');
    }

    await userEvent.click(password);
    await userEvent.type(password, 'DemoPassword123!');

    // إظهار كلمة المرور
    await userEvent.click(toggle);

    if (password.type !== 'text') {
      throw new Error('Show password did not work');
    }

    // إخفاء كلمة المرور مرة أخرى
    await userEvent.click(toggle);
  },
};

// ====================================
// 7. Remember Me
// ====================================

export const RememberMe: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const remember = canvas.getByRole('checkbox', {
      name: /تذكرني/,
    });

    await userEvent.click(remember);

    if (!(remember as HTMLInputElement).checked) {
      throw new Error('Remember Me did not activate');
    }
  },
};

// ====================================
// 8. Google Account Not Found
// ====================================

export const GoogleAccountNotFound: Story = {
  args: {
    accountNotFoundError: true,
    errorMessage:
      'لا يوجد حساب مرتبط بهذا البريد الإلكتروني، يرجى إنشاء حساب أولاً',
  },
};

// ====================================
// 9. Google Login Error
// ====================================

export const GoogleLoginError: Story = {
  args: {
    errorMessage:
      'حدث خطأ أثناء تسجيل الدخول بجوجل، يرجى المحاولة مرة أخرى',
  },
};

// ====================================
// 10. SMS Unavailable
// ====================================

export const SmsUnavailable: Story = {
  args: {
    errorMessage:
      'التحقق عبر الرسائل النصية غير متاح حالياً، يرجى التواصل مع الدعم لإكمال تسجيل الدخول',
  },
};

// ====================================
// 11. Dashboard Navigation Failed
// ====================================

export const NavigationFailed: Story = {
  args: {
    entryFailedUrl: '/client-overview',
    errorMessage:
      'تم تسجيل الدخول لكن تعذر فتح لوحتك. اضغط إعادة فتح لوحتي.',
  },
};

// ====================================
// 12. Rate Limit (429)
// ====================================

export const RateLimit: Story = {
  beforeEach: () => {
    mockMode = 'rateLimit';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const email = canvas.getByRole('textbox', {
      name: /البريد الإلكتروني/,
    });

    const password =
      canvasElement.querySelector<HTMLInputElement>('#password');

    if (!password) {
      throw new Error('Password input not found');
    }

    await userEvent.click(email);
    await userEvent.type(email, 'demo@example.com');

    await userEvent.click(password);
    await userEvent.type(password, 'DemoPassword123!');

    await userEvent.click(
      canvas.getByRole('button', { name: 'دخول' })
    );
  },
};
