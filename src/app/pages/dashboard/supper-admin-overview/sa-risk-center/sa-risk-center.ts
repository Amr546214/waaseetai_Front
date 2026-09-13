import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type RiskLevel = 'high' | 'med' | 'low';

interface RiskAccount {
  score: number;
  scoreColor: string;
  name: string;
  meta: string;
  reasons: { label: string; color: string; bg: string }[];
  level: RiskLevel;
}

interface FraudPattern {
  title: string;
  desc: string;
  color: string;
  bg: string;
  tag: string;
}

@Component({
  selector: 'app-sa-risk-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-risk-center.html',
  styleUrl: './sa-risk-center.css',
})
export class SaRiskCenter {
  readonly riskAccounts = signal<RiskAccount[]>([
    {
      score: 89,
      scoreColor: '#FF6B6B',
      name: 'عبدالرحمن الدوسري',
      meta: 'مقدم فرد · 3 بلاغات · موقوف',
      reasons: [
        { label: 'احتيال مالي', color: '#FF6B6B', bg: 'rgba(255,107,107,.12)' },
        { label: 'VPN مشبوه', color: '#FF6B6B', bg: 'rgba(255,107,107,.12)' },
        { label: 'حسابات مكررة', color: '#FF6B6B', bg: 'rgba(255,107,107,.12)' },
      ],
      level: 'high',
    },
    {
      score: 76,
      scoreColor: '#FF8C69',
      name: 'تركي الرشيدي',
      meta: 'وسيط · 0 إحالات ناجحة · موقوف',
      reasons: [
        { label: 'غسيل أموال محتمل', color: '#FF8C69', bg: 'rgba(255,140,105,.12)' },
        { label: 'حساب بنكي مشبوه', color: '#FF8C69', bg: 'rgba(255,140,105,.12)' },
      ],
      level: 'high',
    },
    {
      score: 62,
      scoreColor: '#FFB400',
      name: 'ريم الحربي',
      meta: 'مقدمة فرد · 2 بلاغات · نشطة',
      reasons: [
        { label: 'تأخر متكرر', color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
        { label: 'تقييمات متضاربة', color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
      ],
      level: 'med',
    },
  ]);

  readonly fraudPatterns: FraudPattern[] = [
    { title: 'شبكة حسابات متعددة', desc: '3 حسابات على نفس الجهاز — نمط احتيال ثقة 87%', color: '#FF6B6B', bg: 'rgba(255,107,107,.12)', tag: 'خطر' },
    { title: 'تسعير شاذ', desc: '8 عروض أقل من متوسط السوق بـ 60%+ — مؤشر إغراء ثم تهرب', color: '#FFB400', bg: 'rgba(255,180,0,.12)', tag: 'متوسط' },
    { title: 'طلبات سحب متكررة', desc: '4 طلبات سحب خلال 72 ساعة بمبالغ أقل من الحد — تجنب الرقابة', color: '#A56BE0', bg: 'rgba(123,47,190,.12)', tag: 'مراجعة' },
    { title: 'تسجيل دخول من دول متعددة', desc: 'نفس الحساب من 3 دول في 24 ساعة — VPN محتمل', color: '#FF8C69', bg: 'rgba(255,140,105,.12)', tag: 'تحقيق' },
  ];

  readonly blockedIps = signal<string[]>(['185.220.101.42', '103.41.204.58', '194.165.16.29']);
  readonly newIp = signal('');
  readonly extraBlockedCount = 21;

  addBlockedIp() {
    const value = this.newIp().trim();
    if (!value) return;
    this.blockedIps.update((ips) => [...ips, value]);
    this.newIp.set('');
  }

  removeBlockedIp(ip: string) {
    this.blockedIps.update((ips) => ips.filter((x) => x !== ip));
  }
}
