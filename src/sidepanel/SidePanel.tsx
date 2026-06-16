import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../database/local_db.ts';
import { syncConversationToNotion } from '../integrations/notion.ts';

export default function SidePanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  
  // Notion Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncError, setSyncError] = useState('');
  const [parentId, setParentId] = useState('');

  // Fetch settings for Notion
  const [notionToken, setNotionToken] = useState('');

  // Read chats and tags dynamically from local Dexie database
  const conversations = useLiveQuery(async () => {
    let list = await db.conversations.toArray();
    
    // Perform search query filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(query) || c.platform.includes(query));
    }

    // Perform tag filtering
    if (selectedTag) {
      list = list.filter(c => c.tags?.includes(selectedTag));
    }

    // Sort by most recent
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [searchQuery, selectedTag]) || [];

  // Extract unique tags lists
  const allTags = Array.from(new Set(conversations.flatMap(c => c.tags || [])));

  // Load Notion settings from chrome local storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings'], (res) => {
        if (res.settings) {
          setNotionToken(res.settings.notionToken || '');
          // Default fallback page id is empty
        }
      });
    }
  }, [selectedChatId]);

  // Read active messages for selected chats
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const activeChat = conversations.find(c => c.id === selectedChatId);

  useEffect(() => {
    if (!selectedChatId) {
      setActiveMessages([]);
      return;
    }
    db.getFullConversation(selectedChatId)
      .then(res => {
        if (res) setActiveMessages(res.messages);
      })
      .catch(err => console.error('[SidePanel] Failed to retrieve messages:', err));
  }, [selectedChatId]);

  const handleSyncToNotion = async () => {
    if (!selectedChatId || !activeChat) return;
    if (!notionToken.trim()) {
      setSyncError('Notion Token not configured. Please visit extension Settings.');
      return;
    }
    if (!parentId.trim()) {
      setSyncError('Please enter a Notion Parent Page or Database ID.');
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    setSyncUrl('');

    try {
      const url = await syncConversationToNotion({
        token: notionToken,
        parentId: parentId.trim(),
        title: activeChat.title,
        messages: activeMessages
      });
      setSyncUrl(url);
    } catch (err) {
      setSyncError((err as Error).message || 'Sync operation failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQuickBridge = (targetPlatform: string) => {
    if (activeMessages.length === 0) return;
    
    // Format bridge prompt
    const textBuffer = activeMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    chrome.storage.local.get(['settings'], (res) => {
      const settings = res.settings || { preamble: 'Context from previous session: ' };
      const fullPrompt = `${settings.preamble}\n\n${textBuffer}\n\n[End of Bridged Context]`;

      chrome.storage.local.set({
        omniscribe_pending_bridge: {
          targetPlatform,
          prompt: fullPrompt,
          timestamp: Date.now()
        }
      }, () => {
        // Redirection route via background script
        chrome.runtime.sendMessage({
          type: 'OPEN_TAB',
          url: targetPlatform === 'perplexity' ? 'https://www.perplexity.ai' : `https://${targetPlatform === 'chatgpt' ? 'chatgpt.com' : targetPlatform === 'claude' ? 'claude.ai' : targetPlatform === 'gemini' ? 'gemini.google.com' : 'grok.com'}`
        });
      });
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      boxSizing: 'border-box',
      padding: '16px',
      gap: '16px',
      background: '#0f172a',
      color: '#f8fafc'
    }}>
      {/* Header Deck */}
      <div>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          Omniscribe Sidebar
        </h2>
        <span style={{ fontSize: '11px', color: '#64748b' }}>Unified Chat Aggregator</span>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search conversation text..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          padding: '8px 12px',
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px',
          color: '#f8fafc',
          fontSize: '13px',
          outline: 'none'
        }}
      />

      {/* Tags Slider */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedTag('')}
            style={{
              padding: '2px 8px',
              backgroundColor: !selectedTag ? '#6366f1' : '#1e293b',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '2px 8px',
                backgroundColor: selectedTag === tag ? '#6366f1' : '#1e293b',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#fff',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Primary Split: Chats list vs Details View */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto'
      }}>
        {!selectedChatId ? (
          /* Chats List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conversations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '20px' }}>
                No synced conversations match.
              </div>
            ) : (
              conversations.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  style={{
                    padding: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '9px',
                      background: 'rgba(99,102,241,0.15)',
                      color: '#818cf8',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 'bold'
                    }}>
                      {chat.platform}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      {new Date(chat.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', lineBreak: 'anywhere' }}>
                    {chat.title}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Chat Details & Sync Inspector */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
            {/* Back button */}
            <button
              onClick={() => {
                setSelectedChatId(null);
                setSyncUrl('');
                setSyncError('');
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ← Back to List
            </button>

            {/* Inspector header */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '4px' }}>
                {activeChat?.title}
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                Platform: {activeChat?.platform.toUpperCase()} | Synced turns: {activeMessages.length}
              </span>
            </div>

            {/* Notion Syncer panel */}
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Sync to Notion Workspace</div>
              <input
                type="text"
                placeholder="Notion Parent Page or Database ID"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                style={{
                  padding: '6px 10px',
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSyncToNotion}
                disabled={isSyncing}
                style={{
                  padding: '8px',
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  opacity: isSyncing ? 0.6 : 1
                }}
              >
                {isSyncing ? 'Syncing to Notion...' : 'Sync Now'}
              </button>

              {syncUrl && (
                <a
                  href={syncUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '11px',
                    color: '#10b981',
                    textDecoration: 'underline',
                    textAlign: 'center',
                    marginTop: '4px'
                  }}
                >
                  🚀 Click to Open in Notion
                </a>
              )}
              {syncError && (
                <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center' }}>
                  {syncError}
                </div>
              )}
            </div>

            {/* Quick Handoff controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>QUICK CONTEXT BRIDGE:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={() => handleQuickBridge('chatgpt')}
                  style={{ padding: '6px', fontSize: '11px', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Bridge to ChatGPT
                </button>
                <button
                  onClick={() => handleQuickBridge('claude')}
                  style={{ padding: '6px', fontSize: '11px', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Bridge to Claude
                </button>
              </div>
            </div>

            {/* Message lines visual trace */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {activeMessages.map((m, idx) => (
                <div key={idx} style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold', color: m.role === 'user' ? '#818cf8' : '#a855f7', marginBottom: '2px' }}>
                    {m.role === 'user' ? 'User' : 'Assistant'}
                  </div>
                  <div style={{ color: '#cbd5e1', lineBreak: 'anywhere', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
