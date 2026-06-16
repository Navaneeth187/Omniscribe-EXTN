/**
 * Scraper Module for Omniscribe AI
 * Contains DOM query selectors and clean-up routines to extract conversation streams
 * from the five supported AI platforms: ChatGPT, Claude, Gemini, Perplexity, and Grok.
 */

export interface ScraperConfig {
  name: string;
  matches: string[];
}

export const LLM_PLATFORMS: Record<string, ScraperConfig> = {
  chatgpt: {
    name: 'ChatGPT',
    matches: ['chat.openai.com', 'chatgpt.com']
  },
  claude: {
    name: 'Claude',
    matches: ['claude.ai']
  },
  gemini: {
    name: 'Gemini',
    matches: ['gemini.google.com']
  },
  perplexity: {
    name: 'Perplexity',
    matches: ['perplexity.ai']
  },
  grok: {
    name: 'Grok',
    matches: ['grok.com']
  }
};

/**
 * Identifies the current active platform based on hostname.
 */
export function getCurrentPlatform(hostname: string): string | null {
  for (const [key, cfg] of Object.entries(LLM_PLATFORMS)) {
    if (cfg.matches.some(m => hostname.includes(m))) {
      return key;
    }
  }
  return null;
}

/**
 * Extracts conversation logs from ChatGPT.
 */
export function extractChatGPT(): string {
  const turns: string[] = [];
  const nodes = document.querySelectorAll('[data-message-author-role]');
  
  nodes.forEach(node => {
    const role = node.getAttribute('data-message-author-role');
    const label = role === 'user' ? 'User' : 'Assistant (ChatGPT)';
    const text = (node as HTMLElement).innerText.trim();
    if (text) {
      turns.push(`${label}:\n${text}`);
    }
  });

  return turns.join('\n\n---\n\n');
}

/**
 * Extracts conversation logs from Claude.
 */
export function extractClaude(): string {
  const turns: string[] = [];
  
  // Select user messages and assistant messages by their data test ids or common CSS class configurations
  const allMsgContainers = document.querySelectorAll(
    '[data-testid="user-message"], [data-testid="assistant-message"], .font-claude-message, [class*="HumanTurn"], [class*="AIResponse"]'
  );

  if (allMsgContainers.length > 0) {
    allMsgContainers.forEach(node => {
      const el = node as HTMLElement;
      const testId = el.getAttribute('data-testid');
      const className = el.className || '';
      
      const isUser =
        el.closest('[data-testid="user-message"]') !== null ||
        testId === 'user-message' ||
        className.includes('HumanTurn') ||
        el.closest('[class*="HumanTurn"]') !== null;

      const label = isUser ? 'User' : 'Assistant (Claude)';
      const text = el.innerText.trim();
      if (text) {
        turns.push(`${label}:\n${text}`);
      }
    });
  } else {
    // Fallback if Claude changes DOM wrapper layouts
    const mainFeed = document.querySelector('main, [class*="conversation"]');
    if (mainFeed) {
      const text = (mainFeed as HTMLElement).innerText.trim();
      if (text.length > 20) {
        return `Conversation:\n${text}`;
      }
    }
  }

  return turns.join('\n\n---\n\n');
}

/**
 * Extracts conversation logs from Gemini.
 */
export function extractGemini(): string {
  const turns: string[] = [];
  
  // Gemini uses tags for queries and responses
  const allTurns = document.querySelectorAll(
    'user-query, model-response, [class*="conversation-turn"], message-content, [class*="message-content"]'
  );

  if (allTurns.length > 0) {
    allTurns.forEach(node => {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const cls = el.className || '';
      
      const isUser = tag === 'user-query' || cls.includes('user') || cls.includes('query');
      const label = isUser ? 'User' : 'Assistant (Gemini)';
      const text = el.innerText.trim();
      if (text) {
        turns.push(`${label}:\n${text}`);
      }
    });
  } else {
    // Fallback: zip query inputs and responses together
    const userNodes = document.querySelectorAll('.user-query-text, [class*="user-query"]');
    const modelNodes = document.querySelectorAll('.model-response-text, [class*="model-response"], .response-content');
    const maxLen = Math.max(userNodes.length, modelNodes.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (userNodes[i]) {
        turns.push(`User:\n${(userNodes[i] as HTMLElement).innerText.trim()}`);
      }
      if (modelNodes[i]) {
        turns.push(`Assistant (Gemini):\n${(modelNodes[i] as HTMLElement).innerText.trim()}`);
      }
    }
  }

  return turns.join('\n\n---\n\n');
}

