# QRImage Generator (Astro)

A modern, high-contrast QR code generator built with **[Astro](https://astro.build/)** that produces beautiful, camera-scannable QR codes with embedded images, custom artwork, and full styling flexibility.

---

## ✨ Features

- **Built with Astro**: Component-driven architecture with fast HMR dev server and static site generation (`SSG`).
- **Guaranteed Scan Protection**: Ensures smartphone cameras can scan the QR code reliably by maintaining high-contrast module separation, solid quiet zones, and Level H (30%) error correction.
- **Custom Freedom Mode**: Unlock full manual control to customize module sizing, curvature, border widths (0 to 15 modules), and styling down to the exact percentage.
- **Embedded Artwork & Logos**:
  - **Background Art**: Subtle mosaic styling overlaying the full code area with customizable dimming/tinting.
  - **Center Logo**: Badged logo placement with rounded corners, drop shadows, and automatic safe zone calculation.
- **Direct Clipboard Integration**:
  - **Paste to Embed**: Press `Ctrl+V` anywhere on the page to immediately embed an image from your clipboard.
  - **Copy QR Image**: One-click button to copy the generated QR code directly to your clipboard.
- **Multi-Resolution PNG Export**: Download crisp assets ready for digital use or print:
  - `512 px` (Standard Web)
  - `1024 px` (High Resolution)
  - `2048 px` (2K Print Quality)
  - `4096 px` (4K Ultra HD / Large Poster)
- **Live Interactive Previews**: Instant debounced rendering as you type or adjust sliders.
- **Sleek Dark UI**: Modern dark theme crafted with Plus Jakarta Sans and JetBrains Mono typography.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or later)

### Running Locally with Astro

1. Clone or download the repository:
   ```bash
   git clone https://github.com/ryguy0601/qr_image.git
   cd qr_image
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Astro development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:4321/
   ```

---

## 📦 Project Structure

```text
qr_image/
├── public/                 # Static assets (favicons, public files)
│   ├── favicon.svg
│   └── images/
├── src/
│   ├── components/         # Modular Astro UI components
│   │   ├── Header.astro    # Top navigation & reset action
│   │   ├── QRControls.astro# Form inputs, sliders, presets & color pickers
│   │   └── QRPreview.astro # Live viewport, resolution selector & export actions
│   ├── layouts/
│   │   └── Layout.astro    # HTML document skeleton & global typography
│   ├── pages/
│   │   └── index.astro     # Main application page & client script orchestration
│   ├── scripts/            # Core QR matrix & canvas rendering modules
│   │   ├── qrcode.js       # UTF-8 QR code matrix engine (ES module)
│   │   └── qrRenderer.js   # Canvas drawing, scannability enforcement & clipboard APIs
│   └── styles/
│       └── global.css      # Design system variables, dark theme & utility classes
├── astro.config.mjs        # Astro project configuration
├── package.json
└── README.md
```

---

## 🛠️ Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` / `npm start` | Launches the Astro dev server at `http://localhost:4321/` with HMR |
| `npm run build` | Builds optimized static output into `dist/` |
| `npm run preview` | Previews the build output locally |

---

## 📖 Usage Guide

1. **Enter Payload**: Type or paste your URL, contact info, or text into the input field. The QR code updates automatically.
2. **Add an Image (Optional)**:
   - Drag & drop an image file (PNG, JPG, SVG, WebP) onto the upload box.
   - Or click the box to browse your files.
   - Or press `Ctrl+V` to paste an image directly from your clipboard.
3. **Choose Embedding Style**:
   - **Background Art**: Displays the artwork behind the QR modules with adjustable dimming tint and inset margins.
   - **Center Logo**: Places a clean, padded logo badge in the center of the QR code.
4. **Tune Scannability & Aesthetics**:
   - Keep **Guaranteed Scan Mode** enabled for safe bounds.
   - Toggle to **Custom Freedom** to customize module scale, corner roundness, borders, and color schemes.
5. **Export & Share**:
   - Select your desired output resolution (e.g., `1024 px` or `2048 px`).
   - Click **Download** to save the PNG, or click **Copy** to copy the image to your clipboard.

---

## 🎛️ Controls & Configuration

| Control | Description | Range |
| :--- | :--- | :--- |
| **Guaranteed Scan Mode** | Locks module size & border to camera-safe minimums | ON / OFF |
| **Dark Module Scale** | Adjusts the footprint of dark data modules | 0% – 100% |
| **White Portion Fill** | Adjusts coverage of white spacer modules | 0% – 100% |
| **Border Width** | Outer quiet zone padding around the QR code | 0 – 15 modules |
| **Module Curvature** | Rounds the corners of modules for fluid styles | 0% – 50% |
| **Error Correction** | Redundancy level (`L` 7%, `M` 15%, `Q` 25%, `H` 30%) | L, M, Q, H |
| **Color Pickers** | Custom foreground and background colors | Hex codes |
| **Transparent Canvas** | Renders background transparent for PNG overlays | Toggle |

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
