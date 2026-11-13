import { Injectable, computed, inject, signal } from '@angular/core';
import { SpecialtyService } from './specialty.service';

export interface ExamEnvironment {
	mode: 'off' | 'required';
	/** required AND configured on the server: only then can a restricted exam start */
	ready: boolean;
	/** THIS browser's request carried a valid Safe Exam Browser hash (checked by the server) */
	verified: boolean;
	restricted: boolean;
	configUrl?: string;
	configDownloadUrl?: string;
	downloadUrl: string;
	supportedSystems: { system: string; supported: boolean; note?: string }[];
	limits: string;
}

/** What the server says about the exam environment. `off` = the normal test (no device restriction); `required` = only a verified Safe Exam Browser may start or continue it. */
@Injectable({ providedIn: 'root' })
export class ExamEnvironmentService {
	private readonly specialty = inject(SpecialtyService);
	readonly env = signal<ExamEnvironment | null>(null);
	/** restricted mode is on (the page must not start the test unless verified) */
	readonly restricted = computed(() => this.env()?.restricted === true);
	/** the restricted test can run here: required, configured and this browser verified */
	readonly satisfied = computed(() => !this.restricted() || (this.env()?.ready === true && this.env()?.verified === true));
	load(done?: (e: ExamEnvironment | null) => void): void {
		this.specialty.getExamEnvironment().subscribe({
			next: (r: any) => { const d = r?.data; this.env.set(d && typeof d.mode === 'string' ? (d as ExamEnvironment) : null); done?.(this.env()); },
			error: () => { done?.(this.env()); } // unknown: the normal flow keeps working, the server still refuses a restricted start by itself
		});
	}
}