/**
 * Extracts conversation logs from Perplexity.
 */
export function extractPerplexity(): string {
  const turns: string[] = [];
  
  // Perplexity uses sections and prose blocks
  const blocks = document.querySelectorAll('[class*="col-span"], [class*="MessageBlock"], section');
  
  if (blocks.length > 0) {
    blocks.forEach(block => {
      const el = block as HTMLElement;
      const text = el.innerText.trim();
      if (text.length > 20) {
        // Find if this section contains user inputs or assistant solutions
        const isUser = el.querySelector('h1, h2, [class*="question"]') !== null;
        const label = isUser ? 'User' : 'Assistant (Perplexity)';
        turns.push(`${label}:\n${text}`);
      }
    });
  } else {
    // Fallback: search for headings vs paragraph elements
    const questions = document.querySelectorAll('[class*="query"], [class*="question"], .prose h2, [data-testid*="query"]');
    const answers = document.querySelectorAll('[class*="answer"], [class*="prose"]:not(h2), .prose p, [data-testid*="answer"]');
    const maxLen = Math.max(questions.length, answers.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (questions[i]) {
        turns.push(`User:\n${(questions[i] as HTMLElement).innerText.trim()}`);
      }
      if (answers[i]) {
        turns.push(`Assistant (Perplexity):\n${(answers[i] as HTMLElement).innerText.trim()}`);
      }
    }
  }

  return turns.join('\n\n---\n\n');
}

/**
 * Extracts conversation logs from Grok.
 */
export function extractGrok(): string {
  const turns: string[] = [];
  
  // Check for data author roles or query blocks
  const userMsgs = document.querySelectorAll(
    '[data-message-author-role="user"], [class*="UserMessage"], [class*="userMessage"], [class*="human-message"]'
  );
  const asstMsgs = document.querySelectorAll(
    '[data-message-author-role="assistant"], [class*="AssistantMessage"], [class*="assistantMessage"], [class*="bot-message"], [class*="GrokMessage"]'
  );

  if (userMsgs.length > 0 || asstMsgs.length > 0) {
    const list: { el: HTMLElement; role: string }[] = [];
    userMsgs.forEach(n => list.push({ el: n as HTMLElement, role: 'User' }));
    asstMsgs.forEach(n => list.push({ el: n as HTMLElement, role: 'Assistant (Grok)' }));
    
    // Sort array elements chronologically by document position hierarchy
    list.sort((a, b) => {
      const position = a.el.compareDocumentPosition(b.el);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      return 1;
    });

    list.forEach(({ el, role }) => {
      const text = el.innerText.trim();
      if (text.length > 2) {
        turns.push(`${role}:\n${text}`);
      }
    });
  } else {
    // Alternate parsing of follow-up logs
    const rows = document.querySelectorAll(
      '[class*="FollowupQuery"], [class*="followup"], [class*="QueryBlock"], [class*="ResponseBlock"], article, [role="article"]'
    );
    rows.forEach(row => {
      const el = row as HTMLElement;
      const cls = (el.className || '').toLowerCase();
      const text = el.innerText.trim();
      if (text.length < 3) return;
      const isUser = cls.includes('query') || cls.includes('followup') || cls.includes('user') || cls.includes('human');
      turns.push(`${isUser ? 'User' : 'Assistant (Grok)'}:\n${text}`);
    });
  }

  return turns.join('\n\n---\n\n');
}

/**
 * General scrape dispatcher.
 */
export function scrapeActiveChat(platform: string): string {
  console.log(`[Scraper] Initiating scrape for: ${platform}`);
  switch (platform) {
    case 'chatgpt':
      return extractChatGPT();
    case 'claude':
      return extractClaude();
    case 'gemini':
      return extractGemini();
    case 'perplexity':
      return extractPerplexity();
    case 'grok':
      return extractGrok();
    default:
      console.warn(`[Scraper] Unknown platform request: ${platform}`);
      return '';
  }
}
