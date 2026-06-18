# RICA Barcode Scanner — Angular App

An Angular standalone-component app with a text input for a SIM/mobile number,
plus a camera-based barcode scanner (via [ZXing](https://github.com/zxing-js/library))
that reads a barcode and writes the decoded digits straight into the field —
built for a RICA SIM registration flow.

## What's included

- `src/app/app.component.*` — the main screen: SIM number input + "scan" button
- `src/app/barcode-scanner/` — full-screen camera overlay component that:
  - requests camera access via `getUserMedia` (through ZXing's `BrowserMultiFormatReader`)
  - prefers the rear/environment-facing camera on phones
  - decodes Code 128, EAN-13/8, Code 39, ITF, PDF417, and QR formats
    (PDF417 is included because SA ID books/cards and driver's licences also
    use it, in case you extend this to scan ID documents for RICA too)
  - supports torch toggle and camera switching where the device supports it
  - emits the decoded string back to the parent, which strips non-digit
    characters before placing it in the input

## Setup

```bash
npm install
```

## Running locally — HTTPS is required

**Browsers block camera access (`getUserMedia`) on any origin that isn't
HTTPS or `localhost`.** This trips people up constantly when testing on a
real phone over a local network IP (e.g. `http://192.168.1.50:4200`), because
that's treated as insecure even though it's your own network.

Options for local dev:

**1. Plain localhost (simplest, but you can't test on a real phone)**
```bash
npm start
# open https://localhost:4200 in a desktop browser
```
The `angular.json` serve config already has `"ssl": true`, so Angular CLI
will generate a self-signed cert automatically. Accept the browser warning
once.

**2. Testing on an actual phone (recommended for a real RICA flow)**
Phones need a properly trusted cert, or a tunnel. Easiest path:

```bash
npx ng serve --host 0.0.0.0 --ssl true
```
Then use a tool like [ngrok](https://ngrok.com) or ngrok-alternatives to expose
that port over a real HTTPS URL, and open that URL on the phone. Self-signed
certs over a raw IP often still get rejected by mobile Safari/Chrome as
"untrusted," whereas a tunnel gives you a proper cert.

**3. Production**
Deploy behind any standard HTTPS hosting (Netlify, Vercel, S3+CloudFront,
Azure Static Web Apps, your own server with a Let's Encrypt cert, etc.) — as
long as it's HTTPS, camera access will work normally with no special config.

## Permissions

The browser will prompt the user for camera permission the first time the
scanner opens. If a user denies it, the component surfaces a clear inline
error message and a way to close the scanner — it won't crash or hang.

On iOS, camera access inside a regular browser tab works fine; if you ever
wrap this in a "home screen" PWA shortcut or a WebView inside a native app
shell, double check camera permissions are still being forwarded correctly,
since WebViews sometimes need extra native-side permission wiring.

## Adjusting barcode formats

If you find your specific SIM packaging uses a barcode format not in the
list (e.g. some use Data Matrix), edit the `POSSIBLE_FORMATS` hint in
`barcode-scanner.component.ts` — `BarcodeFormat.DATA_MATRIX` is available in
`@zxing/library` if needed. Narrowing the format list to only what you
actually need speeds up decoding noticeably, so it's worth keeping this list
tight rather than scanning for everything.

## Adjusting the value written to the input

`AppComponent.normalizeScannedValue()` currently strips everything except
digits, since SIM/MSISDN numbers are numeric. If your barcode encodes
something with a prefix or checksum you need to keep or parse out (e.g. an
ICCID with a leading `89` country/issuer code you want stripped, or letters
you need to preserve), that's the one method to adjust.

## Important: this is a UI building block, not RICA compliance

This app solves the technical problem of "get a barcode value into a text
field via camera." It does **not** implement RICA's actual legal/regulatory
requirements (identity verification, proof-of-residence checks, audit
logging to the relevant systems, submission to the network operator/ICASA-
mandated systems, etc.). Make sure whatever you build around this handles
those separately, ideally with input from your compliance team, since this
is what data subjects' SIM registrations legally hinge on.
