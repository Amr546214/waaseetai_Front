import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BeboToolbarComponent } from './bebo-toolbar';

/**
 * «بيبو» — Bebo's tools inside the admin panel. It draws the SAME tool bar component the floating widget draws on the rest of the site (same buttons, order, icons and behaviour); the robot,
 * the quick composer and the panel (chat, guide, motions, settings) are still opened by those buttons exactly as before.
 */
@Component({
	selector: 'app-dashboard-bebo',
	standalone: true,
	imports: [BeboToolbarComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="bebo-page" dir="rtl" data-testid="dashboard-bebo">
			<h1 class="bebo-ttl">بيبو</h1>
			<p class="bebo-sub">أدوات بيبو للوحة التحكم: الكتابة له، والمايك، والمحادثة الكاملة، ودليل وسيط، وحركات الشخصية، والإعدادات.</p>
			<div class="bebo-bar" data-testid="dashboard-bebo-toolbar"><app-bebo-toolbar /></div>
		</section>
	`,
	styles: [`
		.bebo-page { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
		.bebo-ttl { margin: 0; font-size: var(--font-size-title, 20px); font-weight: 700; color: var(--text-primary, #e9f3ed); }
		.bebo-sub { margin: 0; font-size: var(--font-size-small, 13px); color: var(--text-secondary, #a8b2d1); }
		.bebo-bar { display: flex; justify-content: flex-start; max-width: 100%; overflow-x: auto; }
	`],
})
export class DashboardBebo {}
