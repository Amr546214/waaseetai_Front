import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioItem } from '../../applay-request';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-step1-general',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './step1-general.html',
  styleUrls: ['./step1-general.css']
})
export class Step1General {
  @Input() proposal!: any;
  @Input() titleLength = 0;
  @Input() messageLength = 0;
  @Input() outputsLength = 0;
  @Input() aiQuality: any = {};
  @Input() isFetchingAiSuggest = false;
  @Input() newReq = '';
  @Input() portfolioOptions: PortfolioItem[] = [];
  @Input() isLoadingPortfolio = false;
  @Input() selectedPortfolioNames = '';

  @Output() proposalChange = new EventEmitter<any>();
  @Output() newReqChange = new EventEmitter<string>();

  @Output() updateTitle = new EventEmitter<string>();
  @Output() updateMessage = new EventEmitter<string>();
  @Output() updateOutputs = new EventEmitter<string>();
  @Output() useAISuggest = new EventEmitter<void>();
  @Output() addReq = new EventEmitter<void>();
  @Output() removeReq = new EventEmitter<number>();
  @Output() togglePortfolio = new EventEmitter<{id: string, event: Event}>();
  @Output() clearPortfolio = new EventEmitter<void>();

  onTogglePortfolio(id: string, event: Event) {
    this.togglePortfolio.emit({id, event});
  }
}
