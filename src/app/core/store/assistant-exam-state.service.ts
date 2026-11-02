import { Injectable, signal } from '@angular/core';

// Exam visibility must not start the assistant's sockets, capabilities or account effects.
@Injectable({ providedIn: 'root' })
export class AssistantExamState {
 readonly examActive = signal(false);
 setExamActive(active: boolean): void { this.examActive.set(active); }
}
