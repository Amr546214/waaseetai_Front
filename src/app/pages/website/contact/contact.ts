import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
  encapsulation: ViewEncapsulation.None
})
export class Contact {
  submitted = signal(false);

  form = {
    name: '',
    email: '',
    type: '',
    message: ''
  };

  submitForm(e: Event) {
    e.preventDefault();
    this.submitted.set(true);
  }
}
