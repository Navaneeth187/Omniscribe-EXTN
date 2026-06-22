# Master Product Configuration: 50 MCQ Selections Audit
**Product:** RelayOne AI (Consolidated Super-Extension)  
**Status:** Audit Choices Locked

This document acts as the master record of all 50 architectural and product design choices selected for the RelayOne AI extension development.

---

## 1. Batch 1: Scrapers, Handoff & Storage (Q1 - Q10)

*   **Q1: Scraper Selector Update Delivery Mechanism**
    *   *Selection:* **Option B (Self-Healing Network Config)**
    *   *Rationale:* Fetches updated element name JSON files once daily in the background, bypassing the Chrome Web Store review bottleneck if ChatGPT/Claude changes site class structures.
*   **Q2: Self-Healing Selector Source URL Hosting**
    *   *Selection:* **Option A (Public GitHub CDN)**
    *   *Rationale:* Storing the config files on a public GitHub project is 100% free, highly reliable, and matches our serverless, local-first architecture.
*   **Q3: Handoff Loading Check Strategy**
    *   *Selection:* **Option B (Dynamic DOM Polling)**
    *   *Rationale:* Actively scans the target page every 150ms for the input textarea. Paste actions execute immediately as soon as the textbox is fully interactive, preventing timeouts on slow connections.
*   **Q4: Handoff Auto-Submission Trigger**
    *   *Selection:* **Option B (Auto-Submit)**
    *   *Rationale:* The extension automatically triggers the text input send button immediately after pasting the context.
*   **Q5: Message Scraper Depth Limits**
    *   *Selection:* **Option A (Entire Thread History)**
    *   *Rationale:* Scrapes and carries over the entire chat history turns to ensure the target LLM has complete context.
*   **Q6: Database Storage Limit Warning**
    *   *Selection:* **Option A (Silent Auto-Pruning)**
    *   *Rationale:* Silently deletes the oldest conversations in the background to ensure IndexedDB space is automatically managed without user popups.
*   **Q7: Notion Database Formatting Layout**
    *   *Selection:* **Option B (Hierarchical Page Blocks)**
    *   *Rationale:* Formats prompts as Headings, answers as paragraph text blocks, and source code fragments as Notion codeblocks.
*   **Q8: Math LaTeX Rendering Mode**
    *   *Selection:* **Option B (Rendered SVGs/Images)**
    *   *Rationale:* Uses KaTeX inside our sandbox iframe to compile LaTeX math notations into clean vectors for professional document presentation.
*   **Q9: Draggable Orb Dock Constraints**
    *   *Selection:* **Option A (Screen Edge Magnets)**
    *   *Rationale:* Draggable orb snaps smoothly to the closest left/right border of the window to keep text boxes free of obstructions.
*   **Q10: Local Selector Debug Logs**
    *   *Selection:* **Option A (Local Log Vault)**
    *   *Rationale:* Silently logs DOM scraper failures inside a dedicated database table, allowing easy troubleshooting.

---

## 2. Batch 2: UI Details, Exporters & Customizations (Q11 - Q20)

*   **Q11: Notion Page Naming Strategy**
    *   *Selection:* **Option C (Smart Format)**
    *   *Rationale:* Defaults page names to the original LLM conversation topic title while letting the user edit titles before syncing.
*   **Q12: PDF Font Library Selection**
    *   *Selection:* **Option A (Standard System Fonts)**
    *   *Rationale:* Uses Arial, Helvetica, and Times New Roman standard libraries to keep the extension package lightweight and fast.
*   **Q13: Handoff Failure Notification**
    *   *Selection:* **Option A (Glassmorphic Overlay Toast)**
    *   *Rationale:* Displays a non-intrusive notification instructs the user to paste (`Ctrl+V`) manually if the auto-injector fails.
*   **Q14: Floating Orb Behavior During Page Scrolling**
    *   *Selection:* **Option A (Fade to Semi-Transparent)**
    *   *Rationale:* Orb deck opacity drops to 30% during scrolling to avoid distraction, restoring on hover.
