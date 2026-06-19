import { Component, signal } from '@angular/core';
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
  simNumber = signal('');
  isScannerOpen = signal(false);
  lastScanRaw = signal<string | null>(null);
  justScanned = signal(false);

  openScanner(): void {
    this.isScannerOpen.set(true);
  }

  closeScanner(): void {
    this.isScannerOpen.set(false);
  }

  onBarcodeScannedNumber(rawValue: string): void {
    this.lastScanRaw.set(rawValue);
    this.simNumber.set(this.normalizeScannedValue(rawValue));
    this.isScannerOpen.set(false);
    this.justScanned.set(true);
    setTimeout(() => (this.justScanned.set(false)), 2500);
  }

  private normalizeScannedValue(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  clearField(): void {
    this.simNumber.set('');
    this.lastScanRaw.set(null);
  }
}
