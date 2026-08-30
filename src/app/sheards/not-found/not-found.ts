import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-not-found',
	standalone: true,
	imports: [CommonModule, RouterModule],
	template: `
		<div class="min-h-[80vh] flex items-center justify-center p-6 bg-transparent" dir="rtl">
			<div class="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				
				<!-- 404 Glowing Effect -->
				<div class="relative inline-block">
					<h1 class="text-8xl md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_20px_rgba(34,211,238,0.3)] leading-none">
						404
					</h1>
					<div class="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-400 to-blue-600 opacity-20 -z-10 rounded-full"></div>
				</div>

				<div class="space-y-4">
					<h2 class="text-2xl md:text-3xl font-bold text-white">الصفحة غير موجودة</h2>
					<p class="text-slate-400 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
						عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. ربما تم نقلها، أو حذفها، أو قد يكون هناك خطأ في الرابط.
					</p>
				</div>

				<div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
					<button (click)="goBack()" 
						class="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group text-white font-bold">
						<svg class="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<!-- Right pointing arrow for RTL back -->
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
						الرجوع للخلف
					</button>
					
					<a routerLink="/" 
						class="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group">
						<svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
						</svg>
						الرئيسية
					</a>
				</div>
			</div>
		</div>
	`
})
export class NotFoundComponent {
	private location = inject(Location);
	
	goBack() {
		this.location.back();
	}
}
