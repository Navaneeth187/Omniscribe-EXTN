/**
 * Sandbox Client Manager for RelayOne AI
 * Initiates the hidden sandbox iframe and routes mathematical
 * formulas to KaTeX for execution, returning compiled HTML tags.
 */

let sandboxIframe: HTMLIFrameElement | null = null;
const pendingRequests = new Map<string, { resolve: (html: string) => void; reject: (err: Error) => void }>();

/**
 * Initializes the compiler iframe and adds it to the background DOM.
 */
function initSandboxIframe(): HTMLIFrameElement {
  if (sandboxIframe) return sandboxIframe;

  sandboxIframe = document.createElement('iframe');
  sandboxIframe.id = 'relayone-math-sandbox';
  sandboxIframe.src = chrome.runtime.getURL('src/sandbox/index.html');
  sandboxIframe.style.display = 'none';

  document.body.appendChild(sandboxIframe);

  // Bind message return channel listeners
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'LATEX_COMPILED') return;

    const { id, html, success, error } = data;
    const request = pendingRequests.get(id);
    
    if (request) {
      pendingRequests.delete(id);
      if (success) {
        request.resolve(html);
      } else {
        request.reject(new Error(error || 'Latex compile error'));
      }
    }
  });

  return sandboxIframe;
}

/**
 * Sends a LaTeX equation to the sandboxed parser and resolves with compiled HTML code.
 */
export async function compileLaTeX(formula: string, displayMode: boolean = false): Promise<string> {
  const iframe = initSandboxIframe();
  const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Wait briefly for the iframe connection to open if it was just mounted
  if (iframe.contentWindow === null) {
    await new Promise(r => setTimeout(r, 200));
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    
    iframe.contentWindow?.postMessage(
      {
        type: 'COMPILE_LATEX',
        id,
        formula,
        displayMode
      },
      '*'
    );
  });
}
