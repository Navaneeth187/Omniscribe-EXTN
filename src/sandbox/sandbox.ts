import katex from 'katex';
import 'katex/dist/katex.min.css';

console.log('[RelayOne Sandbox] Math compiler loaded.');

/**
 * Listen for LaTeX compilation commands from parent contexts.
 */
window.addEventListener('message', (event) => {
  const data = event.data;
  
  if (!data || data.type !== 'COMPILE_LATEX') return;

  const { id, formula, displayMode } = data;

  try {
    const renderedHtml = katex.renderToString(formula, {
      throwOnError: false,
      displayMode: displayMode ?? false,
      output: 'htmlAndMathml'
    });

    // Send compilation success response
    event.source?.postMessage(
      {
        type: 'LATEX_COMPILED',
        id,
        html: renderedHtml,
        success: true
      },
      event.origin as any
    );
  } catch (error) {
    console.error('[RelayOne Sandbox] LaTeX rendering failed:', error);
    
    event.source?.postMessage(
      {
        type: 'LATEX_COMPILED',
        id,
        error: (error as Error).message,
        success: false
      },
      event.origin as any
    );
  }
});
