import { WsCurrencyPipe } from '../../../../shared/money/money.pipe';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-it-works-client',
  standalone: true,
  imports: [RouterLink, WsCurrencyPipe],
  templateUrl: './client.html',
  styleUrl: './client.css'
})
export class HowItWorksClient {}
