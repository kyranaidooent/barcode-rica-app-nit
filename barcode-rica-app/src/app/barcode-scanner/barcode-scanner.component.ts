import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrl: './barcode-scanner.component.css',
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement', { static: true })
  videoElementRef!: ElementRef<HTMLVideoElement>;

  @Output() scannedNumber = new EventEmitter<string>();

  /** Emits when the user dismisses the scanner without a successful scan. */
  @Output() closed = new EventEmitter<void>();

  private reader: BrowserMultiFormatReader | null = null;
  private activeStream: MediaStream | null = null;
  private availableDevices: MediaDeviceInfo[] = [];
  private currentDeviceId: string | null = null;

  errorMessage: string | null = null;
  isInitializing = true;
  hasMultipleCameras = false;
  torchSupported = false;
  torchOn = false;

  constructor(private ngZone: NgZone) {}

  async ngAfterViewInit(): Promise<void> {
    await this.startScanning();
  }

  ngOnDestroy(): void {
    this.stopScanning();
  }

  private async startScanning(): Promise<void> {
    this.isInitializing = true;
    this.errorMessage = null;

    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      this.errorMessage =
        'Camera access is not supported in this browser. Try Chrome, Edge, or Safari on a device with a camera, served over HTTPS.';
      this.isInitializing = false;
      return;
    }

    // Restrict decoding to formats actually used on SIM packaging / ID docs
    // for a RICA flow. This narrows the search space and speeds up decode.
    // Code 128 and EAN-13 cover most SIM/ICCID barcodes; PDF417 covers
    // South African ID/driver's licence barcodes if you extend this to
    // scan identity documents too.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.PDF_417,
      BarcodeFormat.QR_CODE,
    ]);

    this.reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
    });

    try {
      this.availableDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      this.hasMultipleCameras = this.availableDevices.length > 1;

      const rearCamera = this.availableDevices.find((d) =>
        /back|rear|environment/i.test(d.label)
      );
      this.currentDeviceId = rearCamera?.deviceId ?? this.availableDevices[0]?.deviceId ?? null;

      await this.decodeFromCurrentDevice();
    } catch (err) {
      this.handleCameraError(err);
    }
  }

  private async decodeFromCurrentDevice(): Promise<void> {
    if (!this.reader) {
      return;
    }

    const constraints: MediaStreamConstraints = this.currentDeviceId
      ? { video: { deviceId: { exact: this.currentDeviceId } } }
      : { video: { facingMode: 'environment' } };

    try {
      const controlsResult = await this.reader.decodeFromConstraints(
        constraints,
        this.videoElementRef.nativeElement,
        (result, error) => {
          if (result) {
            this.ngZone.run(() => {
              this.scannedNumber.emit(result.getText());
            });
          }
          // 'error' fires continuously while no barcode is in frame; that's
          // expected ZXing behaviour, not a real failure, so it's ignored here.
        }
      );

      this.activeStream = this.videoElementRef.nativeElement.srcObject as MediaStream;
      this.checkTorchSupport();
      this.isInitializing = false;

      // Keep a reference so we can stop it cleanly later.
      (this as any)._controls = controlsResult;
    } catch (err) {
      this.handleCameraError(err);
    }
  }

  private checkTorchSupport(): void {
    const track = this.activeStream?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.();
    this.torchSupported = !!(capabilities && 'torch' in capabilities);
  }

  async toggleTorch(): Promise<void> {
    const track = this.activeStream?.getVideoTracks()[0];
    if (!track || !this.torchSupported) {
      return;
    }
    this.torchOn = !this.torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: this.torchOn } as any],
      });
    } catch {
      // Torch toggling isn't supported on every device; fail quietly.
      this.torchOn = false;
    }
  }

  async switchCamera(): Promise<void> {
    if (this.availableDevices.length < 2) {
      return;
    }
    const currentIndex = this.availableDevices.findIndex(
      (d) => d.deviceId === this.currentDeviceId
    );
    const nextIndex = (currentIndex + 1) % this.availableDevices.length;
    this.currentDeviceId = this.availableDevices[nextIndex].deviceId;

    this.stopMediaTracks();
    this.isInitializing = true;
    await this.decodeFromCurrentDevice();
  }

  private handleCameraError(err: unknown): void {
    this.isInitializing = false;
    const error = err as { name?: string; message?: string };

    if (error?.name === 'NotAllowedError') {
      this.errorMessage =
        'Camera permission was denied. Please allow camera access in your browser settings and try again.';
    } else if (error?.name === 'NotFoundError') {
      this.errorMessage = 'No camera was found on this device.';
    } else if (error?.name === 'NotReadableError') {
      this.errorMessage =
        'The camera is already in use by another application.';
    } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      this.errorMessage =
        'Camera access requires HTTPS. This page must be served over a secure connection.';
    } else {
      this.errorMessage = 'Unable to access the camera. ' + (error?.message ?? '');
    }
  }

  private stopMediaTracks(): void {
    this.activeStream?.getTracks().forEach((track) => track.stop());
    this.activeStream = null;
  }

  private stopScanning(): void {
    try {
      (this as any)._controls?.stop();
    } catch {
      // no-op if controls were never set
    }
    this.stopMediaTracks();
    this.reader = null;
  }

  onClose(): void {
    this.stopScanning();
    this.closed.emit();
  }
}
