import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-press',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './press.html',
  styleUrl: './press.css'
})
export class Press {
  scrollToKit(): void {
    if (typeof document !== 'undefined') {
      document.getElementById('press-kit')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