*   **Q15: Side Panel Composer Sorting**
    *   *Selection:* **Option A (Chronological)**
    *   *Rationale:* Orders multiple collected chat turns automatically by the time they were scraped.
*   **Q16: Bubble Action Selection Indicators**
    *   *Selection:* **Option A (Floating Checkbox Hover)**
    *   *Rationale:* Displays a hover checkbox directly next to message bubbles, enabling fast item selection for sidepanel aggregation.
*   **Q17: Notion Sync Page Properties**
    *   *Selection:* **Option A (Platform and Link Only)**
    *   *Rationale:* Tags page metadata with model source and original URL, keeping database parameters clean.
*   **Q18: DeepSeek/Gemini "Thinking Content" Export Default**
    *   *Selection:* **Option A (Collapsed Toggle)**
    *   *Rationale:* Renders reasoning chains inside an expandable box, keeping documents readable.
*   **Q19: Offline License Check Method**
    *   *Selection:* **Option A (Cryptographically Signed Key)**
    *   *Rationale:* Uses cryptographic key validations offline, maintaining a serverless model.
*   **Q20: Handoff Prompt Template Options**
    *   *Selection:* **Option A (Context Handoff Header)**
    *   *Rationale:* Prepends a short explanation system header so target LLMs treat the incoming text as conversation history.

---

## 3. Batch 3: Advanced Exporters & Configurations (Q21 - Q30)

*   **Q21: Code Block Export Formatting**
    *   *Selection:* **Option B (Syntax Highlighted)**
    *   *Rationale:* Colors code variables by syntax language using Prism.js, improving readability.
*   **Q22: Styling Theme Presets Scope**
    *   *Selection:* **Option A (Static Curated Themes)**
    *   *Rationale:* Delivers 8 designed presets (Lavender, Sakura, etc.), avoiding contrast and layout errors.
*   **Q23: Manifest Target Host Permissions Scope**
    *   *Selection:* **Option A (Specific Target Domains)**
    *   *Rationale:* Declares permission scopes strictly for target LLM URLs and Notion hosts, speeding up CWS audits.
*   **Q24: Notion Page Sync Target Directory**
    *   *Selection:* **Option A (Single Central Database)**
    *   *Rationale:* Consolidates pages inside one central database where users can organize items using properties.
*   **Q25: Context Bridge Token Limit Action**
    *   *Selection:* **Option A (Smart Truncation)**
    *   *Rationale:* Prunes oldest messages if history exceeds prompt token limits, keeping the bridge active.
*   **Q26: Drag-and-Dock UI Orb Layout Toggle**
    *   *Selection:* **Option A (Hotkey Toggle)**
    *   *Rationale:* Toggles orb visual states instantly via `Alt+B` hotkey to clear the active window layout.
*   **Q27: Message Bubble Action Toolbar Placement**
    *   *Selection:* **Option A (Adjacent to Native Icons)**
    *   *Rationale:* Injects export buttons directly next to the native share icons, maintaining site UI patterns.
*   **Q28: PDF Page Header & Footer Details**
    *   *Selection:* **Option A (Title & Metadata)**
    *   *Rationale:* Prints chat titles in headers and dates, page counts, and links in footers.
*   **Q29: Local Database Backup Format**
    *   *Selection:* **Option A (JSON Format)**
    *   *Rationale:* Generates structured JSON files, ensuring simple imports and audit compatibility.
*   **Q30: Image Export (PNG) Width Presets**
    *   *Selection:* **Option A (Width Presets)**
    *   *Rationale:* Renders images at standard 800px/1200px sizes to keep layout text formatting clean.

---

## 4. Batch 4: Database Search, Layout & Localization (Q31 - Q40)

*   **Q31: Word Document (.docx) Style Match**
    *   *Selection:* **Option A (Minimal Layout)**
    *   *Rationale:* Generates standard word documents with clean headings and lists, allowing easy personal adjustments in MS Word.
