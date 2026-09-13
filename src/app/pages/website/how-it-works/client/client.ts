import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-it-works-client',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './client.html',
  styleUrl: './client.css'
})
export class HowItWorksClient {}
