# Ultimate Offline QR Code Scanner

A fully offline, privacy-first QR code scanner that runs entirely in your browser. **No internet required after download.**

## Features

- **Live Camera Scanning** – Use your device camera (rear preferred)
- **Image Upload** – Drag & drop or select any image containing a QR code
- **Switch Camera** – Front / rear camera toggle
- **Torch / Flash** – Toggle flashlight when supported
- **Scan History** – Last 50 scans saved locally (localStorage)
- **Copy / Open / Share** – One-tap actions for results
- **URL Detection** – Automatically offers to open links
- **100% Offline** – All libraries bundled, zero network requests
- **Privacy First** – Nothing leaves your device

## How to Use

1. Unzip this folder
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
3. Grant camera permission when prompted (or use the Upload tab)

> **Tip:** For best results on mobile, open the file in your browser and add it to your home screen.

## Files

| File        | Description                    |
|-------------|--------------------------------|
| index.html  | Main application               |
| styles.css  | Styles                         |
| app.js      | Application logic              |
| jsQR.js     | QR decoding library (jsQR)     |
| README.md   | This file                      |

## Technical Details

- QR decoding powered by [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0)
- Pure HTML / CSS / Vanilla JavaScript
- Works on desktop and mobile
- No build step, no dependencies to install

## License

The application code is free to use. jsQR is licensed under Apache-2.0.
