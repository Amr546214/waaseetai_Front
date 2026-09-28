import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BackupJob {
  name: string;
  type: 'يومية' | 'أسبوعية' | 'شهرية';
  size: string;
  runTime: string;
  duration: string;
  date: string;
  success: boolean;
}

@Component({
  selector: 'app-sa-backups',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-backups.html',
  styleUrl: './sa-backups.css',
})
export class SaBackups {
  readonly kpis = [
    { label: 'آخر نسخة احتياطية', value: '✓', unit: 'منذ ساعتين', sub: 'ناجحة 100%', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'إجمالي حجم النسخ', value: '2.84', unit: 'تيرابايت', sub: '30 نسخة محفوظة', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'جداول النسخ', value: '8', unit: 'مهمة مجدولة', sub: 'يومية + أسبوعية + شهرية', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
    { label: 'وقت الاستعادة (RTO)', value: '4', unit: 'ساعات', sub: 'RPO: 2 ساعة', color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
  ];

  readonly jobs: BackupJob[] = [
    { name: 'DB Full Backup', type: 'يومية', size: '94.2 GB', runTime: '02:00 صباحاً', duration: '12 دقيقة', date: 'اليوم', success: true },
    { name: 'Files Backup', type: 'يومية', size: '48.7 GB', runTime: '02:15 صباحاً', duration: '8 دقائق', date: 'اليوم', success: true },
    { name: 'Full System Snapshot', type: 'أسبوعية', size: '284 GB', runTime: 'الأحد 01:00', duration: '42 دقيقة', date: '13 يوليو', success: true },
    { name: 'Logs Archive', type: 'شهرية', size: '1.2 TB', runTime: '1 يوليو 00:00', duration: '2.4 ساعة', date: '1 يوليو', success: true },
  ];

  readonly backupInProgress = signal(false);
  readonly backupJustCompleted = signal(false);

  typeStyle(type: BackupJob['type']): { bg: string; color: string } {
    switch (type) {
      case 'يومية': return { bg: 'rgba(43,212,199,.1)', color: '#2BD4C7' };
      case 'أسبوعية': return { bg: 'rgba(43,127,255,.1)', color: '#5DA0FF' };
      default: return { bg: 'rgba(89,193,245,.1)', color: '#59C1F5' };
    }
  }

  runBackupNow(): void {
    if (this.backupInProgress()) return;
    this.backupInProgress.set(true);
    this.backupJustCompleted.set(false);
    setTimeout(() => {
      this.backupInProgress.set(false);
      this.backupJustCompleted.set(true);
      setTimeout(() => this.backupJustCompleted.set(false), 4000);
    }, 1800);
  }
}
