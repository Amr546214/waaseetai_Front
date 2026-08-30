import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-step3-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step3-review.html',
  styleUrl: './step3-review.css'
})
export class Step3Review {
  @Input() isScanning = false;
  @Input() auditProgressMessage = '';
  @Input() currentAudit!: any;
  @Input() proposal!: any;
  @Input() projectDetails: any = null;
  @Input() showAiMsgPanel = false;
  @Input() showAiPricePanel = false;
  @Input() skippedMsgRec = false;
  @Input() skippedPriceRec = false;
  @Input() ack1 = false;
  @Input() ack2 = false;
  @Input() ack3 = false;

  @Output() prevStep = new EventEmitter<void>();
  @Output() applyAIEdit = new EventEmitter<string>();
  @Output() skipRec = new EventEmitter<string>();
  @Output() acceptAiMsg = new EventEmitter<void>();
  @Output() acceptAiPrice = new EventEmitter<void>();
  @Output() toggleAck = new EventEmitter<number>();
  @Output() showAiMsgPanelChange = new EventEmitter<boolean>();
  @Output() showAiPricePanelChange = new EventEmitter<boolean>();
}
