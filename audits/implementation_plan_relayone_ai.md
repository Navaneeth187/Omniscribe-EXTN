# Implementation Plan & Engineering Backlog: RelayOne AI
**Product Version:** 1.0 (Consolidated Super-Extension)  
**Author:** Technical Program Management & Dev Lead Team  
**Date:** June 14, 2026  
**Status:** Approved Roadmap

---

## Part 1: Build Plans & Implementation Phases

### Phase 1: Project Scaffolding & Shared Database (MVP Build Plan)
*   **Objective:** Establish the development boilerplate, configure compile utilities, and deploy the IndexedDB storage layer.
*   **Tasks:**
    1.  Initialize Vite project with TypeScript support.
    2.  Write the unified MV3 `manifest.json` outlining permissions (`storage`, `declarativeNetRequest`, `sidePanel`, `cookies`, `contextMenus`, `tabs`).
    3.  Implement `local_db.ts` utilizing Dexie.js to declare `conversations` and `messages` tables.
*   **Dependencies:** None.
*   **Estimated Effort:** 3 Days.
*   **Deliverables:** Integrated build workspace compiling separate targets; working database module.

### Phase 2: Unified Content Scraper & Handoff Panel (MVP Build Plan)
*   **Objective:** Unify scraping routines, build the floating glassmorphic orb overlay, and connect the background tab injection system.
*   **Tasks:**
    1.  Consolidate DOM selectors for ChatGPT, Claude, Gemini, Perplexity, and Grok.
    2.  Build the floating orb menu panel (`content.ts` + `content.css`) with draggable handles.
    3.  Script background worker tab creation listeners and the `2.5s` hydration delay sequence.
    4.  Write input editor injectors simulating Quill and ProseMirror text input.
*   **Dependencies:** Phase 1 (requires database and workspace settings).
*   **Estimated Effort:** 5 Days.
*   **Deliverables:** Fully operational context transfer between the 5 primary platforms.

### Phase 3: Export Engine & Style Preview Options (MVP Build Plan)
*   **Objective:** Deploy offline export formats (PDF, Markdown, Docx, Text, JSON) and design the options style dashboard.
*   **Tasks:**
    1.  Port client-side document generator libraries (jsPDF, docx-JS).
    2.  Design options panel split-view layout: Left sidebar controls layout/theme styles, right sidebar displays iframe preview.
    3.  Code style presets (Sakura, Lavender, Fresh Green, Old Paper, etc.).
*   **Dependencies:** Phase 2.
*   **Estimated Effort:** 4 Days.
*   **Deliverables:** Preformatted styled previews and instant client-side downloads.

### Phase 4: Side Panel Aggregator & Notion Integration (Beta Build Plan)
*   **Objective:** Activate SidePanel multiselect composer and Notion database synchronization.
*   **Tasks:**
    1.  Set up sidebar panels to toggle list queue views.
    2.  Add checkbox indicators onto target chat bubbles to collect turn items.
    3.  Implement Chrome Web Auth Flow inside the service worker to fetch Notion oauth tokens.
    4.  Configure declarativeNetRequest rules to intercept and bypass Notion CORS limits.
*   **Dependencies:** Phase 3.
*   **Estimated Effort:** 6 Days.
*   **Deliverables:** Notion authorization linking and automated page generation; multi-session document aggregation.

### Phase 5: Optimization & Internationalization (Production Build Plan)
*   **Objective:** Translate resources, resolve DOM styles issues, and package for CWS release.
*   **Tasks:**
    1.  Organize translations for 10 languages inside `_locales/`.
    2.  Ensure CSS isolation to prevent extension buttons from breaking parent LLM styles.
    3.  Clean out all deprecated billing check code and analytics trackers.
*   **Dependencies:** Phase 4.
*   **Estimated Effort:** 4 Days.
*   **Deliverables:** Highly optimized production bundle (`.zip`) ready for Chrome Web Store publishing.

---

## Part 2: Engineering Backlog by Priority

### Priority P0: Critical Path (Core Functionality)
*   **Task P0-1: Scaffolding** Set up Vite bundler, compile directory trees, and establish the Manifest V3 layout.
*   **Task P0-2: Platform Scrapers** Merge DOM query rules for ChatGPT, Claude, Gemini, Perplexity, and Grok.
*   **Task P0-3: Local Storage DB** Write Dexie database initialization scripts to capture conversations.
*   **Task P0-4: Tab Handoff Swapper** Implement tab creations and auto-injection scripts (Quill/ProseMirror targets).
*   **Task P0-5: Clipboard Fallback** Implement automatic copy fallback in the event of DOM injection failures.

### Priority P1: Essential Utilities
*   **Task P1-1: Styled Export Library** Port jsPDF layout settings and docx compiler libraries.
*   **Task P1-2: Options Portal** Create the options page split-pane layout with reactive settings.
*   **Task P1-3: Theme System** Style theme definitions (Sakura, Lavender, Green, Note, Paper, Dark, Light).
*   **Task P1-4: DNR Notion Rules** Configure declarative Net request rules and map the Notion sync proxy payload.

### Priority P2: User Experience & Optimization
*   **Task P2-1: Glassmorphic Orb Deck** Build draggable, dockable floating action widgets for LLM pages.
*   **Task P2-2: Side Panel aggregator** Deploy the side panel list interface and bubble checkbox collection hooks.
*   **Task P2-3: Customizable Preambles** Add text input editor in options to customize prompt transition headers.
*   **Task P2-4: Multi-Language Pack** Map translate dictionaries inside the local folder `_locales/`.

### Priority P3: Future Optimizations
*   **Task P3-1: Web-Assembly Search** Implement offline full-text search indexes on top of historical db caches.
*   **Task P3-2: Local PII Scrubber** Add regex rules to identify and mask passwords or secrets before file exports.
*   **Task P3-3: Auto-update Selectors** Program service workers to periodically query updated JSON selector lists.
