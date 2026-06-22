import Dexie, { type Table } from 'dexie';

export interface Conversation {
  id: string;          // Scraped hash ID or auto-generated UUID
  title: string;       // Thread topic
  platform: string;    // chatgpt | claude | gemini | perplexity | grok
  url: string;         // Link to original chat log
  timestamp: number;   // Unix epoch millisecond timestamp
  tags?: string[];     // Local categorized folder tags
}

export interface Message {
  id?: number;         // Primary key, auto-incrementing
  conversationId: string; // Foreign key referencing Conversation.id
  role: 'user' | 'assistant' | 'system';
  content: string;     // Text markdown content
  thinkingContent?: string; // Optional reasoning trace (DeepSeek / Gemini)
  timestamp: number;
}

export class RelayOneDatabase extends Dexie {
  conversations!: Table<Conversation>;
  messages!: Table<Message>;

  constructor() {
    super('RelayOneDB');
    
    // Define database tables and index keys
    this.version(1).stores({
      conversations: 'id, title, platform, timestamp, *tags',
      messages: '++id, conversationId, role, timestamp'
    });
  }

  /**
   * Adds or updates a conversation in the local database.
   */
  async saveConversation(conversation: Conversation): Promise<string> {
    try {
      console.log(`[RelayOneDB] Saving conversation: ${conversation.id}`);
      await this.conversations.put(conversation);
      return conversation.id;
    } catch (error) {
      console.error('[RelayOneDB] Error saving conversation:', error);
      throw error;
    }
  }

  /**
   * Adds multiple messages in bulk to a conversation.
   */
  async saveMessages(newMessages: Message[]): Promise<void> {
    if (newMessages.length === 0) return;
    try {
      console.log(`[RelayOneDB] Bulk saving ${newMessages.length} messages`);
      await this.transaction('rw', this.messages, async () => {
        await this.messages.bulkPut(newMessages);
      });
    } catch (error) {
      console.error('[RelayOneDB] Error saving messages in bulk:', error);
      throw error;
    }
  }

  /**
   * Cleans conversations and their corresponding messages older than a specific duration (e.g., 30 days).
   * Default retention is set to 30 days.
   */
  async pruneOldConversations(retentionDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      console.log(`[RelayOneDB] Running prune check for records older than ${retentionDays} days...`);
      
      // Query conversations older than the cutoff threshold
      const oldConversations = await this.conversations
        .where('timestamp')
        .below(cutoffTime)
        .toArray();

      if (oldConversations.length === 0) {
        console.log('[RelayOneDB] No conversations to prune.');
        return 0;
      }

      const conversationIds = oldConversations.map(c => c.id);
      
      await this.transaction('rw', [this.conversations, this.messages], async () => {
        // Delete all messages associated with the pruned conversations
        await this.messages
          .where('conversationId')
          .anyOf(conversationIds)
          .delete();

        // Delete the conversations themselves
        await this.conversations
          .where('id')
          .anyOf(conversationIds)
          .delete();
      });

      console.log(`[RelayOneDB] Pruned ${oldConversations.length} conversations and associated messages.`);
      return oldConversations.length;
    } catch (error) {
      console.error('[RelayOneDB] Error during conversation pruning:', error);
      throw error;
    }
  }

  /**
   * Retrieves a full conversation along with its messages.
   */
  async getFullConversation(conversationId: string): Promise<{ conversation: Conversation | undefined; messages: Message[] }> {
    try {
      const conversation = await this.conversations.get(conversationId);
      const messages = await this.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('timestamp');
      return { conversation, messages };
    } catch (error) {
      console.error(`[RelayOneDB] Error fetching full conversation ${conversationId}:`, error);
      throw error;
    }
  }
}

export const db = new RelayOneDatabase();
export default db;
