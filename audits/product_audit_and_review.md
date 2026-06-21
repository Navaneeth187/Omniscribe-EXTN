# Product Audit & Review: Omniscribe AI
**Consolidated Product Analysis from 5 Key Perspectives**  
**Perspectives:** Product Manager, UX Expert, Startup Founder, Senior Engineer, Investor  
**Date:** June 21, 2026

---

## 1. Product Summary

### Simple Language Explanation
Omniscribe AI is a smart browser assistant that acts as a bridge and a vault for your AI chats. 
*   **The Bridge:** If you are talking to Claude in one tab and want to continue the conversation in ChatGPT, you click a single button. Omniscribe automatically copies your conversation history, opens ChatGPT in a new tab, and pastes your chat history directly into ChatGPT so you can continue typing immediately without repeating yourself.
*   **The Vault:** It automatically saves your conversations on your own computer. You can browse them, tweak their visual styles (fonts, spacing, themes), and export them as beautiful print-ready PDFs or markdown files with a single click. It is private, fast, and works completely offline.

---

## 2. End-to-End User Journey

```text
[Step 1: Active Research Session]
User is actively chatting with Claude about a complex TypeScript architecture problem.
  │
  ▼
[Step 2: Trigger Handoff]
User decides Claude's reasoning is stuck. They hover over the glassmorphic Orb overlay 
and click the "ChatGPT" icon.
  │
  ▼
[Step 3: Background Transition]
Omniscribe scrapes the active Claude chat logs, appends a handoff preamble, stores it 
temporingly in local memory, and opens ChatGPT in a new tab.
  │
  ▼
[Step 4: Auto-Injection & Output]
Omniscribe waits for the ChatGPT editor DOM to hydrate, pastes the context payload, and 
auto-submits the prompt. ChatGPT continues the thread seamlessly.
  │
  ▼
[Step 5: Document Creation]
User wants to save the completed code guide. They click the turn-level "Export" button.
  │
  ▼
[Step 6: Real-time Preview & Export]
The Options Page opens in a split-screen layout. User selects the "Lavender" theme, 
adjusts page margins, and clicks "Download PDF". The document downloads locally.
```

---

## 3. Comprehensive Feature Review

| Feature Name | Core Purpose | User Benefit | Technical Complexity | Development Cost | Business Impact | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Glassmorphic Orb Handoff Panel** | Overlay widgets with target LLM launch buttons. | Quick access; zero navigation friction. | Low-Medium (Draggable DOM constraints). | Low | High (Core user engagement driver). | **Must Have** |
| **Hydration & Auto-Injection Worker** | Detects target tab completion and simulates keystroke writes. | Seamless handoffs; saves manual copy-pasting. | High (Handling diverse editor frame SPAs). | Medium | High (Key value differentiator). | **Must Have** |
| **Multi-Format Export Engine** | Client-side compiles code blocks/LaTeX to PDF/MD/Docx/JSON. | Print-ready, professionally styled documents. | High (Canvas & PDF alignment math). | High | High (Pro tier converter). | **Must Have** |
| **Split-Pane Preview Page** | Visual theme customizer for final document styling. | Users can customize the aesthetics of their records. | Medium | Medium | Medium (Core visual appeal). | **Must Have** |
| **IndexedDB Local History Cache** | Dexie-based local archiving of scraped chats. | Privacy-first local backup; fully searchable offline history. | Medium (Database migrations). | Low | Medium-High (Retention driver). | **Should Have** |
| **Side Panel Collector Queue** | List queue to combine different chat threads. | Custom aggregate document creation across sessions. | Medium (Chrome sidePanel API). | Medium | Medium | **Should Have** |
| **Custom Preamble Inputs** | Custom system inputs prepended to handoff context. | Lets prompt engineers structure their handoffs. | Low | Low | Low-Medium | **Nice to Have** |
| **Remote VIP Check Telemetry** | Verifies paid statuses against external auth servers. | Enforces quotas. | Low | Low | **Negative** (Breaks local-first privacy stance). | **Remove** |

---

## 4. Feature Gap & Vulnerability Analysis

