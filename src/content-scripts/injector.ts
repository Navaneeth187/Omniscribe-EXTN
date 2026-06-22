/**
 * Injector Module for RelayOne AI
 * Emulates user typing actions and automates form submissions
 * across ChatGPT, Claude, Gemini, Perplexity, and Grok editors.
 */

/**
 * Updates input element values by emulating direct keyboard changes
 * to trigger internal framework bindings (React, Angular, Vue, etc.).
 */
export async function setInputValue(el: HTMLElement, text: string): Promise<void> {
  el.focus();
  
  // ContentEditable editors (ProseMirror, Slate, Quill)
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    el.innerHTML = '';
    // Use standard document execCommand to trigger editor state models
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // Standard textareas
    const textarea = el as HTMLTextAreaElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }

    // Dispatch events to trigger change observers
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Polls the DOM until the target editor textbox element appears.
 */
export async function waitForElement(selector: string, timeoutMs: number = 8000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing as HTMLElement);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el as HTMLElement);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[Injector] Element timeout: ${selector}`));
    }, timeoutMs);
  });
}

/**
 * Locates and clicks the platform send button.
 * Triggers fallback Enter key downs if buttons are disabled or missing.
 */
export async function clickSubmit(selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    const btn = document.querySelector(sel) as HTMLButtonElement;
    if (btn && !btn.disabled) {
      console.log(`[Injector] Clicking send button: ${sel}`);
      btn.click();
      return true;
    }
  }

  // Fallback: Dispatch Enter keyboard stroke
  console.log('[Injector] Send button fallback: Emulating keyboard Enter event...');
  const activeEl = document.activeElement;
  if (activeEl) {
    activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }
  
  return false;
}

/**
 * Platform Injectors
 */

export async function injectChatGPT(fullPrompt: string, autoSubmit: boolean): Promise<void> {
  const input = await waitForElement('#prompt-textarea, [data-testid="prompt-textarea"]');
  await setInputValue(input, fullPrompt);
  
  if (autoSubmit) {
    await new Promise(r => setTimeout(r, 600));
    await clickSubmit([
      '[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]'
    ]);
  }
}

export async function injectClaude(fullPrompt: string, autoSubmit: boolean): Promise<void> {
  const input = await waitForElement('.ProseMirror, [contenteditable="true"], div[role="textbox"], #chat-input');
  await setInputValue(input, fullPrompt);

  if (autoSubmit) {
    await new Promise(r => setTimeout(r, 600));
    await clickSubmit([
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      '[data-testid="send-button"]',
      'button[type="submit"]'
    ]);
  }
}

export async function injectGemini(fullPrompt: string, autoSubmit: boolean): Promise<void> {
  // Gemini's editor uses Quill rich text widgets. Modifying DOM content properties
  // directly will break internal framework states.
  // Best method: Write to system clipboard and paste, or fallback to insertText.
  await navigator.clipboard.writeText(fullPrompt).catch(() => {});

  const input = await waitForElement(
    'rich-textarea p[contenteditable], rich-textarea .ql-editor, div.ql-editor[contenteditable="true"]'
  );

  input.focus();
  await new Promise(r => setTimeout(r, 450));

  // Clear placeholders and paste clipboard payload
  document.execCommand('selectAll');
  await new Promise(r => setTimeout(r, 150));
  document.execCommand('paste');
  await new Promise(r => setTimeout(r, 600));

  // Fallback check: Verify if paste succeeded
  const innerText = input.innerText || '';
  if (innerText.trim().length < 10) {
    console.log('[Injector] Clipboard paste check failed. Running script text insert...');
    input.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, fullPrompt);
    await new Promise(r => setTimeout(r, 300));
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));

  if (autoSubmit) {
    await new Promise(r => setTimeout(r, 600));
    await clickSubmit([
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button[mattooltip="Send message"]',
      'button.send-button'
    ]);
  }
}

export async function injectPerplexity(fullPrompt: string, autoSubmit: boolean): Promise<void> {
  const input = await waitForElement('textarea[placeholder*="Ask"], textarea[aria-label*="search"], textarea');
  await setInputValue(input, fullPrompt);

  if (autoSubmit) {
    await new Promise(r => setTimeout(r, 600));
    await clickSubmit([
      'button[aria-label="Submit"]',
      'button[type="submit"]',
      'button.submit',
      '[data-testid="submit-button"]'
    ]);
  }
}

export async function injectGrok(fullPrompt: string, autoSubmit: boolean): Promise<void> {
  const input = await waitForElement('textarea, [contenteditable="true"], [role="textbox"]');
  await setInputValue(input, fullPrompt);

  if (autoSubmit) {
    await new Promise(r => setTimeout(r, 600));
    await clickSubmit([
      'button[aria-label*="send"]',
      'button[type="submit"]',
      'button.send'
    ]);
  }
}

/**
 * Main injection orchestrator.
 */
export async function injectPrompt(platform: string, fullPrompt: string, autoSubmit: boolean): Promise<void> {
  console.log(`[Injector] Injecting prompt for platform: ${platform} (AutoSubmit: ${autoSubmit})`);
  switch (platform) {
    case 'chatgpt':
      await injectChatGPT(fullPrompt, autoSubmit);
      break;
    case 'claude':
      await injectClaude(fullPrompt, autoSubmit);
      break;
    case 'gemini':
      await injectGemini(fullPrompt, autoSubmit);
      break;
    case 'perplexity':
      await injectPerplexity(fullPrompt, autoSubmit);
      break;
    case 'grok':
      await injectGrok(fullPrompt, autoSubmit);
      break;
    default:
      throw new Error(`[Injector] Unsupported target platform: ${platform}`);
  }
}
