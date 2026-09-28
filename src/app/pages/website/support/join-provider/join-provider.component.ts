import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-join-provider',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './join-provider.component.html',
	styleUrls: ['./join-provider.component.css']
})
export class JoinProviderComponent {
	/** Open FAQ items (design P-SP-004 toggles each item independently). */
	private open = new Set<number>();

	isOpen(i: number): boolean { return this.open.has(i); }

	toggleFaq(i: number) {
		if (this.open.has(i)) this.open.delete(i); else this.open.add(i);
	}
}
