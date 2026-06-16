import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/local_db.ts';

export default function Popup() {
  // Use Dexie live hooks to reactively query storage state
  const conversations = useLiveQuery(() => db.conversations.toArray()) || [];
  const messageCount = useLiveQuery(() => db.messages.count()) || 0;

  const handleAddDummy = async () => {
    try {
      const uniqueId = `conv-${Date.now()}`;
      await db.saveConversation({
        id: uniqueId,
        title: `Research Session #${conversations.length + 1}`,
        platform: conversations.length % 2 === 0 ? 'claude' : 'chatgpt',
        url: 'https://claude.ai/chat/dummy-test-id',
        timestamp: Date.now(),
        tags: ['research', 'dev-test']
      });

      await db.saveMessages([
        {
          conversationId: uniqueId,
          role: 'user',
          content: 'How does client-side IndexedDB scaling compare to server caching?',
          timestamp: Date.now() - 5000
        },
        {
          conversationId: uniqueId,
          role: 'assistant',
          content: 'IndexedDB operates locally on client disk space, eliminating cloud query delays and securing privacy.',
          timestamp: Date.now()
        }
      ]);
      console.log('[Popup] Dummy record successfully generated.');
    } catch (error) {
      console.error('[Popup] Failed to generate dummy record:', error);
    }
  };

  const handleClearDatabase = async () => {
    try {
      await db.conversations.clear();
      await db.messages.clear();
      console.log('[Popup] Database tables cleared.');
    } catch (error) {
      console.error('[Popup] Database clear failed:', error);
    }
  };

  const handleOpenOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/options/index.html'));
    }
  };

  const handleOpenSidePanel = async () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    } else {
      // Fallback: alert/log message
      console.log('[Popup] SidePanel API offline.');
    }
  };

  return (
    <div style={{
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      minHeight: '380px',
      boxSizing: 'border-box'
    }}>
      {/* Header Block */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '18px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Omniscribe AI
          </span>
        </div>
        <span style={{
          fontSize: '10px',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          color: '#818cf8',
          padding: '2px 8px',
          borderRadius: '12px',
          fontWeight: 600
        }}>
          v1.0.0
        </span>
      </div>

      {/* Database Dashboard Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#818cf8' }}>
            {conversations.length}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            Conversations
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a855f7' }}>
            {messageCount}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            Cached Messages
          </div>
        </div>
      </div>

      {/* Reactive Feed */}
      <div style={{
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        padding: '10px',
        maxHeight: '120px',
        overflowY: 'auto'
      }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
          LOCAL CONVERSATION CACHE
        </div>
        {conversations.length === 0 ? (
          <div style={{
            fontSize: '11px',
            color: '#475569',
            textAlign: 'center',
            paddingTop: '20px'
          }}>
            No history cached. Create a test record below.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {conversations.map((c) => (
              <div key={c.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '4px',
                borderLeft: `3px solid ${c.platform === 'claude' ? '#d97706' : '#10b981'}`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '180px'
                }}>
                  {c.title}
                </div>
                <span style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase' }}>
                  {c.platform}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Button Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: 'auto'
      }}>
        <button
          onClick={handleOpenSidePanel}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
        >
          Open Sidebar Aggregator
        </button>

        <button
          onClick={handleAddDummy}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#6366f1')}
        >
          Add Test Conversation
        </button>

        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={handleOpenOptions}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
          >
            Options Page
          </button>
          
          <button
            onClick={handleClearDatabase}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
          >
            Clear DB
          </button>
        </div>
      </div>
    </div>
  );
}
