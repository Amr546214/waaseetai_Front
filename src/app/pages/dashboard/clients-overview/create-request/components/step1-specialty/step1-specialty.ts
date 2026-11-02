import {
  Component,
  Input,
  signal,
  computed,
  ElementRef,
  ViewChild,
  OnInit,
  DoCheck,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
  selector: 'app-step1-specialty',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step1-specialty.html',
  styleUrl: './step1-specialty.css',
})
export class Step1Specialty implements OnInit, DoCheck {
  @Input({ required: true }) parent!: CreateRequest;

  @ViewChild('editButton') editButtonRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  /** Tracks whether user explicitly requested to edit/reopen the picker after a selection is made */
  readonly isEditing = signal(false);

  private lastSelectedSpec: string | null = null;

  ngOnInit(): void {
    if (this.parent) {
      this.lastSelectedSpec = this.parent.selectedSpec();
    }
  }

  ngDoCheck(): void {
    if (!this.parent) return;
    const current = this.parent.selectedSpec();
    if (current !== this.lastSelectedSpec) {
      this.lastSelectedSpec = current;
      // When selectedSpec changes externally (e.g. restored draft or recommendation applied),
      // ensure we are in folded state
      this.isEditing.set(false);
    }
  }

  /**
   * Selection section is folded when a specialty is selected AND the user has not opened the edit mode.
   */
  readonly isFolded = computed(() => {
    const selected = this.parent?.selectedSpec ? this.parent.selectedSpec() : null;
    return !!selected && !this.isEditing();
  });

  /**
   * Resolved data for the currently selected specialty (including fallback for 'other').
   */
  readonly selectedSpecData = computed(() => {
    if (!this.parent?.selectedSpec) return null;
    const selectedId = this.parent.selectedSpec();
    if (!selectedId) return null;

    const list = this.parent.specialties ? this.parent.specialties() : [];
    const found = list.find((s) => s.id === selectedId);
    if (found) return found;

    if (selectedId === 'other') {
      const custom = this.parent.otherText ? this.parent.otherText().trim() : '';
      return {
        id: 'other',
        name: custom || 'أخرى',
        count: 'تخصص مخصص',
        icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
        color: 'text-[var(--teal)]',
        subs: [] as string[],
      };
    }

    return {
      id: selectedId,
      name: selectedId,
      count: 'تخصص معتمد',
      icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      color: 'text-[var(--teal)]',
      subs: [] as string[],
    };
  });

  /**
   * Handle card selection:
   * - If the user selects the same category: keep existing subs, fold back into summary.
   * - If the user selects a new category: delegate to parent.selectSpec, fold into summary.
   */
  selectSpecialty(id: string): void {
    if (this.parent.selectedSpec() === id) {
      // Re-selecting the same category preserves existing selection & sub-specialties
      this.isEditing.set(false);
      this.focusAfterFolding();
      return;
    }

    this.parent.selectSpec(id);
    this.isEditing.set(false);
    this.focusAfterFolding();
  }

  /**
   * Open compact cards grid and search box for changing category.
   */
  openEdit(): void {
    this.isEditing.set(true);
    setTimeout(() => {
      this.searchInputRef?.nativeElement?.focus();
    }, 0);
  }

  /**
   * Close edit mode without changing category.
   */
  closeEdit(): void {
    this.isEditing.set(false);
    this.focusAfterFolding();
  }

  /**
   * Toggle edit mode.
   */
  toggleEdit(): void {
    if (this.isEditing()) {
      this.closeEdit();
    } else {
      this.openEdit();
    }
  }

  /**
   * Apply recommendation and fold into summary.
   */
  applyRecommendation(): void {
    this.parent.applyRecommendation();
    this.isEditing.set(false);
    this.focusAfterFolding();
  }

  /**
   * Accessible focus return to the Edit button after folding.
   */
  focusAfterFolding(): void {
    setTimeout(() => {
      this.editButtonRef?.nativeElement?.focus();
    }, 0);
  }
}
