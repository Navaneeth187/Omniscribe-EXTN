import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../database/local_db.ts';
import Preview from '../preview/Preview.tsx';
import { exportToMarkdown, exportToJSON, exportToDocx, exportToPDF } from '../exporters/export_drivers.ts';

interface ExtensionSettings {
  autoSubmit: boolean;
  retentionDays: number;
  notionToken: string;
  preamble: string;
  // Styling settings
  fontSize: number;
  theme: string;
  margin: number;
  lineHeight: number;
}

const DUMMY_MATH_CONVERSATION: Message[] = [
  {
    conversationId: 'demo-math',
    role: 'user',
    content: 'Can you show me the definition of a Gaussian distribution and the classic Gaussian integral proof?',
    timestamp: Date.now() - 12000
  },
  {
    conversationId: 'demo-math',
    role: 'assistant',
    content: 'Certainly! The probability density function of a normal (Gaussian) distribution is defined as:\n\n$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$$\n\nWhere $\\mu$ is the mean parameter and $\\sigma$ is the standard deviation. The normalization factor is proven by solving the classic Gaussian integral:\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\nThis proof translates double integrals into polar coordinates.',
    timestamp: Date.now()
  }
];

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    autoSubmit: true,
    retentionDays: 30,
    notionToken: '',
    preamble: 'The following is context from my previous session: ',
    fontSize: 14,
    theme: 'slate',
    margin: 15,
    lineHeight: 1.5
  });
  
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [pruneResult, setPruneResult] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'settings' | 'export'>('settings');
  const [selectedExportChatId, setSelectedExportChatId] = useState<string>('');
  const [activeMessages, setActiveMessages] = useState<Message[]>(DUMMY_MATH_CONVERSATION);

  // Read current IndexedDB status reactively
  const conversations = useLiveQuery(() => db.conversations.toArray()) || [];
  const conversationCount = conversations.length;
  const messageCount = useLiveQuery(() => db.messages.count()) || 0;

  // Sync selected conversation messages for visual previews
  useEffect(() => {
    if (!selectedExportChatId) {
      setActiveMessages(DUMMY_MATH_CONVERSATION);
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
          console.log('[Settings] Configurations synchronized:', result.settings);
        }
      });
    }
  }, []);

  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveStatus('Saving...');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ settings }, () => {
        setSaveStatus('Preferences saved.');
        console.log('[Settings] Storage updated:', settings);
        setTimeout(() => setSaveStatus(''), 2500);
      });
    } else {
      setSaveStatus('Storage error: browser APIs inaccessible.');
      setTimeout(() => setSaveStatus(''), 2500);
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

  // Triggers client download files
  const handleExportFile = async (format: 'pdf' | 'md' | 'docx' | 'json') => {
    let exportMessages = DUMMY_MATH_CONVERSATION;
    let exportTitle = 'Omniscribe Demo Document';

    if (selectedExportChatId) {
      const targetChat = conversations.find(c => c.id === selectedExportChatId);
      if (targetChat) {
        const fullChat = await db.getFullConversation(selectedExportChatId);
        exportMessages = fullChat.messages;
        exportTitle = targetChat.title;
      }
    }

    try {
      switch (format) {
        case 'pdf':
          exportToPDF(exportTitle, exportMessages, {
            fontSize: settings.fontSize,
            theme: settings.theme,
            margin: settings.margin
          });
          break;
        case 'md':
          exportToMarkdown(exportTitle, exportMessages);
          break;
        case 'docx':
          exportToDocx(exportTitle, exportMessages);
          break;
        case 'json':
          exportToJSON(exportTitle, exportMessages);
          break;
      }
    } catch (error) {
      console.error(`[Settings] Export failed for ${format}:`, error);
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '20px auto',
      padding: '0 20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Settings Navigation Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '16px',
        marginTop: '10px'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            Omniscribe AI Center
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Offline context routing manager & document compilations engine.
          </p>
        </div>
        
        {/* Navigation tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'settings' ? '#818cf8' : '#94a3b8',
              border: `1px solid ${activeTab === 'settings' ? '#6366f1' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            System Settings
          </button>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'export' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'export' ? '#818cf8' : '#94a3b8',
              border: `1px solid ${activeTab === 'export' ? '#6366f1' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            Export Documents
          </button>
        </div>
      </div>

      {/* Split layout wrapper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
        alignItems: 'start'
      }}>
        {/* Left Control Column */}
        <div style={{
          backgroundColor: '#111827',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '24px'
        }}>
          {activeTab === 'settings' ? (
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600 }}>System Configurations</h2>

              {/* Toggle Auto Submit */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Automatic Submission</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Trigger enter submit on redirected destination text inputs.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSubmit}
                  onChange={(e) => setSettings({ ...settings, autoSubmit: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Retention slider */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Local Data Retention</span>
                  <span style={{ fontWeight: 'bold', color: '#a855f7', fontSize: '13px' }}>{settings.retentionDays} Days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="180"
                  value={settings.retentionDays}
                  onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Notion Token input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Notion Integration Token</label>
                <input
                  type="password"
                  placeholder="secret_..."
                  value={settings.notionToken}
                  onChange={(e) => setSettings({ ...settings, notionToken: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#f9fafb',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Preamble area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Prompt Handoff Prefix</label>
                <textarea
                  rows={2}
                  value={settings.preamble}
                  onChange={(e) => setSettings({ ...settings, preamble: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#f9fafb',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '10px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  marginTop: '10px'
                }}
              >
                Save General Settings
              </button>
              <span style={{ fontSize: '12px', color: '#10b981', textAlign: 'center' }}>{saveStatus}</span>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ margin: '0', fontSize: '18px', fontWeight: 600 }}>Document Styling Deck</h2>

              {/* Chat selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Select Chat to Export</label>
                <select
                  value={selectedExportChatId}
                  onChange={(e) => setSelectedExportChatId(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#f9fafb',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Demo Sandbox Chat (Gaussian Integral)</option>
                  {conversations.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.platform.toUpperCase()}] {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Theme selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Visual Theme Preset</label>
                <select
                  value={settings.theme}
                  onChange={(e) => {
                    const newSettings = { ...settings, theme: e.target.value };
                    setSettings(newSettings);
                    chrome.storage.local.set({ settings: newSettings });
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#f9fafb',
                    fontSize: '13px'
                  }}
                >
                  <option value="slate">Sleek Slate (Default)</option>
                  <option value="sakura">Cherry Sakura</option>
                  <option value="lavender">Royal Lavender</option>
                  <option value="charcoal">Dark Charcoal</option>
                  <option value="emerald">Deep Emerald</option>
                </select>
              </div>

              {/* Font slider */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Font Size</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#a855f7', marginLeft: 'auto' }}>{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="11"
                  max="20"
                  value={settings.fontSize}
                  onChange={(e) => {
                    const newSettings = { ...settings, fontSize: parseInt(e.target.value, 10) };
                    setSettings(newSettings);
                    chrome.storage.local.set({ settings: newSettings });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Margin slider */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Page Margins</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#a855f7', marginLeft: 'auto' }}>{settings.margin}mm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={settings.margin}
                  onChange={(e) => {
                    const newSettings = { ...settings, margin: parseInt(e.target.value, 10) };
                    setSettings(newSettings);
                    chrome.storage.local.set({ settings: newSettings });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Line height slider */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Line Height spacing</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#a855f7', marginLeft: 'auto' }}>{settings.lineHeight}x</span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="2.0"
                  step="0.1"
                  value={settings.lineHeight}
                  onChange={(e) => {
                    const newSettings = { ...settings, lineHeight: parseFloat(e.target.value) };
                    setSettings(newSettings);
                    chrome.storage.local.set({ settings: newSettings });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Exporters trigger layout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleExportFile('pdf')}
                    style={{ padding: '10px', backgroundColor: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                  >
                    Export to PDF
                  </button>
                  <button
                    onClick={() => handleExportFile('md')}
                    style={{ padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                  >
                    Export Markdown
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleExportFile('docx')}
                    style={{ padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                  >
                    Export Word (.doc)
                  </button>
                  <button
                    onClick={() => handleExportFile('json')}
                    style={{ padding: '10px', backgroundColor: '#4b5563', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                  >
                    Download JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Database Info Cards */}
          <div style={{
            marginTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: '20px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Local Database</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Conversations</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#818cf8', marginTop: '2px' }}>{conversationCount}</div>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Cached Messages</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#a855f7', marginTop: '2px' }}>{messageCount}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleManualPrune}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500
                }}
              >
                Prune Storage
              </button>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{pruneResult}</span>
            </div>
          </div>
        </div>

        {/* Right Preview Column */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
          <Preview
            messages={activeMessages}
            fontSize={settings.fontSize}
            theme={settings.theme}
            margin={settings.margin}
            lineHeight={settings.lineHeight}
          />
        </div>
      </div>
    </div>
  );
}
