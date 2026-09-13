import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SlowQuery {
  query: string;
  table: string;
  avgTime: string;
  timeColor: string;
  execPerHour: string;
  index: 'مفقود' | 'موجود' | 'جزئي';
  recommendation: string;
  recColor: string;
}

interface TableStat {
  name: string;
  rows: string;
  size: string;
  lastVacuum: string;
  status: 'good' | 'warning';
}

@Component({
  selector: 'app-sa-database',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-database.html',
  styleUrl: './sa-database.css',
})
export class SaDatabase {
  readonly kpis = [
    { label: 'حجم قاعدة البيانات', value: '847', unit: 'غيغابايت', sub: '+12 GB هذا الأسبوع', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'متوسط وقت الاستعلام', value: '4.2', unit: 'مللي ثانية', sub: 'تحسن 23%', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'استعلامات بطيئة', value: '3', unit: 'استعلامات', sub: 'تحتاج تحسين فوري', color: '#FFB400', bg: 'rgba(255,107,107,.12)' },
    { label: 'نسبة Cache Hit', value: '98.4', unit: 'بالمئة', sub: 'ممتاز', color: '#2BD4C7', bg: 'rgba(43,127,255,.12)' },
  ];

  readonly slowQueries: SlowQuery[] = [
    { query: 'SELECT * FROM projects WHERE status=...', table: 'projects', avgTime: '248ms', timeColor: '#FF6B6B', execPerHour: '12,400', index: 'مفقود', recommendation: 'أضف فهرس على status', recColor: '#FFB400' },
    { query: 'SELECT u.*, r.* FROM users JOIN roles...', table: 'users, roles', avgTime: '89ms', timeColor: '#FFB400', execPerHour: '8,200', index: 'موجود', recommendation: 'مقبول', recColor: '#0FA99A' },
    { query: 'SELECT COUNT(*) FROM transactions WHERE...', table: 'transactions', avgTime: '124ms', timeColor: '#FFB400', execPerHour: '4,100', index: 'جزئي', recommendation: 'حسّن الفهرس المركب', recColor: '#FFB400' },
    { query: 'SELECT * FROM offers WHERE user_id=...', table: 'offers', avgTime: '12ms', timeColor: '#0FA99A', execPerHour: '28,000', index: 'موجود', recommendation: 'أداء ممتاز', recColor: '#0FA99A' },
    { query: 'SELECT * FROM notifications WHERE user...', table: 'notifications', avgTime: '8ms', timeColor: '#0FA99A', execPerHour: '42,000', index: 'موجود', recommendation: 'ممتاز', recColor: '#0FA99A' },
  ];

  readonly tableStats: TableStat[] = [
    { name: 'users', rows: '284,192', size: '2.4 GB', lastVacuum: 'اليوم', status: 'good' },
    { name: 'projects', rows: '1,482,040', size: '18.2 GB', lastVacuum: 'أمس', status: 'good' },
    { name: 'transactions', rows: '8,294,110', size: '84.4 GB', lastVacuum: '4 أيام', status: 'warning' },
    { name: 'notifications', rows: '24,182,000', size: '124 GB', lastVacuum: 'اليوم', status: 'good' },
  ];

  indexStyle(index: SlowQuery['index']): { bg: string; color: string } {
    switch (index) {
      case 'مفقود': return { bg: 'rgba(255,107,107,.1)', color: '#FF6B6B' };
      case 'جزئي': return { bg: 'rgba(255,180,0,.1)', color: '#FFB400' };
      default: return { bg: 'rgba(43,212,199,.1)', color: '#2BD4C7' };
    }
  }
}
