import { Component, inject } from '@angular/core';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { BrandNamePipe } from '../../shared/brand/brand-name.pipe';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [BrandNamePipe, RouterLink],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css'],
})
export class Footer {
	/** the WhatsApp link follows the `supportPhone` setting (the built-in number while it is empty) */
	readonly platform = inject(PlatformInfoService);
}
