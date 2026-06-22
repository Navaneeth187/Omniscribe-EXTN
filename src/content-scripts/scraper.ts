/**
 * Scraper Module for RelayOne AI
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

export interface ScrapedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent?: string;
  timestamp: number;
}

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
export function extractChatGPT(): ScrapedMessage[] {
  const turns: ScrapedMessage[] = [];
  const nodes = document.querySelectorAll('[data-message-author-role]');
  
  nodes.forEach((node, index) => {
    const rawRole = node.getAttribute('data-message-author-role');
    const role = rawRole === 'user' ? 'user' : 'assistant';
    const text = (node as HTMLElement).innerText.trim();
    if (text) {
      // Look for thinking traces
      const thinkingEl = node.querySelector('.thought, [class*="thought"], [class*="thinking"]');
      let content = text;
      let thinkingContent: string | undefined = undefined;
      
      if (thinkingEl) {
        thinkingContent = (thinkingEl as HTMLElement).innerText.trim();
        content = text.replace(thinkingContent, '').trim();
      }

      turns.push({
        role,
        content,
        thinkingContent,
        timestamp: Date.now() - (nodes.length - index) * 1000
      });
    }
  });

  return turns;
}

/**
 * Extracts conversation logs from Claude.
 */
export function extractClaude(): ScrapedMessage[] {
  const turns: ScrapedMessage[] = [];
  // Select user messages and assistant messages by their data test ids or common CSS class configurations
  const allMsgContainers = document.querySelectorAll(
    '[data-testid="user-message"], [data-testid="assistant-message"], .font-claude-message, .font-claude-response, .assistant-message, [class*="HumanTurn"], [class*="AIResponse"], [class*="HumanMessage"], [class*="AssistantMessage"]'
  );

  const elements = Array.from(allMsgContainers) as HTMLElement[];
  // Filter to parent-most containers to avoid duplicate text extraction
  const containers = elements.filter(el => !elements.some(other => other !== el && other.contains(el)));

  if (containers.length > 0) {
    containers.forEach((node, index) => {
      const el = node as HTMLElement;
      const testId = el.getAttribute('data-testid');
      const className = el.className || '';
      
      const isUser =
        el.closest('[data-testid="user-message"]') !== null ||
        testId === 'user-message' ||
        className.includes('HumanTurn') ||
        className.includes('HumanMessage') ||
        className.includes('user-message') ||
        el.closest('[class*="HumanTurn"]') !== null ||
        el.closest('[class*="HumanMessage"]') !== null ||
        el.closest('.font-user-message') !== null;

      const role = isUser ? 'user' : 'assistant';
      const text = el.innerText.trim();
      if (text) {
        turns.push({
          role,
          content: text,
          timestamp: Date.now() - (containers.length - index) * 1000
        });
      }
    });
  } else {
    // Fallback if Claude changes DOM wrapper layouts
    const mainFeed = document.querySelector('main, [class*="conversation"]');
    if (mainFeed) {
      const text = (mainFeed as HTMLElement).innerText.trim();
      if (text.length > 20) {
        turns.push({
          role: 'assistant',
          content: text,
          timestamp: Date.now()
        });
      }
    }
  }

  return turns;
}

/**
 * Extracts conversation logs from Gemini.
 */
export function extractGemini(): ScrapedMessage[] {
  const turns: ScrapedMessage[] = [];
  
  // Gemini uses tags for queries and responses
  const allTurns = document.querySelectorAll(
    'user-query, model-response, [class*="conversation-turn"], message-content, [class*="message-content"]'
  );

  if (allTurns.length > 0) {
    allTurns.forEach((node, index) => {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const cls = el.className || '';
      
      const isUser = tag === 'user-query' || cls.includes('user') || cls.includes('query');
      const role = isUser ? 'user' : 'assistant';
      const text = el.innerText.trim();
      if (text) {
        turns.push({
          role,
          content: text,
          timestamp: Date.now() - (allTurns.length - index) * 1000
        });
      }
    });
  } else {
    // Fallback: zip query inputs and responses together
    const userNodes = document.querySelectorAll('.user-query-text, [class*="user-query"]');
    const modelNodes = document.querySelectorAll('.model-response-text, [class*="model-response"], .response-content');
    const maxLen = Math.max(userNodes.length, modelNodes.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (userNodes[i]) {
        turns.push({
          role: 'user',
          content: (userNodes[i] as HTMLElement).innerText.trim(),
          timestamp: Date.now() - (maxLen * 2 - i * 2) * 1000
        });
      }
      if (modelNodes[i]) {
        turns.push({
          role: 'assistant',
          content: (modelNodes[i] as HTMLElement).innerText.trim(),
          timestamp: Date.now() - (maxLen * 2 - i * 2 - 1) * 1000
        });
      }
    }
  }

  return turns;
}

