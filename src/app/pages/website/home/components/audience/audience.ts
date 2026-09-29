import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';

@Component({
  selector: 'app-audience',
  imports: [RouterLink],
  templateUrl: './audience.html',
  styleUrl: './audience.css',
})
export class Audience {
  readonly authStore = inject(AuthStore);
}
