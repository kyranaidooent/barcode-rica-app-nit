import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BarcodeScannerComponent } from './barcode-scanner/barcode-scanner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeScannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  /** The value bound to the visible text input. */
  simNumber = '';

  /** Controls whether the scanner overlay is shown. */
  isScannerOpen = false;

  /** Last raw decoded barcode value, kept for an audit trail / debugging. */
  lastScanRaw: string | null = null;

  justScanned = false;

  openScanner(): void {
    this.isScannerOpen = true;
  }

  closeScanner(): void {
    this.isScannerOpen = false;
  }

  onBarcodeScannedNumber(rawValue: string): void {
    this.lastScanRaw = rawValue;
    this.simNumber = this.normalizeScannedValue(rawValue);
    this.isScannerOpen = false;
    this.justScanned = true;
    setTimeout(() => (this.justScanned = false), 2500);
  }

  private normalizeScannedValue(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  clearField(): void {
    this.simNumber = '';
    this.lastScanRaw = null;
  }
}