/**
 * Extracts conversation logs from Perplexity.
 */
export function extractPerplexity(): ScrapedMessage[] {
  const turns: ScrapedMessage[] = [];
  
  // Perplexity uses sections and prose blocks
  const blocks = document.querySelectorAll('[class*="col-span"], [class*="MessageBlock"], section');
  
  if (blocks.length > 0) {
    blocks.forEach((block, index) => {
      const el = block as HTMLElement;
      const text = el.innerText.trim();
      if (text.length > 20) {
        // Find if this section contains user inputs or assistant solutions
        const isUser = el.querySelector('h1, h2, [class*="question"]') !== null;
        const role = isUser ? 'user' : 'assistant';
        turns.push({
          role,
          content: text,
          timestamp: Date.now() - (blocks.length - index) * 1000
        });
      }
    });
  } else {
    // Fallback: search for headings vs paragraph elements
    const questions = document.querySelectorAll('[class*="query"], [class*="question"], .prose h2, [data-testid*="query"]');
    const answers = document.querySelectorAll('[class*="answer"], [class*="prose"]:not(h2), .prose p, [data-testid*="answer"]');
    const maxLen = Math.max(questions.length, answers.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (questions[i]) {
        turns.push({
          role: 'user',
          content: (questions[i] as HTMLElement).innerText.trim(),
          timestamp: Date.now() - (maxLen * 2 - i * 2) * 1000
        });
      }
      if (answers[i]) {
        turns.push({
          role: 'assistant',
          content: (answers[i] as HTMLElement).innerText.trim(),
          timestamp: Date.now() - (maxLen * 2 - i * 2 - 1) * 1000
        });
      }
    }
  }

  return turns;
}

/**
 * Extracts conversation logs from Grok.
 */
export function extractGrok(): ScrapedMessage[] {
  const turns: ScrapedMessage[] = [];
  
  // Check for data author roles or query blocks
  const userMsgs = document.querySelectorAll(
    '[data-message-author-role="user"], [class*="UserMessage"], [class*="userMessage"], [class*="human-message"]'
  );
  const asstMsgs = document.querySelectorAll(
    '[data-message-author-role="assistant"], [class*="AssistantMessage"], [class*="assistantMessage"], [class*="bot-message"], [class*="GrokMessage"]'
  );

  if (userMsgs.length > 0 || asstMsgs.length > 0) {
    const list: { el: HTMLElement; role: 'user' | 'assistant' }[] = [];
    userMsgs.forEach(n => list.push({ el: n as HTMLElement, role: 'user' }));
    asstMsgs.forEach(n => list.push({ el: n as HTMLElement, role: 'assistant' }));
    
    // Sort array elements chronologically by document position hierarchy
    list.sort((a, b) => {
      const position = a.el.compareDocumentPosition(b.el);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      return 1;
    });

    list.forEach(({ el, role }, index) => {
      const text = el.innerText.trim();
      if (text.length > 2) {
        turns.push({
          role,
          content: text,
          timestamp: Date.now() - (list.length - index) * 1000
        });
      }
    });
  } else {
    // Alternate parsing of follow-up logs
    const rows = document.querySelectorAll(
      '[class*="FollowupQuery"], [class*="followup"], [class*="QueryBlock"], [class*="ResponseBlock"], article, [role="article"]'
    );
    rows.forEach((row, index) => {
      const el = row as HTMLElement;
      const cls = (el.className || '').toLowerCase();
      const text = el.innerText.trim();
      if (text.length < 3) return;
      const isUser = cls.includes('query') || cls.includes('followup') || cls.includes('user') || cls.includes('human');
      const role = isUser ? 'user' : 'assistant';
      turns.push({
        role,
        content: text,
        timestamp: Date.now() - (rows.length - index) * 1000
      });
    });
  }

  return turns;
}

/**
 * General scrape dispatcher.
 */
export function scrapeActiveChat(platform: string): ScrapedMessage[] {
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
      return [];
  }
}
