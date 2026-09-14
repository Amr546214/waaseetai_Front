import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../core/services/loading.service';

@Component({
	selector: 'app-page-loader',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './page-loader.html',
	styleUrl: './page-loader.css'
})
export class PageLoader {
	loadingService = inject(LoadingService);
}
