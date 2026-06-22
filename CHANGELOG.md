# Changelog

All notable changes to the **RelayOne AI Extension** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.4] - 2026-06-21

### Added
- **Theme-Aware State Synchronization Engine**: Added dynamic, reactive cross-component theme synchronization between `Popup`, `SidePanel`, and `Options` using `chrome.storage.local` and active storage change listeners.
- **Dynamic Context Bridge Layout**: Overhauled the Context Bridge section inside `SidePanel.tsx` to include an expanded, responsive grid of five primary AI platforms: ChatGPT, Claude, Gemini, Perplexity, and Grok.
- **Dynamic Theme CSS Variables**: Shifted theme styling to use dynamic, state-controlled JavaScript style variables inside React elements, enabling smooth real-time transition between dark and light themes.
- **Options Navigation Overhaul**: Redesigned `Options.tsx` using a professional left-sidebar navigation layout (General Settings, Style Settings, Data Cache). Integrated segmented button controls, graphic theme preset cards with color swatches, dynamic toggle switches, lock-encrypted mock account information status, an interactive dark/light theme switch, and customizable site shortcuts.
- **Ambient HTML Layout Templates**: Polished `options/index.html` and `sidepanel/index.html` to integrate Google Fonts (Outfit & Plus Jakarta Sans), ambient background glow backdrops, and active startup scripts to prevent styling flashing before React mounts.

### Changed
- **Styling Standardization**: Standardized spacing, border opacity ratios, and active interactive controls across all components.
- **Optimized Typography**: Updated all component containers to enforce `-0.02em` tracking and modern system font hierarchies (Outfit / Inter style rendering).
- **Consolidated Ledgers**: Standardized and visual-aligned export buttons (PDF, Markdown, Word, JSON) with custom color states and micro-interactions.

### Fixed
- **Stray Syntactical Tokens**: Removed duplicate closing curly braces in `SidePanel.tsx` and `Options.tsx` causing compilation blockages.
- **LaTeX Renderer Duplicates & Fallbacks**: Imported KaTeX CSS in `Preview.tsx` to hide overlapping MathML nodes (which caused double characters like `μμ` and `σσ`) and corrected the malformed brackets in the Options page's dummy math template string to allow correct compilation.
- **TypeScript Strictness**: Resolved implicit path return errors (`TS7030`) and unused variable warnings (`TS6133`) in React hook environments.

---

## [1.3.3] - 2026-06-20

### Added
- Initial local Dexie DB implementation.
- Basic Word and JSON document export drivers.
