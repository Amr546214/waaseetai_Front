import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-it-works-provider',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './provider.html',
  styleUrl: './provider.css'
})
export class HowItWorksProvider {}
