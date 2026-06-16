/**
 * Content Script for Omniscribe AI
 * Orchestrates the floating glassmorphic orb, drag calculations,
 * scraping sweeps, and text injection pipelines.
 */

import { scrapeActiveChat, getCurrentPlatform, LLM_PLATFORMS } from './scraper.ts';
import { injectPrompt } from './injector.ts';

// SVG definitions for the LLM icons
const LLM_ICONS: Record<string, string> = {
  chatgpt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  claude: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  gemini: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  perplexity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  grok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
};

class OmniscribeContentScript {
  private currentPlatform: string | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private panelElement: HTMLElement | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panelStartX = 0;
  private panelStartY = 0;

  constructor() {
    this.currentPlatform = getCurrentPlatform(window.location.hostname);
  }

  public init() {
    if (!this.currentPlatform) return;
    
    console.log(`[Omniscribe] Injected on platform: ${this.currentPlatform}`);
    
    // Mount the floating orb UI
    this.mountOverlay();

    // Check for pending transfers routed to this platform
    this.checkForIncomingBridge();

    // Bind hotkeys (Alt + B)
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        this.togglePanelVisibility();
      }
    });

    // Handle URL change triggers for SPAs
    this.observeURLChanges();
  }

  /**
   * Encapsulates CSS stylesheets inside the Shadow DOM container.
   */
  private async getStylesheetContent(): Promise<string> {
    try {
      const response = await fetch(chrome.runtime.getURL('src/content-scripts/content.css'));
      return await response.text();
    } catch (error) {
      console.warn('[Omniscribe] Fetching stylesheet failed, using inline CSS fallback:', error);
      // CSS inline template fallback to prevent rendering lock
      return `
        .omniscribe-panel { position: fixed; z-index: 2147483647; top: 15%; right: 20px; width: 56px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 28px; display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 10px; transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); user-select: none; }
        .omniscribe-panel.expanded { width: 280px; border-radius: 16px; padding: 10px; }
        .omniscribe-drag-handle { width: 100%; height: 14px; display: flex; justify-content: center; gap: 4px; cursor: grab; opacity: 0.4; }
        .omniscribe-drag-dot { width: 4px; height: 4px; background-color: #f8fafc; border-radius: 50%; }
        .omniscribe-trigger-orb { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .omniscribe-trigger-orb svg { width: 20px; height: 20px; stroke: #ffffff; }
        .omniscribe-grid { display: none; flex-direction: column; width: 100%; gap: 6px; }
        .omniscribe-panel.expanded .omniscribe-grid { display: flex; }
        .omniscribe-action-row { width: 100%; border: none; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); color: #f1f5f9; border-radius: 8px; display: flex; align-items: center; padding: 8px 12px; gap: 10px; cursor: pointer; text-align: left; }
        .omniscribe-action-row:hover { background: rgba(255, 255, 255, 0.06); }
        .omniscribe-action-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .omniscribe-action-label { font-size: 12px; font-weight: 500; }
        .omniscribe-toast { position: fixed; bottom: 24px; left: 50%; transform: translate(-50%, 50px); z-index: 2147483647; padding: 10px 20px; border-radius: 8px; background: #0f172a; color: #f8fafc; font-size: 13px; font-weight: 500; border: 1px solid rgba(255, 255, 255, 0.08); opacity: 0; transition: transform 0.3s, opacity 0.2s; }
        .omniscribe-toast.visible { transform: translate(-50%, 0); opacity: 1; }
        .omniscribe-toast-success { border-left: 4px solid #10b981; }
        .omniscribe-toast-error { border-left: 4px solid #ef4444; }
        .omniscribe-toast-info { border-left: 4px solid #6366f1; }
      `;
    }
  }

  /**
   * Initializes overlay panels inside a clean Shadow DOM container.
   */
  private async mountOverlay() {
    const host = document.createElement('div');
    host.id = 'omniscribe-shadow-host';
    document.body.appendChild(host);

    this.shadowRoot = host.attachShadow({ mode: 'open' });
    
    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = await this.getStylesheetContent();
    this.shadowRoot.appendChild(styles);

    // Build main panel
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'omniscribe-panel';
    
    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'omniscribe-drag-handle';
    handle.innerHTML = `
      <span class="omniscribe-drag-dot"></span>
      <span class="omniscribe-drag-dot"></span>
      <span class="omniscribe-drag-dot"></span>
    `;
    this.panelElement.appendChild(handle);

    // Floating orb trigger button
    const orb = document.createElement('button');
    orb.className = 'omniscribe-trigger-orb';
    orb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    
    orb.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleExpand();
    });

    this.panelElement.appendChild(orb);

    // Action destinations grids
    const grid = document.createElement('div');
    grid.className = 'omniscribe-grid';

    for (const [key, cfg] of Object.entries(LLM_PLATFORMS)) {
      if (key === this.currentPlatform) continue;

      const row = document.createElement('button');
      row.className = 'omniscribe-action-row';
      row.innerHTML = `
        <span class="omniscribe-action-icon">${LLM_ICONS[key]}</span>
        <span class="omniscribe-action-label">Bridge to ${cfg.name}</span>
      `;
      row.addEventListener('click', () => this.handleBridgeContext(key));
      grid.appendChild(row);
    }

    this.panelElement.appendChild(grid);
    this.shadowRoot.appendChild(this.panelElement);

    // Register mouse drag handlers
    this.registerDragEvents(handle);
  }

  /**
   * Toggles panel visibility when Alt + B is keyed.
   */
  private togglePanelVisibility() {
    if (!this.panelElement) return;
    const isHidden = this.panelElement.style.display === 'none';
    this.panelElement.style.display = isHidden ? 'flex' : 'none';
    this.showToast(isHidden ? 'Omniscribe panel visible' : 'Omniscribe panel hidden', 'info');
  }

  /**
   * Handles panel expansion toggle on trigger clicks.
   */
  private toggleExpand() {
    if (!this.panelElement) return;
    this.panelElement.classList.toggle('expanded');
  }

  /**
   * Emulates custom drag handlers with edge magnetic lock calculations.
   */
  private registerDragEvents(handle: HTMLElement) {
    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.panelElement!.getBoundingClientRect();
      this.panelStartX = rect.left;
      this.panelStartY = rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.panelElement) return;

      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;

      // Update positions directly during moving sweeps
      this.panelElement.style.right = 'auto';
      this.panelElement.style.left = `${this.panelStartX + deltaX}px`;
      this.panelElement.style.top = `${this.panelStartY + deltaY}px`;
    };

    const onMouseUp = () => {
      if (!this.isDragging || !this.panelElement) return;
      this.isDragging = false;

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Snap the panel magnetically to the closest vertical screen border
      const screenWidth = window.innerWidth;
      const rect = this.panelElement.getBoundingClientRect();
      const currentX = rect.left + rect.width / 2;

      this.panelElement.style.left = 'auto';
      if (currentX < screenWidth / 2) {
        this.panelElement.style.right = 'auto';
        this.panelElement.style.left = '16px';
      } else {
        this.panelElement.style.left = 'auto';
        this.panelElement.style.right = '16px';
      }

      // Check height bounding constraints
      const screenHeight = window.innerHeight;
      if (rect.top < 10) {
        this.panelElement.style.top = '10px';
      } else if (rect.bottom > screenHeight - 10) {
        this.panelElement.style.top = `${screenHeight - rect.height - 10}px`;
      }
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  /**
   * Scrapes conversation thread data, stores records locally, and navigates.
   */
  private async handleBridgeContext(targetPlatform: string) {
    if (!this.currentPlatform) return;
    this.showToast('Extracting conversation history...', 'info');

    // Extract text turns
    const conversationText = scrapeActiveChat(this.currentPlatform);

    if (!conversationText || conversationText.trim().length < 5) {
      this.showToast('No active conversation history found to bridge.', 'error');
      return;
    }

    // Save the conversation locally before jumping
    const conversationId = `bridge-${Date.now()}`;
    const timestamp = Date.now();
    
    // Save to local IndexedDB via background routing message to avoid multi-thread locking
    await chrome.runtime.sendMessage({
      type: 'SAVE_LOCAL_CONVERSATION',
      payload: {
        conversation: {
          id: conversationId,
          title: `Bridged from ${LLM_PLATFORMS[this.currentPlatform].name}`,
          platform: this.currentPlatform,
          url: window.location.href,
          timestamp,
          tags: ['bridged']
        },
        messages: [
          {
            conversationId,
            role: 'system',
            content: `Conversation bridged to ${LLM_PLATFORMS[targetPlatform].name}`,
            timestamp
          }
        ]
      }
    });

    // Query configuration values from chrome local options storage
    chrome.storage.local.get(['settings'], (res) => {
      const settings = res.settings || { autoSubmit: true, preamble: 'Context from previous session: ' };
      
      const fullPrompt = `${settings.preamble}\n\n${conversationText}\n\n[End of Bridged Context]`;

      // Set bridge packet payload in browser local storage
      chrome.storage.local.set({
        omniscribe_pending_bridge: {
          targetPlatform,
          prompt: fullPrompt,
          timestamp: Date.now()
        }
      }, () => {
        this.showToast(`Handoff saved. Redirection routing to ${LLM_PLATFORMS[targetPlatform].name}...`, 'success');
        
        // Command background page worker to open destination tab
        chrome.runtime.sendMessage({
          type: 'OPEN_TAB',
          url: LLM_PLATFORMS[targetPlatform].matches[0].includes('perplexity') 
            ? 'https://www.perplexity.ai' 
            : `https://${LLM_PLATFORMS[targetPlatform].matches[0]}`
        });
      });
    });
  }

  /**
   * Consumes incoming bridging payloads on load triggers.
   */
  private async checkForIncomingBridge() {
    chrome.storage.local.get(['omniscribe_pending_bridge', 'settings'], async (result) => {
      const packet = result.omniscribe_pending_bridge;
      const settings = result.settings || { autoSubmit: true };

      if (!packet) return;

      // Validate packet lifecycle target and duration (30 seconds cutoff check)
      if (packet.targetPlatform !== this.currentPlatform) return;
      
      if (Date.now() - packet.timestamp > 30000) {
        console.warn('[Omniscribe] bridge packet expired.');
        chrome.storage.local.remove('omniscribe_pending_bridge');
        return;
      }

      // Consume context payload
      chrome.storage.local.remove('omniscribe_pending_bridge');
      
      this.showToast('Injecting bridged conversation context...', 'info');

      try {
        await new Promise(r => setTimeout(r, 1200)); // Delay to let SPAs load DOM inputs
        await injectPrompt(this.currentPlatform!, packet.prompt, settings.autoSubmit);
        this.showToast('Context bridge injection completed successfully!', 'success');
      } catch (error) {
        console.error('[Omniscribe] Injection run failure:', error);
        this.showToast('Injection timed out. Prompt written to clipboard.', 'error');
        await navigator.clipboard.writeText(packet.prompt).catch(() => {});
      }
    });
  }

  /**
   * Observe Single Page Application (SPA) client-side URL changes.
   */
  private observeURLChanges() {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => {
          this.checkForIncomingBridge();
        }, 1000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Injects beautiful glass toast notifications directly into the shadow container.
   */
  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    if (!this.shadowRoot) return;

    const oldToast = this.shadowRoot.getElementById('omniscribe-toast-element');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.id = 'omniscribe-toast-element';
    toast.className = `omniscribe-toast omniscribe-toast-${type}`;
    toast.textContent = message;

    this.shadowRoot.appendChild(toast);

    // Animate visibility entry
    setTimeout(() => toast.classList.add('visible'), 50);

    // Timeout exit transition
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Instantiate and run content logic
const runner = new OmniscribeContentScript();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runner.init());
} else {
  setTimeout(() => runner.init(), 600);
}
