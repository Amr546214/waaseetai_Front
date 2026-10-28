import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../core/services/loading.service';
import { IdentityImgDirective } from '../../core/identity/identity-img.directive';

@Component({
	selector: 'app-page-loader',
	standalone: true,
	imports: [IdentityImgDirective, CommonModule],
	templateUrl: './page-loader.html',
	styleUrl: './page-loader.css'
})
export class PageLoader {
	loadingService = inject(LoadingService);
}
