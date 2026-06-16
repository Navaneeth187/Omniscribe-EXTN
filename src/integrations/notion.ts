/**
 * Notion Integration Driver for Omniscribe AI
 * Synchronizes local chats to a Notion Workspace using the public API.
 */

import { type Message } from '../database/local_db.ts';

interface SyncPayload {
  token: string;
  parentId: string;
  title: string;
  messages: Message[];
}

/**
 * Splits text into 2000 character chunks to respect Notion block size restrictions.
 */
function splitTextIntoBlocks(text: string, role: 'user' | 'assistant' | 'system'): any[] {
  const blocks: any[] = [];
  const chunkSize = 1900; // Safe threshold under the 2000 limit

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, i + chunkSize);
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: chunk },
            annotations: {
              italic: role === 'system',
              code: role === 'system'
            }
          }
        ],
        color: role === 'user' ? 'indigo_background' : 'default'
      }
    });
  }

  return blocks;
}

/**
 * Sends a POST request to Notion to sync a complete conversation thread.
 */
export async function syncConversationToNotion({ token, parentId, title, messages }: SyncPayload): Promise<string> {
  console.log(`[Notion Syncer] Initiating sync for: ${title} to parent: ${parentId}`);

  // Create document body blocks
  const childrenBlocks: any[] = [];

  messages.forEach((msg) => {
    // 1. Role Headers
    const label = msg.role === 'user' ? 'User Prompt' : 'AI Assistant Response';
    const color = msg.role === 'user' ? 'blue' : 'purple';

    childrenBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: { content: `■ ${label}` }
          }
        ],
        color: `${color}_solid`
      }
    });

    // 2. Message Body Chunk Blocks
    const textBlocks = splitTextIntoBlocks(msg.content, msg.role);
    childrenBlocks.push(...textBlocks);

    // 3. Reasoning traces as custom callout blocks
    if (msg.thinkingContent) {
      childrenBlocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: msg.thinkingContent.substring(0, 1900) }
            }
          ],
          icon: {
            type: 'emoji',
            emoji: '🧠'
          },
          color: 'gray_background'
        }
      });
    }
  });

  // Determine parent container layout structure: page vs database parent type
  const cleanParentId = parentId.replace(/-/g, '');
  const isDatabase = cleanParentId.length === 32 && !parentId.startsWith('p_');
  const parentObject = isDatabase
    ? { database_id: parentId }
    : { page_id: parentId.replace(/^p_/, '') };

  const requestBody = {
    parent: parentObject,
    properties: isDatabase
      ? {
          Name: {
            title: [
              {
                text: { content: title }
              }
            ]
          }
        }
      : {
          title: [
            {
              text: { content: title }
            }
          ]
        },
    children: childrenBlocks.slice(0, 95) // Notion API limits page children to 100 on creation
  };

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Notion Syncer] Sync request rejected:', errorData);
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const responseData = await response.json();
  console.log('[Notion Syncer] Successfully synchronized:', responseData.url);
  return responseData.url || `https://notion.so/${responseData.id.replace(/-/g, '')}`;
}
