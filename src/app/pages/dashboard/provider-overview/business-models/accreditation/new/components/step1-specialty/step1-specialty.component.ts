import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SpecialtyCategory } from '../../new';

@Component({
  selector: 'app-step1-specialty',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './step1-specialty.component.html',
  styleUrl: './step1-specialty.component.css'
})
export class Step1SpecialtyComponent {
  @Input({ required: true }) isLoading!: boolean;
  @Input({ required: true }) hasAccreditedSpecialties!: boolean;
  @Input({ required: true }) categories!: SpecialtyCategory[];
  @Input({ required: true }) selectedSpecialtyId!: string | null;
  @Input({ required: true }) selectedSubSpecialties!: string[];
  @Input({ required: true }) selectedSpecialtySubs!: string[];

  @Output() onToggleSpecialty = new EventEmitter<string>();
  @Output() onToggleSubSpecialty = new EventEmitter<string>();

  toggleSpecialty(id: string) {
    this.onToggleSpecialty.emit(id);
  }

  toggleSubSpecialty(sub: string) {
    this.onToggleSubSpecialty.emit(sub);
  }
}
