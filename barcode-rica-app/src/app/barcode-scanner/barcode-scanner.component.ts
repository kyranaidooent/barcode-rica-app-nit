import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  NgZone,
  output,
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

  scannedNumber = output<string>();
  closed = output<void>();

  private reader: BrowserMultiFormatReader | null = null;
  private controls: { stop: () => void } | null = null;
  private activeStream: MediaStream | null = null;
  availableDevices: MediaDeviceInfo[] = [];
  currentDeviceId: string | null = null;

  errorMessage: string | null = null;
  isInitializing = true;
  torchSupported = false;
  torchOn = false;

  constructor(private ngZone: NgZone) { }

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

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
    });

    try {
      this.availableDevices = await BrowserMultiFormatReader.listVideoInputDevices();
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
      : {
        video: {
          facingMode: 'environment',
        },

      };

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
        }
      );

      this.activeStream = this.videoElementRef.nativeElement.srcObject as MediaStream;
      this.checkTorchSupport();
      this.isInitializing = false;

      this.controls = controlsResult as { stop: () => void };
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
    await this.selectCamera(this.availableDevices[nextIndex].deviceId);
  }

  async onCameraSelectionChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement | null;
    const selectedDeviceId = select?.value;
    if (!selectedDeviceId) {
      return;
    }

    await this.selectCamera(selectedDeviceId);
  }

  getCameraLabel(device: MediaDeviceInfo, index: number): string {
    const label = device.label?.trim();
    return label || `Camera ${index + 1}`;
  }

  private async selectCamera(deviceId: string): Promise<void> {
    if (this.currentDeviceId === deviceId) {
      return;
    }

    this.currentDeviceId = deviceId;
    this.torchOn = false;

    this.stopActiveScanSession();
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

  private stopActiveScanSession(): void {
    try {
      this.controls?.stop();
    } catch {
    }
    this.controls = null;
    this.stopMediaTracks();
  }

  private stopScanning(): void {
    this.stopActiveScanSession();
    this.reader = null;
  }

  onClose(): void {
    this.stopScanning();
    this.closed.emit();
  }
}
