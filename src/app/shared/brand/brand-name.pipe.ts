import { Pipe, PipeTransform, inject } from '@angular/core';
import { PlatformInfoService } from '../../core/services/platform-info.service';

/** The platform name for shell labels (logo text/alt, footer, sign-in headings): the SUPER_ADMIN's `platformName` setting, else the built-in «وسيط AI». Use `{{ '' | brandName }}`. */
@Pipe({ name: 'brandName', standalone: true, pure: false })
export class BrandNamePipe implements PipeTransform {
	private info = inject(PlatformInfoService);
	transform(_unused?: unknown): string { return this.info.brand(); }
}
