import { Component } from '@angular/core';
import { ErrorPageComponent } from '../../pages/system-errors/error-page/error-page';

/**
 * 404 — rendered with the shared system/error page so it matches the final
 * design (design-reference/.../12-النظام-والاخطاء/P-SY-001.html).
 */
@Component({
	selector: 'app-not-found',
	standalone: true,
	imports: [ErrorPageComponent],
	template: `<app-error-page type="404"></app-error-page>`
})
export class NotFoundComponent {}
