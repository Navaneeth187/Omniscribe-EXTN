# RelayOne AI: Production Walkthrough & User Manual

Welcome to **RelayOne AI**, a unified, local-first context bridge, visual document compilation deck, and sandboxed math rendering extension. This document outlines the architecture, user flows, and instructions for testing and running the extension.

---

## 🚀 1. Quick Start Installation Guide

To load the compiled extension into Google Chrome:

1. **Clean Compile:** Build all pages by running the automated compiler command:
   ```bash
   npm run build
   ```
   This compiles popup, options, sidebar, and sandbox entries into the `dist/` directory and copies configuration schemas automatically.
2. **Open Extensions Manager:** Launch Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. **Toggle Developer Mode:** Turn on the **Developer Mode** slider in the top-right corner.
4. **Load Unpacked:** Click the **Load unpacked** button in the top-left, navigate to the `e:\Projects\Extension V2\` workspace, and select the output `dist` folder.
5. **Pin RelayOne:** Locate **RelayOne AI** in your Chrome Extensions menu (puzzle icon) and pin it to your toolbar.

> [!NOTE]  
> A pre-packaged production zip `relayone-ai-extension.zip` has been generated in the root directory for immediate manual uploads.

---

## 🎨 2. Core User Flows & Functionality

### A. The Floating Orb & Scraper (In-Context Bridge)
*   **Target Websites:** Matches ChatGPT, Claude, Gemini, Perplexity, and Grok.
*   **Behavior:** When you visit any of these pages, a glassmorphic **RelayOne Floating Orb** mounts in the bottom-right corner using a safe **Shadow DOM** to prevent website styling leaks.
*   **Manual Trigger:** Click **Capture Thread** on the Orb. The extension scrapes the active thread's prompts and answers, formats them, and writes them into local IndexedDB storage.
*   **Context Handoff:** Click any target (e.g., *Claude*) on the Orb's expansion menu. The extension stores the active conversation thread history, sets a pending bridge, opens the destination page, automatically inserts the history prefixed with your custom preamble, and submits the prompt.

### B. The Sidebar Aggregator (`sidepanel.html`)
*   **Access:** Click the RelayOne extension icon or click **Open Sidebar Aggregator** in the popup menu.
*   **Search & Tag Filters:** Type search terms to filter conversation histories by title or platform. Click tag buttons (e.g. `#research`) to narrow down logs.
*   **Fast Formatted Exports:**
    1. Select any conversation card.
    2. Choose from the layout quick-buttons for PDF, Markdown, Word, or JSON formats.
    3. The file compiles and downloads instantly, featuring professional formatting custom-designed for this extension.

### C. Options Panel & Math Previewer (`options.html`)
*   **Access:** Right-click the extension icon and select **Options**.
*   **Real-Time Style Editor:** Slide settings for **Font Size**, **Page Margins**, and **Line Spacing**. Toggle between curated visual themes (*Cherry Sakura*, *Royal Lavender*, *Sleek Slate*, *Charcoal*, *Emerald*).
*   **Sandboxed LaTeX Math Compiler:**
    *   Inline formulas (`$x^2$`) and display formula blocks (`$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`) are captured dynamically.
    *   The formula is posted to a sandboxed iframe to bypass strict Manifest V3 Content Security Policies.
    *   The compiled SVG/HTML vector markup returns from the sandbox and updates the preview immediately.
*   **Export Drivers:** Downloader buttons compile and trigger local downloads of **PDF** (rendered dynamically using `jsPDF` with custom margins and page headers/footers), **Markdown**, **Word (`.doc`)** (with styled HTML containers), or structured **JSON** schema files.

---

## 🏗️ 3. Under the Hood: Technical Architecture

```mermaid
graph TD
  A[Host Pages: Claude / ChatGPT] -->|Orb Scraper| B(IndexedDB: Dexie.js)
  B -->|Syncs list| C(Sidebar Aggregator Panel)
  B -->|Loads active chat| D(Options Visual Previewer)
  D -->|postMessage| F(Sandboxed Iframe: KaTeX Compiler)
  F -->|Returns markup| D
  C -->|Export Drivers| G[Styled PDF / MD / Word / JSON Download]
  D -->|Export Drivers| G
```

### Key Technical Decisions:
*   **Zero-Cloud Footprint:** All user conversations, settings, and file rendering remain local to your browser profile. No cloud accounts, cross-device syncs, or remote servers are implemented.
*   **Memory-Safe PDF Wrapping:** jsPDF line calculation logic automatically paginates blocks, wraps long text nodes, and handles line heights dynamically to match theme specifications.
