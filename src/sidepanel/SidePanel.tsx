import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../database/local_db.ts';
import { exportToMarkdown, exportToJSON, exportToDocx, exportToPDF } from '../exporters/export_drivers.ts';

export default function SidePanel() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['omniscribe-theme'], (res) => {
        if (res['omniscribe-theme']) {
          setTheme(res['omniscribe-theme']);
        }
      });
    }

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['omniscribe-theme']) {
        setTheme(changes['omniscribe-theme'].newValue);
      }
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
    return;
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Settings for PDF compilation
  const [pdfSettings, setPdfSettings] = useState({
    fontSize: 14,
    theme: 'slate',
    margin: 15
  });

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

  // Load settings from chrome local storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings'], (res) => {
        if (res.settings) {
          setPdfSettings({
            fontSize: res.settings.fontSize || 14,
            theme: res.settings.theme || 'slate',
            margin: res.settings.margin || 15
          });
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

  const handleExport = (format: 'pdf' | 'md' | 'docx' | 'json') => {
    if (!activeChat || activeMessages.length === 0) return;
    try {
      switch (format) {
        case 'pdf':
          exportToPDF(activeChat.title, activeMessages, pdfSettings, activeChat);
          break;
        case 'md':
          exportToMarkdown(activeChat.title, activeMessages, activeChat);
          break;
        case 'docx':
          exportToDocx(activeChat.title, activeMessages, activeChat);
          break;
        case 'json':
          exportToJSON(activeChat.title, activeMessages, activeChat);
          break;
      }
    } catch (err) {
      console.error('[SidePanel] Export failed:', err);
    }
  };

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    }
  }, [isDark]);

  // Theme-aware styles
  const dynamicBg = isDark ? '#030407' : '#f1f5f9';
  const dynamicCardBg = isDark ? '#11131c' : '#ffffff';
  const dynamicBorderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)';
  const dynamicTextColor = isDark ? '#cbd5e1' : '#1e293b';
  const dynamicHeadingColor = isDark ? '#f8fafc' : '#0f172a';
  const dynamicSubTextColor = isDark ? '#64748b' : '#475569';
  const dynamicAccentColor = isDark ? '#6366f1' : '#4f46e5';

  const dynamicInputBg = isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff';
  const dynamicInputBorder = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      boxSizing: 'border-box',
      padding: '16px',
      gap: '12px',
      background: dynamicBg,
      color: dynamicTextColor,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      transition: 'background 0.15s ease'
    }}>
      {/* Header Deck */}
      <div>
        <h2 style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: dynamicHeadingColor
        }}>
          Omniscribe Ledger
        </h2>
        <span style={{ fontSize: '11px', color: dynamicSubTextColor }}>Local archive & activity history</span>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search conversation text..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          padding: '8px 12px',
          background: dynamicInputBg,
          border: `1px solid ${dynamicInputBorder}`,
          borderRadius: '6px',
          color: dynamicTextColor,
          fontSize: '12px',
          outline: 'none',
          transition: 'all 0.15s ease'
        }}
      />

      {/* Tags Slider */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedTag('')}
            style={{
              padding: '4px 10px',
              backgroundColor: !selectedTag ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'),
              border: `1px solid ${!selectedTag ? 'transparent' : dynamicBorderColor}`,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              color: !selectedTag ? '#ffffff' : dynamicTextColor,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '4px 10px',
                backgroundColor: selectedTag === tag ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                border: `1px solid ${selectedTag === tag ? 'transparent' : dynamicBorderColor}`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                color: selectedTag === tag ? '#ffffff' : dynamicTextColor,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
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
              <div style={{ textAlign: 'center', color: dynamicSubTextColor, fontSize: '12px', marginTop: '20px' }}>
                No synced conversations match.
              </div>
            ) : (
              conversations.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  style={{
                    padding: '12px',
                    background: dynamicCardBg,
                    border: `1px solid ${dynamicBorderColor}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = dynamicAccentColor;
                    if (!isDark) e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = dynamicBorderColor;
                    if (!isDark) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '9px',
                      background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.06)',
                      color: isDark ? '#a5b4fc' : '#4f46e5',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      letterSpacing: '0.02em'
                    }}>
                      {chat.platform}
                    </span>
                    <span style={{ fontSize: '10px', color: dynamicSubTextColor }}>
                      {new Date(chat.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: dynamicHeadingColor, lineBreak: 'anywhere' }}>
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
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                background: 'transparent',
                border: `1px solid ${dynamicBorderColor}`,
                borderRadius: '6px',
                color: dynamicTextColor,
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to List
            </button>

            {/* Inspector header */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: dynamicHeadingColor, marginBottom: '4px', letterSpacing: '-0.01em' }}>
                {activeChat?.title}
              </div>
              <span style={{ fontSize: '10px', color: dynamicSubTextColor }}>
                Platform: {activeChat?.platform.toUpperCase()} &bull; Synced turns: {activeMessages.length}
              </span>
            </div>

            {/* Export Options Panel */}
            <div style={{
              background: dynamicCardBg,
              border: `1px solid ${dynamicBorderColor}`,
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: dynamicSubTextColor, letterSpacing: '0.05em' }}>EXPORT DOCUMENT:</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={() => handleExport('pdf')}
                  style={{
                    padding: '8px 6px',
                    fontSize: '11px',
                    background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
                    color: isDark ? '#fca5a5' : '#ef4444',
                    border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  PDF Document
                </button>
                <button
                  onClick={() => handleExport('md')}
                  style={{
                    padding: '8px 6px',
                    fontSize: '11px',
                    background: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)',
                    color: isDark ? '#93c5fd' : '#2563eb',
                    border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)';
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Markdown Spec
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={() => handleExport('docx')}
                  style={{
                    padding: '8px 6px',
                    fontSize: '11px',
                    background: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)',
                    color: isDark ? '#c7d2fe' : '#4f46e5',
                    border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.15)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)';
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Word Docx
                </button>
                <button
                  onClick={() => handleExport('json')}
                  style={{
                    padding: '8px 6px',
                    fontSize: '11px',
                    background: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.04)',
                    color: isDark ? '#fda4af' : '#e11d48',
                    border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.15)'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.04)';
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Archival JSON
                </button>
              </div>
            </div>

            {/* Quick Handoff Platform selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: dynamicSubTextColor, letterSpacing: '0.05em' }}>QUICK CONTEXT BRIDGE:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {['chatgpt', 'claude', 'gemini', 'perplexity', 'grok'].map(platformId => (
                  <button
                    key={platformId}
                    onClick={() => handleQuickBridge(platformId)}
                    style={{
                      padding: '8px 0',
                      borderRadius: '6px',
                      border: `1px solid ${dynamicBorderColor}`,
                      backgroundColor: 'transparent',
                      color: dynamicTextColor,
                      fontSize: '10px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                      e.currentTarget.style.borderColor = dynamicAccentColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = dynamicBorderColor;
                    }}
                  >
                    {platformId === 'perplexity' ? 'Perplex' : platformId.charAt(0).toUpperCase() + platformId.slice(1, 4)}
                  </button>
                ))}
              </div>
            </div>

            {/* Message lines visual trace */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              borderTop: `1px solid ${dynamicBorderColor}`,
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {activeMessages.map((m, idx) => (
                <div key={idx} style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <div style={{
                    fontWeight: 600,
                    color: m.role === 'user' ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#a78bfa' : '#6d28d9'),
                    marginBottom: '2px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {m.role === 'user' ? 'User' : 'Assistant'}
                  </div>
                  <div style={{
                    color: dynamicTextColor,
                    lineBreak: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    background: m.role === 'user' ? (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)') : 'transparent',
                    padding: m.role === 'user' ? '6px 10px' : '0',
                    borderRadius: '6px',
                    border: m.role === 'user' ? `1px solid ${dynamicBorderColor}` : 'none'
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
