import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
	private pendingRequests = signal(0);

	isLoading = computed(() => this.pendingRequests() > 0);

	start() {
		this.pendingRequests.update(n => n + 1);
	}

	stop() {
		this.pendingRequests.update(n => Math.max(0, n - 1));
	}
}
