import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../database/local_db.ts';
import Preview from '../preview/Preview.tsx';
import { exportToMarkdown, exportToJSON, exportToDocx, exportToPDF } from '../exporters/export_drivers.ts';

interface ExtensionSettings {
  autoSubmit: boolean;
  retentionDays: number;
  preamble: string;
  fontSize: number;
  theme: string;
  margin: number;
  lineHeight: number;
  showChatTime: boolean;
  includeThinking: boolean;
  filenameFormat: string;
  showNotionButton: boolean;
  includeSourceUrl: boolean;
  hiddenPlatforms: string[];
}

const DUMMY_PREVIEW_CONVERSATION: Message[] = [
  {
    conversationId: 'demo-preview',
    role: 'user',
    content: 'Can you help me outline a checklist for launching a new feature on our SaaS platform? I want to make sure marketing, engineering, and support are fully aligned.',
    timestamp: Date.now() - 12000
  },
  {
    conversationId: 'demo-preview',
    role: 'assistant',
    content: 'Here is a launch checklist to align your product teams:\n\n### 1. Engineering & QA\n- [ ] Freeze code 3 days prior to target release.\n- [ ] Run automated regression suites and check critical user flows.\n- [ ] Prepare rollback script and database migrations.\n\n### 2. Marketing & Operations\n- [ ] Draft launch announcement blog post and email newsletter.\n- [ ] Update public pricing page and service features list.\n- [ ] Record a 2-minute feature demo video highlighting key benefits.\n\n### 3. Customer Support & Docs\n- [ ] Update external Help Center articles with new screenshot assets.\n- [ ] Train support agents on troubleshooting common setup issues.\n- [ ] Set up feedback tag filters in the helpdesk system.\n\nThis workflow guarantees all cross-functional steps are tracked.',
    timestamp: Date.now()
  }
];

