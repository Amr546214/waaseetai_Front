
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

// Component وهمية للروابط، بدون فتح صفحات حقيقية
@Component({
  selector: 'storybook-empty-page',
  standalone: true,
  template: '',
})
class EmptyPage {}

// تحديد نوع الرد التجريبي
let mockMode: 'error' | 'loading' = 'error';

// منع أي طلب HTTP حقيقي في التجربة
const mockHttpClient = {
  get: () => NEVER,
  post: () => NEVER,
  put: () => NEVER,
  patch: () => NEVER,
  delete: () => NEVER,
};

// محاكاة Backend تسجيل الدخول
const mockAuthApi = {
  login: () => {
    if (mockMode === 'loading') {
      return NEVER;
    }

    return throwError(() => ({
      status: 401,
      error: {
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      },
    }));
  },

  googleAuth: () => NEVER,
};

// مستخدم وهمي، بدون جلسة دخول حقيقية
const mockAuthStore = {
  currentUser: signal(null),
  authenticate: () => {},
  setPendingVerification: () => {},
};

// منع تسجيل الدخول الحقيقي بجوجل
const mockSocialAuth = {
  authState: new Subject<any>(),
  initState: of(undefined),
};

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

// الحالة الطبيعية
export const Default: Story = {
  beforeEach: () => {
    mockMode = 'error';
  },
};

// أخطاء الحقول الفارغة
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

// حالة التحميل المستمر للعرض فقط
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

// تجربة رد خطأ من Backend وهمي
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
