import { db } from '../database/local_db.ts';

// Log background worker activation
console.log('[RelayOne Background] Service Worker started.');

// Handle extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[RelayOne Background] Installed for the first time.');
    // Initialize default preferences in chrome storage
    chrome.storage.local.set({
      settings: {
        autoSubmit: true,
        retentionDays: 30,
        preamble: 'The following is context from my previous session: '
      }
    }, () => {
      console.log('[RelayOne Background] Default storage parameters initialized.');
    });
  } else if (details.reason === 'update') {
    console.log('[RelayOne Background] Updated to a new version.');
  }

  // Configure side panel behavior if supported
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((e) => console.error('[Background] Failed to set sidepanel behavior:', e));
  }

  // Trigger initial IndexedDB database pruning
  runDatabasePruner();
});

/**
 * Triggers cleanups of conversation logs that exceed the retention policy (e.g., 30 days).
 */
async function runDatabasePruner(): Promise<void> {
  try {
    chrome.storage.local.get(['settings'], async (result) => {
      const retentionDays = result.settings?.retentionDays ?? 30;
      const prunedCount = await db.pruneOldConversations(retentionDays);
      console.log(`[RelayOne Background] Pruner deleted ${prunedCount} stale conversations.`);
    });
  } catch (error) {
    console.error('[RelayOne Background] Pruner run failed:', error);
  }
}

// Register communication message routes
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[RelayOne Background] Received message:', message);

  if (message.type === 'GET_DATABASE_STATS') {
    (async () => {
      try {
        const conversationCount = await db.conversations.count();
        const messageCount = await db.messages.count();
        sendResponse({ success: true, conversationCount, messageCount });
      } catch (error) {
        console.error('[RelayOne Background] Failed to fetch database stats:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true; // Keep message channel open for asynchronous reply
  }

  if (message.type === 'ADD_DUMMY_CHAT') {
    (async () => {
      try {
        const dummyId = `dummy-${Date.now()}`;
        
        await db.saveConversation({
          id: dummyId,
          title: 'Hello RelayOne!',
          platform: 'chatgpt',
          url: 'https://chatgpt.com/c/dummy',
          timestamp: Date.now(),
          tags: ['test', 'dummy']
        });

        await db.saveMessages([
          {
            conversationId: dummyId,
            role: 'user',
            content: 'This is a test prompt from the user.',
            timestamp: Date.now() - 1000
          },
          {
            conversationId: dummyId,
            role: 'assistant',
            content: 'This is a test answer response from the assistant.',
            timestamp: Date.now()
          }
        ]);

        sendResponse({ success: true, conversationId: dummyId });
      } catch (error) {
        console.error('[RelayOne Background] Failed to add dummy chat:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'SAVE_LOCAL_CONVERSATION') {
    (async () => {
      try {
        const { conversation, messages } = message.payload;
        await db.saveConversation(conversation);
        await db.saveMessages(messages);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[RelayOne Background] SAVE_LOCAL_CONVERSATION transaction failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: message.url, active: true });
    sendResponse({ success: true });
    return false;
  }

  return false;
});
