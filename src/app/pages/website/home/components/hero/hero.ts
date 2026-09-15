import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  constructor(private router: Router) {}

  search(value: string): void {
    const q = value.trim();
    this.router.navigate(['/marketplace'], q ? { queryParams: { q } } : undefined);
  }
}
