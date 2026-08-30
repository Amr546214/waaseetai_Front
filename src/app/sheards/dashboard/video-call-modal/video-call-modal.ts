import { Component, inject, ElementRef, ViewChild, AfterViewChecked, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { VideoCallService, CallState } from '../../../core/services/video-call.service';

@Component({
  selector: 'app-video-call-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-call-modal.html',
  styleUrl: './video-call-modal.css',
  host: {
    '[class.vc-modal-active]': "currentState !== 'IDLE'"
  }
})
export class VideoCallModalComponent implements OnInit, OnDestroy, AfterViewChecked {
  public videoCallService = inject(VideoCallService);
  private cdr = inject(ChangeDetectorRef);
  private sub = new Subscription();

  public currentState: CallState = 'IDLE';

  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

  ngOnInit(): void {
    this.sub.add(
      this.videoCallService.callState$.subscribe((state) => {
        console.log('⚡ [VideoCallModalComponent] RxJS callState changed to:', state);
        this.currentState = state;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.currentState === 'IDLE') return;

    // Attach/re-bind local stream to <video> element
    const localStream = this.videoCallService.localStreamSignal() || this.videoCallService.localStream;
    if (this.localVideoRef?.nativeElement && localStream) {
      const vid = this.localVideoRef.nativeElement;
      if (vid.srcObject !== localStream) {
        vid.srcObject = localStream;
        vid.play().catch((err) => console.log('Local video play catch:', err));
      }
    }

    // Attach/re-bind remote stream to <video> element
    const remoteStream = this.videoCallService.remoteStreamSignal() || this.videoCallService.remoteStream;
    if (this.remoteVideoRef?.nativeElement && remoteStream) {
      const rVid = this.remoteVideoRef.nativeElement;
      if (rVid.srcObject !== remoteStream) {
        rVid.srcObject = remoteStream;
        rVid.play().catch((err) => console.log('Remote video play catch:', err));
      }
    }
  }

  acceptCall(): void {
    this.videoCallService.acceptCall();
  }

  declineCall(): void {
    this.videoCallService.declineCall();
  }

  endCall(): void {
    this.videoCallService.endCall(true);
  }

  toggleMic(): void {
    this.videoCallService.toggleMic();
  }

  toggleCamera(): void {
    this.videoCallService.toggleCamera();
  }

  toggleScreenShare(): void {
    this.videoCallService.toggleScreenShare();
  }
}