### 4.1. Missing Features (Gaps)
*   **Media/Attachment Support:** Currently, the scrapers only query text and code blocks. User uploaded images or attachments are ignored, which can break thread continuity.
*   **Self-Healing Selector Updates:** If target sites update their DOM layouts, the scraper breaks. The extension should pull updated selector JSON files silently in the background, bypassing the need for a full Chrome Web Store update.

### 4.2. Technical Risks & Vulnerabilities
*   **Editor Hydration Failures:** Slow networks or unauthenticated target sessions will prevent the input selector from finding the textbox, causing the injection to fail.
    *   *Mitigation:* Graceful failover to toast notifications instructing the user to paste (`Ctrl+V`) from the clipboard.

---

## 5. Competitor Analysis

| Dimension | Poe / TypingMind | Standard Exporter Extensions | Omniscribe AI (Consolidated) |
| :--- | :--- | :--- | :--- |
| **Cost Model** | Requires expensive API keys or subscriptions. | Free, but heavily ad-supported or broken. | **Freemium ($5/mo for Pro styles).** |
| **Context Bridge** | None (siloed inside the wrapper client). | None. | **Automated tab-to-tab handoffs (P0).** |
| **Aesthetics** | Standard dashboard layouts. | Ugly unformatted raw layouts. | **Glassmorphism preview themes (Lavender, Sakura).** |
| **Data Security** | Data passes through proxy API endpoints. | Standard scraper vulnerabilities. | **Strictly local-first (IndexedDB).** |
| **LaTeX Rendering** | Basic. | Often breaks in PDF exports. | **Robust KaTeX parsing via sandbox frame.** |

---

## 6. Monetization & Pricing Models

*   **Free Plan ($0):**
    *   Core utility: Draggable orb handoff panel.
    *   Unlimited tab context bridging.
    *   Local IndexedDB conversation vault.
    *   Basic exports (Unstyled Markdown, raw Text, raw JSON).
*   **Pro Plan ($5/month or $35/year):**
    *   Unlimited premium styled PDF, Docx, and JSON exports.
    *   Access to all styling presets (Lavender, Sakura, Old Paper) + font scaling.
    *   Customizable handoff preamble inputs.
*   **Enterprise Tier ($15/user/month):**
    *   Auto-redaction rules (PII, tokens, credit cards scrubbed locally).

---

## 7. Product Risks

*   **Risk 1: Target DOM Alterations (High Probability):** AI platforms change their DOM nodes weekly. Constant breaks in scraper selectors will drive user frustration.
*   **Risk 2: Subscription Check Overhead (Medium Probability):** Since the tool is local-first, validating Pro licensing offline requires cryptographic license keys (similar to VS Code extensions) to avoid building heavy client-auth backend servers.
*   **Risk 3: Client Memory Leakage (Low Probability):** Loading extremely long chat threads with code blocks into jsPDF inside Chrome extension sandbox runtimes can trigger browser tab crashes.

---

## 8. Strategic Recommendations

1.  **Deploy a "Self-Healing Selector Config":** Instead of hardcoding selectors inside the content scripts, save them as a local config schema. Implement a background check that queries a secure repository for selector updates once every 24 hours.
2.  **Strict Local-First License:** Use cryptographically signed local keys (e.g., gumroad/lemonsqueezy validation) that store signed verification tokens in local storage, maintaining a 100% serverless extension profile.

---

## 9. Detailed Review Questions for User Feedback

Before initiating code generation, please answer the following questions to help refine the implementation details:

1.  **Scraper Selector Updates:** Do you want to implement the **Self-Healing Selector** feature (periodically pulling selector updates from a GitHub repo) in V1, or should we stick to static config maps for the initial release?
2.  **Handoff Execution Mode:** When bridging tabs, should the extension **auto-submit** the prompt (click the enter button automatically), or simply **prefill the textbox** and let the user manually click submit?
3.  **UI Customization:** Do you want the styling options (font scale, display width, padding size) to be customizable on a *per-conversation* basis inside the preview page, or should they save as *global styles* across all exports?
4.  **Telemetry and Error logs:** Should we store diagnostic selector error logs inside the local IndexedDB database so users can copy/paste their errors to help debug selector issues?
