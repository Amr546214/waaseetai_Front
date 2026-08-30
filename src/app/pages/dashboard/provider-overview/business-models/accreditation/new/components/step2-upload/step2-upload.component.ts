import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttachmentFile } from '../../new';

@Component({
  selector: 'app-step2-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step2-upload.component.html',
})
export class Step2UploadComponent {
  @Input({ required: true }) title!: string;
  @Output() titleChange = new EventEmitter<string>();

  @Input({ required: true }) description!: string;
  @Output() descriptionChange = new EventEmitter<string>();

  @Input({ required: true }) techInput!: string;
  @Output() techInputChange = new EventEmitter<string>();

  @Input({ required: true }) technologiesUsed!: string[];
  @Output() onAddTechTag = new EventEmitter<void>();
  @Output() onRemoveTechTag = new EventEmitter<string>();

  @Input({ required: true }) projectUrl!: string;
  @Output() projectUrlChange = new EventEmitter<string>();

  @Input({ required: true }) githubUrl!: string;
  @Output() githubUrlChange = new EventEmitter<string>();

  @Input({ required: true }) attachments!: AttachmentFile[];
  @Output() onFileSelected = new EventEmitter<any>();
  @Output() onHandleDrop = new EventEmitter<DragEvent>();
  @Output() onRemoveAttachment = new EventEmitter<string>();

  addTechTag() {
    this.onAddTechTag.emit();
  }
  removeTechTag(tag: string) {
    this.onRemoveTechTag.emit(tag);
  }
  handleFileSelected(event: any) {
    this.onFileSelected.emit(event);
  }
  handleDropEvent(event: DragEvent) {
    this.onHandleDrop.emit(event);
  }
  removeAttachment(id: string) {
    this.onRemoveAttachment.emit(id);
  }
}