*   **Q32: IndexedDB Conversation Search Match Type**
    *   *Selection:* **Option A (Keyword Search)**
    *   *Rationale:* Simple keyword substring matching resolves queries rapidly without inflating code dependencies.
*   **Q33: Scraper Image Inline Representation**
    *   *Selection:* **Option A (Markdown Image Link)**
    *   *Rationale:* Keeps external image URLs in Markdown text to prevent IndexedDB storage bloat.
*   **Q34: Notion Sync Tag Categories Matching**
    *   *Selection:* **Option A (Multi-Select Property)**
    *   *Rationale:* Maps category tags inside Notion Multi-Select columns for filtering.
*   **Q35: Handoff Preamble Customized Per Platform**
    *   *Selection:* **Option A (Global Handoff)**
    *   *Rationale:* Uses a single handoff header template to keep settings simple.
*   **Q36: Toast Notification Display Timeout**
    *   *Selection:* **Option A (Auto-Dismiss)**
    *   *Rationale:* Notification toasts fade away automatically after 4 seconds.
*   **Q37: Floating Orb Hover Menu Layout**
    *   *Selection:* **Option A (Grid Deck)**
    *   *Rationale:* Expands orb shortcuts inside a compact 2x3 grid.
*   **Q38: Multi-Language Translation Loader**
    *   *Selection:* **Option A (Chrome i18n APIs)**
    *   *Rationale:* Uses native extension locale folder loaders for fast localized translations.
*   **Q39: Options Page Split-View Scale Slider**
    *   *Selection:* **Option B (Drag Sliders)**
    *   *Rationale:* Slider controls for margin and font scales offer a premium customizing user experience.
*   **Q40: Local Cache Automatic Pruning Schedule**
    *   *Selection:* **Option A (Date-based limits)**
    *   *Rationale:* Automatically prunes chats older than 30 days.

---

## 5. Batch 5: Security, Performance & Code Packing (Q41 - Q50)

*   **Q41: Notion Authentication Token Encrypted Storage**
    *   *Selection:* **Option A (Chrome Local Secure Sync)**
    *   *Rationale:* Relies on standard browser storage sandboxing to keep keys secure.
*   **Q42: Math KaTeX Sandbox Execution Channel**
    *   *Selection:* **Option A (postMessage Broker)**
    *   *Rationale:* Passes formula rendering targets inside iframe postMessage structures to protect system safety.
*   **Q43: Context Bridge Auto-tab Focus Selection**
    *   *Selection:* **Option A (Switch Focus)**
    *   *Rationale:* Activates the target LLM tab immediately so the user can continue their work.
*   **Q44: PDF Image Quality Downscaling**
    *   *Selection:* **Option B (Compressive Downscale)**
    *   *Rationale:* Downscales embedded PDF images to 150 DPI to keep generated files lightweight.
*   **Q45: Message Scraper Thinking Log Colors**
    *   *Selection:* **Option A (Light Gray Container Block)**
    *   *Rationale:* Visually marks thinking sections to distinguish reasoning processes from final outputs.
*   **Q46: SidePanel Aggregator Checkmarks Clear Actions**
    *   *Selection:* **Option A (Auto-clear)**
    *   *Rationale:* Automatically clears the collection list queue after export completion.
*   **Q47: CSS Scope Isolation Strategy**
    *   *Selection:* **Option A (CSS Shadow DOM Encapsulation)**
    *   *Rationale:* Wraps extension components inside Shadow DOMs to prevent layout collisions.
*   **Q48: Notion Sync Rate Limit Graceful Retry**
    *   *Selection:* **Option A (Background Queue Delay)**
    *   *Rationale:* Automatically delays subsequent api calls if rate limits are hit.
*   **Q49: Local PDF Page Header Timestamp Formats**
    *   *Selection:* **Option A (Localized Date/Time)**
    *   *Rationale:* Formats timestamps using the user's localized browser region styles.
*   **Q50: Build Pipeline Source Maps**
    *   *Selection:* **Option A (Exclude Source Maps in Production)**
    *   *Rationale:* Strips source map files from the production package to minimize file sizes.