export default function Options() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'general' | 'style' | 'cache'>('general');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [pruneResult, setPruneResult] = useState<string>('');
  const [selectedExportChatId, setSelectedExportChatId] = useState<string>('');
  const [activeMessages, setActiveMessages] = useState<Message[]>(DUMMY_PREVIEW_CONVERSATION);

  const [settings, setSettings] = useState<ExtensionSettings>({
    autoSubmit: true,
    retentionDays: 30,
    preamble: 'The following is context from my previous session: ',
    fontSize: 14,
    theme: 'slate',
    margin: 15,
    lineHeight: 1.5,
    showChatTime: true,
    includeThinking: true,
    filenameFormat: 'title',
    showNotionButton: true,
    includeSourceUrl: true,
    hiddenPlatforms: []
  });

  // Read current IndexedDB status reactively
  const conversations = useLiveQuery(() => db.conversations.toArray()) || [];
  const conversationCount = conversations.length;
  const messageCount = useLiveQuery(() => db.messages.count()) || 0;

  // React on changes to chrome storage theme
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['relayone-theme'], (res) => {
        if (res['relayone-theme']) {
          setTheme(res['relayone-theme']);
        }
      });
    }

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['relayone-theme']) {
        setTheme(changes['relayone-theme'].newValue);
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

  // Sync selected conversation messages for visual previews
  useEffect(() => {
    if (!selectedExportChatId) {
      setActiveMessages(DUMMY_PREVIEW_CONVERSATION);
      return;
    }
    db.getFullConversation(selectedExportChatId)
      .then(fullChat => {
        if (fullChat && fullChat.messages) {
          setActiveMessages(fullChat.messages);
        }
      })
      .catch(err => {
        console.error('[Options] Failed to load messages for preview:', err);
        setActiveMessages([]);
      });
  }, [selectedExportChatId, conversations]);

  // Load preferences from chrome storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
          setSettings(prev => ({
            ...prev,
            ...result.settings
          }));
        }
      });
    }
  }, []);

  const updateSettingField = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    
    setSaveStatus('Saving changes...');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ settings: updated }, () => {
        setTimeout(() => setSaveStatus('Saved'), 600);
        setTimeout(() => setSaveStatus(''), 2000);
      });
    } else {
      setTimeout(() => setSaveStatus('Offline mode active'), 600);
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const handleManualPrune = async () => {
    setPruneResult('Pruning data...');
    try {
      const prunedCount = await db.pruneOldConversations(settings.retentionDays);
      setPruneResult(`Deleted ${prunedCount} stale conversations.`);
      setTimeout(() => setPruneResult(''), 4000);
    } catch (error) {
      setPruneResult('Pruning failed.');
      console.error('[Settings] Pruner failed:', error);
    }
  };

  const togglePlatformVisibility = (platformId: string) => {
    const hidden = settings.hiddenPlatforms || [];
    const isHidden = hidden.includes(platformId);
    const updatedHidden = isHidden
      ? hidden.filter(p => p !== platformId)
      : [...hidden, platformId];
    
    updateSettingField('hiddenPlatforms', updatedHidden);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'relayone-theme': nextTheme });
    }
  };

  // Triggers client download files
  const handleExportFile = async (format: 'pdf' | 'md' | 'docx' | 'json') => {
    let exportMessages = DUMMY_PREVIEW_CONVERSATION;
    let exportTitle = 'RelayOne Demo Document';
    let targetChat: any = undefined;

    if (selectedExportChatId) {
      const foundChat = conversations.find(c => c.id === selectedExportChatId);
      if (foundChat) {
        targetChat = foundChat;
        const fullChat = await db.getFullConversation(selectedExportChatId);
        exportMessages = fullChat.messages;
        exportTitle = foundChat.title;
      }
    }

    try {
      switch (format) {
        case 'pdf':
          exportToPDF(exportTitle, exportMessages, { fontSize: settings.fontSize, theme: settings.theme, margin: settings.margin }, targetChat);
          break;
        case 'md':
          exportToMarkdown(exportTitle, exportMessages, targetChat);
          break;
        case 'docx':
          exportToDocx(exportTitle, exportMessages, targetChat);
          break;
        case 'json':
          exportToJSON(exportTitle, exportMessages, targetChat);
          break;
      }
    } catch (error) {
      console.error(`[Settings] Export failed for ${format}:`, error);
    }
  };

  // Modern dynamic theme tokens
  const dynamicCardBg = isDark ? '#0c0e14' : '#ffffff';
  const dynamicBorderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
  const dynamicTextColor = isDark ? '#cbd5e1' : '#334155';
  const dynamicHeadingColor = isDark ? '#f8fafc' : '#0f172a';
  const dynamicSubTextColor = isDark ? '#64748b' : '#64748b';
  const dynamicAccentColor = isDark ? '#6366f1' : '#4f46e5';
  const dynamicSidebarBg = isDark ? '#08090d' : '#f8fafc';
  const dynamicInputBg = isDark ? '#11131c' : '#ffffff';
  const dynamicInputBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const dynamicAlertBg = isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(79, 70, 229, 0.03)';
  const dynamicAlertBorder = isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)';

  const presets = [
    { id: 'slate', name: 'Slate', primary: '#6366f1', bg: '#0f172a', text: '#cbd5e1' },
    { id: 'charcoal', name: 'Charcoal', primary: '#71717a', bg: '#18181b', text: '#e4e4e7' },
    { id: 'sakura', name: 'Sakura', primary: '#fb7185', bg: '#fff1f2', text: '#9f1239' },
    { id: 'lavender', name: 'Lavender', primary: '#c084fc', bg: '#f3e8ff', text: '#6b21a8' },
    { id: 'emerald', name: 'Emerald', primary: '#34d399', bg: '#ecfdf5', text: '#065f46' }
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: dynamicTextColor,
      backgroundColor: 'transparent',
      transition: 'all 0.25s ease'
    }}>
      
      {/* 1. Left Sidebar Section */}
      <div style={{
        width: '260px',
        backgroundColor: dynamicSidebarBg,
        borderRight: `1px solid ${dynamicBorderColor}`,
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          {/* Logo container */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 8px',
            marginBottom: '32px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: dynamicAccentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18M3 12h18M12 3l9 9-9 9-9-9 9-9z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em', color: dynamicHeadingColor }}>RelayOne AI</div>
              <div style={{ fontSize: '10px', color: dynamicSubTextColor, fontWeight: 500 }}>V1.3.4 Console</div>
            </div>
          </div>

          {/* Nav Categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Settings Tab Group */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: dynamicSubTextColor, letterSpacing: '0.05em', padding: '0 8px 8px 8px', textTransform: 'uppercase' }}>Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  onClick={() => setActiveTab('general')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: activeTab === 'general' ? (isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)') : 'transparent',
                    color: activeTab === 'general' ? dynamicAccentColor : dynamicTextColor,
                    fontWeight: activeTab === 'general' ? 600 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  General Settings
                </button>

                <button
                  onClick={() => setActiveTab('style')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: activeTab === 'style' ? (isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)') : 'transparent',
                    color: activeTab === 'style' ? dynamicAccentColor : dynamicTextColor,
                    fontWeight: activeTab === 'style' ? 600 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35249 19.5 5.50022 19.8 5.50022 20.5C5.50022 21.3284 6.17179 22 7.00022 22H12Z"></path>
                    <circle cx="7.5" cy="10.5" r="1.5"></circle>
                    <circle cx="11.5" cy="7.5" r="1.5"></circle>
                    <circle cx="16.5" cy="9.5" r="1.5"></circle>
                    <circle cx="15.5" cy="14.5" r="1.5"></circle>
                  </svg>
                  Style Settings
                </button>

                <button
                  onClick={() => setActiveTab('cache')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: activeTab === 'cache' ? (isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)') : 'transparent',
                    color: activeTab === 'cache' ? dynamicAccentColor : dynamicTextColor,
                    fontWeight: activeTab === 'cache' ? 600 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
                  </svg>
                  Data Cache
                </button>

                <button
                  onClick={toggleTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: dynamicTextColor,
                    fontWeight: 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {isDark ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5"></circle>
                      <line x1="12" y1="1" x2="12" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="23"></line>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                      <line x1="1" y1="12" x2="3" y2="12"></line>
                      <line x1="21" y1="12" x2="23" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  )}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: dynamicSubTextColor,
                    textTransform: 'uppercase',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    Toggle
                  </span>
                </button>
              </div>
            </div>

            {/* Support section */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: dynamicSubTextColor, letterSpacing: '0.05em', padding: '0 8px 8px 8px', textTransform: 'uppercase' }}>Support</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <a
                  href="https://github.com/Navaneeth187/RelayOne-EXTN/issues"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    color: dynamicTextColor,
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '13px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    Contact Us
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>

                <a
                  href="https://github.com/Navaneeth187/RelayOne-EXTN"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    color: dynamicTextColor,
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '13px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    Docs & Guides
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status Label */}
        <div style={{
          padding: '12px 10px',
          borderRadius: '8px',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: `1px solid ${dynamicBorderColor}`
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981'
          }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: dynamicTextColor }}>
            {saveStatus ? saveStatus : 'All settings synchronized'}
          </span>
        </div>
      </div>

      {/* 2. Right Workspace Content Pane */}
      <div style={{
        flex: 1,
        padding: '36px 40px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        
        {/* Active Title Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${dynamicBorderColor}`,
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: dynamicHeadingColor
            }}>
              {activeTab === 'general' && 'General Settings'}
              {activeTab === 'style' && 'Style Settings'}
              {activeTab === 'cache' && 'Data Cache & Navigation'}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: dynamicSubTextColor, fontSize: '13px' }}>
              {activeTab === 'general' && 'Configure automated handoffs, retention schedules, and global metadata defaults.'}
              {activeTab === 'style' && 'Design visual layouts and test print formats for exports.'}
              {activeTab === 'cache' && 'Monitor storage limits and filter AI companion shortcuts in the sidebar.'}
            </p>
          </div>
        </div>

        {/* TAB 1: General Settings */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px' }}>
            
            {/* Info Notice Banner */}
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'start',
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: dynamicAlertBg,
              border: `1px solid ${dynamicAlertBorder}`,
              color: isDark ? '#a5b4fc' : '#4f46e5',
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>These configurations dictate local retention, preamble triggers, and automated handoffs. All data is kept securely in your local browser sandbox.</span>
            </div>

            {/* General Section Card 1: Account Vault */}
            <div style={{
              backgroundColor: dynamicCardBg,
              borderRadius: '12px',
              border: `1px solid ${dynamicBorderColor}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dynamicHeadingColor }}>Account Information</h3>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                border: `1px solid ${dynamicBorderColor}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isDark ? '#1e1b4b' : '#e0e7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: dynamicAccentColor
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Local Vault Storage</div>
                    <div style={{ fontSize: '11px', color: dynamicSubTextColor }}>Fully local-first architecture</div>
                  </div>
                </div>
                
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '12px'
                }}>
                  Unlimited Free
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>System Language</label>
                <select
                  value="en"
                  disabled
                  style={{
                    padding: '10px 12px',
                    backgroundColor: dynamicInputBg,
                    border: `1px solid ${dynamicInputBorder}`,
                    borderRadius: '8px',
                    color: dynamicTextColor,
                    fontSize: '13px',
                    outline: 'none',
                    opacity: 0.8
                  }}
                >
                  <option value="en">Follow System Language (English)</option>
                </select>
              </div>
            </div>

            {/* General Section Card 2: Automations */}
            <div style={{
              backgroundColor: dynamicCardBg,
              borderRadius: '12px',
              border: `1px solid ${dynamicBorderColor}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dynamicHeadingColor }}>Handoff Configurations</h3>

              {/* Toggle Auto Submit */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                border: `1px solid ${dynamicBorderColor}`
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: dynamicHeadingColor }}>Automatic Submission</div>
                  <div style={{ fontSize: '11px', color: dynamicSubTextColor, marginTop: '2px' }}>
                    Auto-submits prompts on handoff redirection targets.
                  </div>
                </div>
                
                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => updateSettingField('autoSubmit', !settings.autoSubmit)}
                  style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: settings.autoSubmit ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                    transition: 'background 0.2s ease',
                    outline: 'none'
                  }}
                >
                  <span style={{
                    display: 'block',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: settings.autoSubmit ? '20px' : '2px',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>

              {/* Preamble Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Prompt Handoff Preamble</label>
                  <span style={{ fontSize: '11px', color: dynamicSubTextColor }}>Injected at context header</span>
                </div>
                <textarea
                  rows={3}
                  value={settings.preamble}
                  onChange={(e) => updateSettingField('preamble', e.target.value)}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: dynamicInputBg,
                    border: `1px solid ${dynamicInputBorder}`,
                    borderRadius: '8px',
                    color: dynamicTextColor,
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    lineHeight: '1.4',
                    transition: 'all 0.15s ease'
                  }}
                />
              </div>
            </div>

            {/* General Section Card 3: Retention Policy */}
            <div style={{
              backgroundColor: dynamicCardBg,
              borderRadius: '12px',
              border: `1px solid ${dynamicBorderColor}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dynamicHeadingColor }}>Data Retention Policy</h3>
              <p style={{ margin: 0, fontSize: '12px', color: dynamicSubTextColor }}>Determines when stale conversation logs are cleared automatically to keep your storage healthy.</p>

              <div style={{
                background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                padding: '16px',
                borderRadius: '8px',
                border: `1px solid ${dynamicBorderColor}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: dynamicHeadingColor }}>Retention Window</span>
                  <span style={{ fontWeight: '700', color: dynamicAccentColor, fontSize: '13px' }}>{settings.retentionDays} Days</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={settings.retentionDays}
                  onChange={(e) => updateSettingField('retentionDays', parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    accentColor: dynamicAccentColor
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: dynamicSubTextColor }}>
                  <span>5 Days (Tight)</span>
                  <span>90 Days (Standard)</span>
                  <span>180 Days (Max)</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: Style Settings */}
        {activeTab === 'style' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '400px 1fr',
            gap: '30px',
            alignItems: 'start'
          }}>
            
            {/* Left Options Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Alert notice */}
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: dynamicAlertBg,
                border: `1px solid ${dynamicAlertBorder}`,
                color: isDark ? '#a5b4fc' : '#4f46e5',
                fontSize: '12px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Default settings used for PDF and document exports.</span>
              </div>

              {/* Main settings card */}
              <div style={{
                backgroundColor: dynamicCardBg,
                borderRadius: '12px',
                border: `1px solid ${dynamicBorderColor}`,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                
                {/* Select Chat dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Select Preview Feed</label>
                  <select
                    value={selectedExportChatId}
                    onChange={(e) => setSelectedExportChatId(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: dynamicInputBg,
                      border: `1px solid ${dynamicInputBorder}`,
                      borderRadius: '8px',
                      color: dynamicTextColor,
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Demo Sandbox Chat (SaaS Launch Checklist)</option>
                    {conversations.map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.platform.toUpperCase()}] {c.title.length > 32 ? c.title.substring(0, 32) + '...' : c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Theme Selector presets grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Theme Settings</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                    {presets.map(p => (
                      <button
                        key={p.id}
                        onClick={() => updateSettingField('theme', p.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '8px',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#ffffff',
                          border: `2px solid ${settings.theme === p.id ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0, 0, 0, 0.06)')}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          outline: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 600, color: dynamicTextColor }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.primary }} />
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.bg }} />
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.text }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size segment control */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Font Size</label>
                  <div style={{
                    display: 'flex',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    padding: '2px',
                    borderRadius: '8px',
                    border: `1px solid ${dynamicBorderColor}`
                  }}>
                    {[
                      { label: 'Small', val: 12 },
                      { label: 'Medium', val: 14 },
                      { label: 'Large', val: 16 }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateSettingField('fontSize', opt.val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: settings.fontSize === opt.val ? (isDark ? '#312e81' : '#e0e7ff') : 'transparent',
                          color: settings.fontSize === opt.val ? (isDark ? '#c7d2fe' : '#4338ca') : dynamicTextColor,
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* Fine tuning slider */}
                  <input
                    type="range"
                    min="11"
                    max="20"
                    value={settings.fontSize}
                    onChange={(e) => updateSettingField('fontSize', parseInt(e.target.value, 10))}
                    style={{ width: '100%', marginTop: '6px', cursor: 'pointer', accentColor: dynamicAccentColor }}
                  />
                </div>

                {/* Page Margins segment control */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Page Margins</label>
                  <div style={{
                    display: 'flex',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    padding: '2px',
                    borderRadius: '8px',
                    border: `1px solid ${dynamicBorderColor}`
                  }}>
                    {[
                      { label: 'Narrow', val: 10 },
                      { label: 'Standard', val: 15 },
                      { label: 'Wide', val: 25 }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateSettingField('margin', opt.val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: settings.margin === opt.val ? (isDark ? '#312e81' : '#e0e7ff') : 'transparent',
                          color: settings.margin === opt.val ? (isDark ? '#c7d2fe' : '#4338ca') : dynamicTextColor,
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* Fine tuning slider */}
                  <input
                    type="range"
                    min="5"
                    max="35"
                    value={settings.margin}
                    onChange={(e) => updateSettingField('margin', parseInt(e.target.value, 10))}
                    style={{ width: '100%', marginTop: '6px', cursor: 'pointer', accentColor: dynamicAccentColor }}
                  />
                </div>

                {/* Line Height segment control */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Line Height</label>
                  <div style={{
                    display: 'flex',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    padding: '2px',
                    borderRadius: '8px',
                    border: `1px solid ${dynamicBorderColor}`
                  }}>
                    {[
                      { label: 'Tight', val: 1.3 },
                      { label: 'Standard', val: 1.5 },
                      { label: 'Double', val: 1.8 }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => updateSettingField('lineHeight', opt.val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: settings.lineHeight === opt.val ? (isDark ? '#312e81' : '#e0e7ff') : 'transparent',
                          color: settings.lineHeight === opt.val ? (isDark ? '#c7d2fe' : '#4338ca') : dynamicTextColor,
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* Fine tuning slider */}
                  <input
                    type="range"
                    min="1.1"
                    max="2.0"
                    step="0.1"
                    value={settings.lineHeight}
                    onChange={(e) => updateSettingField('lineHeight', parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '6px', cursor: 'pointer', accentColor: dynamicAccentColor }}
                  />
                </div>

                {/* Additional Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                  {/* Chat Time Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Show Chat Time</span>
                    <button
                      type="button"
                      onClick={() => updateSettingField('showChatTime', !settings.showChatTime)}
                      style={{
                        width: '34px',
                        height: '18px',
                        borderRadius: '9px',
                        backgroundColor: settings.showChatTime ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        padding: 0,
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <span style={{
                        display: 'block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '2px',
                        left: settings.showChatTime ? '18px' : '2px',
                        transition: 'left 0.2s ease'
                      }} />
                    </button>
                  </div>

                  {/* Thinking Content Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: dynamicHeadingColor }}>Include thinking content</span>
                    <button
                      type="button"
                      onClick={() => updateSettingField('includeThinking', !settings.includeThinking)}
                      style={{
                        width: '34px',
                        height: '18px',
                        borderRadius: '9px',
                        backgroundColor: settings.includeThinking ? dynamicAccentColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        padding: 0,
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <span style={{
                        display: 'block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '2px',
                        left: settings.includeThinking ? '18px' : '2px',
                        transition: 'left 0.2s ease'
                      }} />
                    </button>
                  </div>
                </div>

                {/* Exporters trigger layout */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: `1px solid ${dynamicBorderColor}`, paddingTop: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleExportFile('pdf')}
                      style={{
                        padding: '10px',
                        background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
                        color: isDark ? '#fca5a5' : '#ef4444',
                        border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)'}`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Export PDF
                    </button>
                    <button
                      onClick={() => handleExportFile('md')}
                      style={{
                        padding: '10px',
                        background: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)',
                        color: isDark ? '#93c5fd' : '#2563eb',
                        border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'}`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Export MD
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleExportFile('docx')}
                      style={{
                        padding: '10px',
                        background: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)',
                        color: isDark ? '#c7d2fe' : '#4f46e5',
                        border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.15)'}`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Export Word
                    </button>
                    <button
                      onClick={() => handleExportFile('json')}
                      style={{
                        padding: '10px',
                        background: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.04)',
                        color: isDark ? '#fda4af' : '#e11d48',
                        border: `1px solid ${isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.15)'}`,
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Export JSON
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Live Preview Column */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '660px', position: 'sticky', top: '24px' }}>
              <div style={{
                padding: '8px 12px',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderRadius: '8px 8px 0 0',
                border: `1px solid ${dynamicBorderColor}`,
                borderBottom: 'none',
                fontSize: '11px',
                fontWeight: 600,
                color: dynamicSubTextColor,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ marginLeft: '6px' }}>Live Exporter Sandbox Preview</span>
              </div>
              <Preview
                messages={activeMessages}
                fontSize={settings.fontSize}
                theme={settings.theme}
                margin={settings.margin}
                lineHeight={settings.lineHeight}
              />
            </div>

          </div>
        )}

        {/* TAB 3: Data Cache & Site Navigation */}
        {activeTab === 'cache' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px' }}>
            
            {/* Database Stats Card */}
            <div style={{
              backgroundColor: dynamicCardBg,
              borderRadius: '12px',
              border: `1px solid ${dynamicBorderColor}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dynamicHeadingColor }}>Local IndexedDB Status</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{
                  padding: '16px',
                  background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${dynamicBorderColor}`,
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: dynamicSubTextColor, textTransform: 'uppercase' }}>Conversations</span>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: dynamicAccentColor, marginTop: '4px' }}>{conversationCount}</div>
                </div>
                
                <div style={{
                  padding: '16px',
                  background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${dynamicBorderColor}`,
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: dynamicSubTextColor, textTransform: 'uppercase' }}>Cached Logs</span>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#a855f7', marginTop: '4px' }}>{messageCount}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleManualPrune}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: isDark ? '#fca5a5' : '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                >
                  Prune Stale Logs Now
                </button>
                <span style={{ fontSize: '12px', color: dynamicSubTextColor }}>{pruneResult}</span>
              </div>
            </div>

            {/* AI sites visibility configuration list */}
            <div style={{
              backgroundColor: dynamicCardBg,
              borderRadius: '12px',
              border: `1px solid ${dynamicBorderColor}`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dynamicHeadingColor }}>Sidebar Companion Navigation</h3>
              <p style={{ margin: 0, fontSize: '12px', color: dynamicSubTextColor }}>Toggle platforms on/off to customize which shortcuts appear in your SidePanel.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {[
                  { id: 'chatgpt', name: 'ChatGPT' },
                  { id: 'claude', name: 'Claude' },
                  { id: 'gemini', name: 'Gemini' },
                  { id: 'perplexity', name: 'Perplexity' },
                  { id: 'grok', name: 'Grok' }
                ].map(site => {
                  const isHidden = (settings.hiddenPlatforms || []).includes(site.id);
                  return (
                    <div
                      key={site.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
                        border: `1px solid ${dynamicBorderColor}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isHidden ? '#94a3b8' : dynamicAccentColor
                        }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: isHidden ? dynamicSubTextColor : dynamicHeadingColor }}>{site.name}</span>
                      </div>
                      
                      <button
                        onClick={() => togglePlatformVisibility(site.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isHidden ? dynamicSubTextColor : dynamicAccentColor,
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: 'none'
                        }}
                      >
                        {isHidden ? (
                          // Eye off SVG
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          // Eye on SVG
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
