import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../database/local_db.ts';
import { exportToMarkdown, exportToJSON, exportToDocx, exportToPDF } from '../exporters/export_drivers.ts';

const PLATFORMS_LIST = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', color: '#10b981' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', color: '#f97316' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', color: '#3b82f6' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', color: '#06b6d4' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com', color: '#8b5cf6' }
];

const FORMATS_LIST = [
  { id: 'pdf', name: 'PDF Document', extension: '.pdf', color: '#ef4444', desc: 'Vector layout with formatted LaTeX formulas' },
  { id: 'md', name: 'Markdown Spec', extension: '.md', color: '#3b82f6', desc: 'Clean syntax headers for developer repositories' },
  { id: 'docx', name: 'MS Word Document', extension: '.docx', color: '#4f46e5', desc: 'Formatted layout with colored bubble highlights' },
  { id: 'image', name: 'Visual Card', extension: '.png', color: '#10b981', desc: 'Graphic card backplate summary' },
  { id: 'json', name: 'Archival JSON', extension: '.json', color: '#f43f5e', desc: 'Structured database object format' },
  { id: 'txt', name: 'Plain Text Log', extension: '.txt', color: '#f97316', desc: 'Simple conversation turn log' }
];


export default function Popup() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && localStorage) {
      return (localStorage.getItem('relayone-theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  const [pipelineMode, setPipelineMode] = useState<'bridge' | 'export'>('bridge');
  const [currentTabPlatform, setCurrentTabPlatform] = useState<string | null>(null);
  const [currentTabTitle, setCurrentTabTitle] = useState<string>('No Active Platform Tab');
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  // States for source/target pipeline nodes
  const [selectedSourceId, setSelectedSourceId] = useState<string>('active-tab');
  const [selectedBridgeTarget, setSelectedBridgeTarget] = useState<string>('claude');
  const [selectedExportFormat, setSelectedExportFormat] = useState<string>('pdf');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Database read
  const conversations = useLiveQuery(() => db.conversations.toArray()) || [];

  useEffect(() => {
    localStorage.setItem('relayone-theme', theme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'relayone-theme': theme });
    }
  }, [theme]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url && tab.id) {
          setActiveTabId(tab.id);
          try {
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            let detected: string | null = null;
            if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
              detected = 'chatgpt';
            } else if (hostname.includes('claude.ai')) {
              detected = 'claude';
            } else if (hostname.includes('gemini.google.com')) {
              detected = 'gemini';
            } else if (hostname.includes('perplexity.ai')) {
              detected = 'perplexity';
            } else if (hostname.includes('grok.com')) {
              detected = 'grok';
            }

            setCurrentTabPlatform(detected);
            if (detected) {
              setCurrentTabTitle(tab.title || `${detected.toUpperCase()} Thread`);
              setPipelineMode('bridge');
              const fallback = PLATFORMS_LIST.find(p => p.id !== detected);
              if (fallback) setSelectedBridgeTarget(fallback.id);
            } else {
              setCurrentTabTitle('Chrome Tab View');
              setPipelineMode('export');
            }
          } catch (e) {
            console.error('[Popup] URL parse error:', e);
          }
        }
      });
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const scrapeCurrentTab = (): Promise<{ conversation: any; messages: Message[] }> => {
    return new Promise((resolve, reject) => {
      if (!activeTabId || !currentTabPlatform) {
        reject(new Error('Go to a supported AI chat tab first.'));
        return;
      }
      chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_CURRENT_PAGE' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Scraping connection lost. Reload the chat.'));
        } else if (response && response.success) {
          resolve(response.payload);
        } else {
          reject(new Error(response?.error || 'No message logs found.'));
        }
      });
    });
  };

  const handleCaptureSession = async () => {
    if (!currentTabPlatform) {
      showToast('No active AI platform page found.', 'error');
      return;
    }
    try {
      showToast('Pulling chat transcript...', 'info');
      const payload = await scrapeCurrentTab();
      await db.saveConversation(payload.conversation);
      await db.saveMessages(payload.messages);
      showToast(`Archived ${payload.messages.length} messages offline!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Scrape operation failed.', 'error');
    }
  };

  const executePipeline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (pipelineMode === 'bridge') {
        if (!currentTabPlatform) {
          showToast('No active chat tab to bridge context from.', 'error');
          setIsProcessing(false);
          return;
        }

        const target = PLATFORMS_LIST.find(p => p.id === selectedBridgeTarget);
        if (!target) {
          showToast('Invalid target platform.', 'error');
          setIsProcessing(false);
          return;
        }

        if (selectedBridgeTarget === currentTabPlatform) {
          showToast('Source and Target cannot be the same.', 'error');
          setIsProcessing(false);
          return;
        }

        if (!activeTabId) return;

        chrome.tabs.sendMessage(activeTabId, { type: 'TRIGGER_BRIDGE', targetPlatform: selectedBridgeTarget }, () => {
          if (chrome.runtime.lastError) {
            showToast('Bridge error. Refresh active page.', 'error');
          } else {
            showToast(`Context bridge initiated to ${target.name}!`, 'success');
          }
        });
      } else {
        let exportTitle = '';
        let exportMessages: Message[] = [];
        let exportMeta: any = null;

        if (selectedSourceId === 'active-tab') {
          if (!currentTabPlatform) {
            if (conversations.length > 0) {
              const latest = [...conversations].sort((a, b) => b.timestamp - a.timestamp)[0];
              const msgs = await db.messages.where('conversationId').equals(latest.id).toArray();
              exportTitle = latest.title;
              exportMessages = msgs;
              exportMeta = latest;
              showToast('Exporting latest local chat cache.', 'info');
            } else {
              showToast('No active tab or stored logs found.', 'error');
              setIsProcessing(false);
              return;
            }
          } else {
            showToast('Compiling live thread turns...', 'info');
            const payload = await scrapeCurrentTab();
            exportTitle = payload.conversation.title;
            exportMessages = payload.messages;
            exportMeta = payload.conversation;
          }
        } else {
          const target = conversations.find(c => c.id === selectedSourceId);
          if (!target) {
            showToast('Local database record missing.', 'error');
            setIsProcessing(false);
            return;
          }
          const msgs = await db.messages.where('conversationId').equals(target.id).toArray();
          exportTitle = target.title;
          exportMessages = msgs;
          exportMeta = target;
        }

        if (exportMessages.length === 0) {
          showToast('Transcript holds 0 messages.', 'error');
          setIsProcessing(false);
          return;
        }

        switch (selectedExportFormat) {
          case 'pdf':
            exportToPDF(exportTitle, exportMessages, { fontSize: 13, theme: 'slate', margin: 15 }, exportMeta);
            showToast('PDF compiled successfully!', 'success');
            break;
          case 'md':
            exportToMarkdown(exportTitle, exportMessages, exportMeta);
            showToast('Markdown downloaded!', 'success');
            break;
          case 'txt':
            downloadRawText(exportTitle, exportMessages);
            showToast('Plain Text downloaded!', 'success');
            break;
          case 'docx':
            exportToDocx(exportTitle, exportMessages, exportMeta);
            showToast('Word template compiled!', 'success');
            break;
          case 'image':
            exportToImageCard(exportTitle, exportMessages, exportMeta?.platform || 'RelayOne');
            showToast('Graphic snapshot compiled!', 'success');
            break;
          case 'json':
            exportToJSON(exportTitle, exportMessages, exportMeta);
            showToast('Archival JSON downloaded!', 'success');
            break;
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Pipeline process failed.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadRawText = (title: string, messages: Message[]) => {
    const content = messages
      .map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[\/:*?"<>|]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/options/index.html'));
    }
  };

  const exportToImageCard = (title: string, messages: Message[], platform: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 800, 620);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#1a1936');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 620);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, 40, 720, 540, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.beginPath();
    ctx.roundRect(70, 75, 120, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#c7d2fe';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(platform.toUpperCase(), 130, 93);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const words = title.split(' ');
    let line = '';
    let y = 145;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > 600 && i > 0) {
        ctx.fillText(line, 70, y);
        line = words[i] + ' ';
        y += 28;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, 70, y);

    const previewText = messages.find(m => m.role === 'assistant')?.content || messages[0]?.content || '';
    const cleanPreview = previewText.replace(/\*\*|`/g, '').substring(0, 280).trim();

    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('ASSISTANT THREAD PREVIEW:', 70, y + 35);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui, sans-serif';
    const previewWords = cleanPreview.split(' ');
    let textLine = '';
    let textY = y + 60;
    const linesLimit = 8;
    let linesDrawn = 0;

    for (let i = 0; i < previewWords.length; i++) {
      const test = textLine + previewWords[i] + ' ';
      if (ctx.measureText(test).width > 640 && i > 0) {
        ctx.fillText(textLine, 70, textY);
        textLine = previewWords[i] + ' ';
        textY += 24;
        linesDrawn++;
        if (linesDrawn >= linesLimit) break;
      } else {
        textLine = test;
      }
    }
    if (linesDrawn < linesLimit) {
      ctx.fillText(textLine, 70, textY);
    }

    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('RELAYONE AI PIPELINE EXPORT', 70, 545);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/[\/:*?"<>|]/g, '_')}_card.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  };

  const handleClearDatabase = async () => {
    if (confirm('Permanently wipe all offline session logs from Dexie? This action is local and irreversible.')) {
      try {
        await db.conversations.clear();
        await db.messages.clear();
        setSelectedSourceId('active-tab');
        showToast('Offline cache wiped.', 'success');
      } catch (err) {
        showToast('Database error.', 'error');
      }
    }
  };

  const getSourceColor = () => {
    if (selectedSourceId === 'active-tab') {
      if (currentTabPlatform) {
        return PLATFORMS_LIST.find(p => p.id === currentTabPlatform)?.color || '#818cf8';
      }
      return '#818cf8';
    }
    const target = conversations.find(c => c.id === selectedSourceId);
    if (target) {
      return PLATFORMS_LIST.find(p => p.id === target.platform)?.color || '#818cf8';
    }
    return '#818cf8';
  };

  const getTargetColor = () => {
    if (pipelineMode === 'bridge') {
      return PLATFORMS_LIST.find(p => p.id === selectedBridgeTarget)?.color || '#818cf8';
    }
    return FORMATS_LIST.find(f => f.id === selectedExportFormat)?.color || '#10b981';
  };

  const isDark = theme === 'dark';
  const sourceColor = getSourceColor();
  const targetColor = getTargetColor();

  // Dynamic style parameters based on Theme Mode
  const dynamicContainerBg = isDark
    ? 'radial-gradient(circle at 50% 0%, #0d0f1a 0%, #030407 100%)'
    : 'radial-gradient(circle at 50% 0%, #f9fafb 0%, #e5e7eb 100%)';
  const dynamicTextColor = isDark ? '#f8fafc' : '#1f2937';
  const dynamicBorderColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.08)';
  const dynamicHeaderBg = isDark ? 'rgba(3, 4, 7, 0.7)' : 'rgba(255, 255, 255, 0.8)';
  const dynamicSubTextColor = isDark ? '#64748b' : '#4b5563';
  const dynamicCanvasBg = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.6)';
  const dynamicCanvasBorder = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)';
  const dynamicNodeBg = isDark ? 'rgba(9, 13, 22, 0.85)' : '#ffffff';
  const dynamicPathBg = isDark
    ? 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(129, 140, 248, 0.3) 50%, rgba(255,255,255,0.02) 100%)'
    : 'linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(79, 70, 229, 0.25) 50%, rgba(0,0,0,0.02) 100%)';
  
  const dynamicConsoleCardBg = isDark
    ? 'linear-gradient(185deg, rgba(255, 255, 255, 0.015) 0%, rgba(255, 255, 255, 0.002) 100%)'
    : 'linear-gradient(185deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.5) 100%)';
  const dynamicConsoleCardBorder = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)';
  const dynamicToggleContainerBg = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.03)';
  const dynamicToggleContainerBorder = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
  
  const dynamicSelectBg = isDark ? 'rgba(9, 13, 22, 0.6)' : '#ffffff';
  const dynamicSelectBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)';
  const dynamicSelectColor = isDark ? '#cbd5e1' : '#1f2937';
  
  const dynamicInfoBg = isDark ? 'rgba(255,255,255,0.005)' : 'rgba(0,0,0,0.015)';
  const dynamicInfoBorder = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)';
  const dynamicFooterBg = isDark ? 'rgba(3, 4, 7, 0.4)' : 'rgba(243, 244, 246, 0.9)';

  const dynamicToggleBtnBg = (isActive: boolean) => isActive
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff')
    : 'transparent';
  const dynamicToggleBtnColor = (isActive: boolean) => isActive
    ? (isDark ? '#ffffff' : '#1f2937')
    : (isDark ? '#64748b' : '#6b7280');
  const dynamicToggleBtnShadow = (isActive: boolean) => isActive
    ? (isDark ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 2px rgba(0,0,0,0.06)')
    : 'none';

  return (
    <div style={{ ...containerStyle, background: dynamicContainerBg, color: dynamicTextColor }}>
      <style>{`
        @keyframes flowGlow {
          0% { left: 0%; opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .glow-node {
          animation: glowPulse 2.5s infinite ease-in-out;
        }
        @keyframes glowPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); filter: brightness(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Header Bar */}
      <header style={{ ...headerStyle, borderBottom: `1px solid ${dynamicBorderColor}`, backgroundColor: dynamicHeaderBg }}>
        <div style={logoContainerStyle}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79, 70, 229, 0.3)'
          }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: dynamicTextColor, letterSpacing: '-0.02em' }}>
            RelayOne Console
          </span>
        </div>
        <div style={{
          ...statusBadgeStyle,
          color: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }} title="100% encrypted, secure browser memory storage.">
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
          Local Pipeline
        </div>
      </header>

      {/* Pipeline Visualizer Schematic */}
      <div style={{ ...pipelineCanvasStyle, backgroundColor: dynamicCanvasBg, border: `1px solid ${dynamicCanvasBorder}` }}>
        {/* Source Node */}
        <div style={pipelineNodeStyle(sourceColor)} className="glow-node" title="Pipeline Data Input Node">
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: dynamicNodeBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            {selectedSourceId === 'active-tab' && currentTabPlatform ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: sourceColor, letterSpacing: '0.02em' }}>
                {currentTabPlatform.substring(0, 4).toUpperCase()}
              </span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sourceColor} strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            )}
            <span style={{ fontSize: '7px', fontWeight: 600, color: dynamicSubTextColor, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Source</span>
          </div>
        </div>

        {/* Pulsing Pipeline path */}
        <div style={{ ...pipelinePathStyle, background: dynamicPathBg }}>
          <div style={{
            position: 'absolute',
            top: '-3px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: sourceColor,
            boxShadow: `0 0 8px ${sourceColor}`,
            animation: 'flowGlow 1.8s infinite linear'
          }} />
        </div>

        {/* Middle Mode Indicator */}
        <div style={{
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.08)',
          border: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(79, 70, 229, 0.15)',
          fontSize: '9px',
          fontWeight: 600,
          color: isDark ? '#a5b4fc' : '#4f46e5',
          textTransform: 'uppercase',
          letterSpacing: '0.06em'
        }}>
          {pipelineMode === 'bridge' ? 'Bridge' : 'Export'}
        </div>

        {/* Pulsing Pipeline path */}
        <div style={{ ...pipelinePathStyle, background: dynamicPathBg }}>
          <div style={{
            position: 'absolute',
            top: '-3px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: targetColor,
            boxShadow: `0 0 8px ${targetColor}`,
            animation: 'flowGlow 1.8s infinite linear',
            animationDelay: '0.9s'
          }} />
        </div>

        {/* Target Node */}
        <div style={pipelineNodeStyle(targetColor)} className="glow-node" title="Pipeline Output Node">
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: dynamicNodeBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            {pipelineMode === 'bridge' ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: targetColor, letterSpacing: '0.02em' }}>
                {selectedBridgeTarget.substring(0, 4).toUpperCase()}
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 600, color: targetColor, letterSpacing: '0.02em' }}>
                {selectedExportFormat.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: '7px', fontWeight: 600, color: dynamicSubTextColor, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Target</span>
          </div>
        </div>
      </div>

      {/* Control Console */}
      <div style={{ ...consoleCardStyle, background: dynamicConsoleCardBg, borderColor: dynamicConsoleCardBorder }}>
        {/* Toggle Mode */}
        <div style={{ ...toggleContainerStyle, backgroundColor: dynamicToggleContainerBg, borderColor: dynamicToggleContainerBorder }}>
          <button
            onClick={() => setPipelineMode('bridge')}
            style={{
              ...toggleBtnStyle(pipelineMode === 'bridge'),
              backgroundColor: dynamicToggleBtnBg(pipelineMode === 'bridge'),
              color: dynamicToggleBtnColor(pipelineMode === 'bridge'),
              boxShadow: dynamicToggleBtnShadow(pipelineMode === 'bridge')
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
            </svg>
            Platform Bridge
          </button>
          <button
            onClick={() => setPipelineMode('export')}
            style={{
              ...toggleBtnStyle(pipelineMode === 'export'),
              backgroundColor: dynamicToggleBtnBg(pipelineMode === 'export'),
              color: dynamicToggleBtnColor(pipelineMode === 'export'),
              boxShadow: dynamicToggleBtnShadow(pipelineMode === 'export')
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12M7 10l5 5 5-5" />
            </svg>
            Document Exporter
          </button>
        </div>

        {/* Context Bridge Settings */}
        {pipelineMode === 'bridge' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: dynamicSubTextColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Active Thread Source:
              </div>
              <div style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.015)' : '#ffffff',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0,0,0,0.06)',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '12px',
                color: dynamicTextColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                  display: 'inline-block',
                  flexShrink: 0
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTabTitle}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: dynamicSubTextColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Target Handoff Platform:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {PLATFORMS_LIST.map(p => {
                  const isCurrent = currentTabPlatform === p.id;
                  const isSelected = selectedBridgeTarget === p.id;
                  return (
                    <button
                      key={p.id}
                      disabled={isCurrent}
                      onClick={() => setSelectedBridgeTarget(p.id)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '6px',
                        border: isSelected
                          ? `1px solid ${isDark ? 'rgba(99, 102, 241, 0.6)' : '#4f46e5'}`
                          : `1px solid ${dynamicBorderColor}`,
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)')
                          : 'transparent',
                        color: isSelected
                          ? (isDark ? '#c7d2fe' : '#4f46e5')
                          : (isCurrent ? (isDark ? '#334155' : '#9ca3af') : dynamicTextColor),
                        fontSize: '10px',
                        fontWeight: 500,
                        cursor: isCurrent ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent && !isSelected) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent && !isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {p.id === 'perplexity' ? 'Perplex' : p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{
              fontSize: '11px',
              color: isDark ? '#94a3b8' : '#475569',
              lineHeight: '1.5',
              backgroundColor: dynamicInfoBg,
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${dynamicInfoBorder}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#818cf8' : '#4f46e5'} strokeWidth="2.5" style={{ marginTop: '2px', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                This extension runs entirely in your browser and does not send data to external servers. Please remove any personal or sensitive information before sharing data with LLM tools.
              </span>
            </div>

            <button
              onClick={executePipeline}
              style={{
                ...actionBtnStyle,
                backgroundColor: '#4f46e5',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4338ca';
                e.currentTarget.style.transform = 'translateY(-0.5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4f46e5';
                e.currentTarget.style.transform = 'none';
              }}
            >
              Execute Handoff Pipeline
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '4px' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Exporter Settings */}
        {pipelineMode === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: dynamicSubTextColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Pipeline Input (Source):
              </div>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                style={{
                  ...selectStyle,
                  backgroundColor: dynamicSelectBg,
                  border: `1px solid ${dynamicSelectBorder}`,
                  color: dynamicSelectColor
                }}
              >
                <option value="active-tab" style={{ color: '#1f2937' }}>Active Tab Thread (Live Page)</option>
                {conversations.map(c => (
                  <option key={c.id} value={c.id} style={{ color: '#1f2937' }}>
                    Archive: {c.title.substring(0, 24)}... ({c.platform.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: dynamicSubTextColor, fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Pipeline Output Format:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {FORMATS_LIST.map(f => {
                  const isSelected = selectedExportFormat === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedExportFormat(f.id)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '6px',
                        border: isSelected
                          ? `1px solid ${isDark ? 'rgba(99, 102, 241, 0.6)' : '#4f46e5'}`
                          : `1px solid ${dynamicBorderColor}`,
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)')
                          : 'transparent',
                        color: isSelected
                          ? (isDark ? '#c7d2fe' : '#4f46e5')
                          : dynamicTextColor,
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={f.desc}
                    >
                      <span>{f.name.split(' ')[0]}</span>
                      <span style={{ fontSize: '8px', color: dynamicSubTextColor, fontWeight: 'normal' }}>{f.extension}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{
              fontSize: '11px',
              color: isDark ? '#94a3b8' : '#475569',
              lineHeight: '1.5',
              backgroundColor: dynamicInfoBg,
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px solid ${dynamicInfoBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#818cf8' : '#4f46e5'} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{FORMATS_LIST.find(f => f.id === selectedExportFormat)?.desc}</span>
            </div>

            <button
              onClick={executePipeline}
              style={{
                ...actionBtnStyle,
                backgroundColor: '#4f46e5',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4338ca';
                e.currentTarget.style.transform = 'translateY(-0.5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4f46e5';
                e.currentTarget.style.transform = 'none';
              }}
            >
              Download Compiled Document
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '4px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Library/Control Footer */}
      <footer style={{ ...footerStyle, backgroundColor: dynamicFooterBg, borderTop: `1px solid ${dynamicBorderColor}` }}>
        {/* LIGHT/DARK THEME SWITCHER - Replaces Options Ledger setting button */}
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {isDark ? (
            /* Sun Icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            /* Moon Icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {currentTabPlatform && (
          <button
            onClick={handleCaptureSession}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Archive Active Session Locally"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#64748b" : "#4b5563"} strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
        )}

        <button
          onClick={handleOpenOptions}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          title="Open Library Ledger / Studio Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#64748b" : "#4b5563"} strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button
          onClick={handleClearDatabase}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          title="Wipe Dexie Index Database"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </footer>

      {/* Styled toast alerts */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '52px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(99, 102, 241, 0.95)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          pointerEvents: 'none'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '560px',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  padding: 0,
  margin: 0,
  position: 'relative',
  overflowX: 'hidden'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  zIndex: 10
};

const pipelineCanvasStyle: React.CSSProperties = {
  borderRadius: '12px',
  padding: '16px',
  margin: '12px 16px 8px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
};

const pipelineNodeStyle = (activeColor: string): React.CSSProperties => ({
  width: '54px',
  height: '54px',
  borderRadius: '50%',
  border: `1.5px solid ${activeColor}`,
  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.15)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  zIndex: 2,
  transition: 'all 0.3s ease',
  padding: '1px'
});

const pipelinePathStyle: React.CSSProperties = {
  flex: 1,
  height: '2px',
  position: 'relative',
  margin: '0 10px',
  zIndex: 1
};

const consoleCardStyle: React.CSSProperties = {
  borderRadius: '12px',
  padding: '16px',
  margin: '8px 16px 12px 16px',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
  borderWidth: '1px',
  borderStyle: 'solid'
};

const toggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderRadius: '6px',
  padding: '2px',
  marginBottom: '14px',
  borderWidth: '1px',
  borderStyle: 'solid'
};

const toggleBtnStyle = (_isActive: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 10px',
  border: 'none',
  borderRadius: '4px',
  fontSize: '11.5px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px'
});

const actionBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  borderRadius: '8px',
  background: '#4f46e5',
  color: '#ffffff',
  fontSize: '12.5px',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  marginTop: 'auto',
  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)'
};

const logoContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  borderRadius: '20px',
  padding: '3px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '8px',
  fontSize: '12.5px',
  outline: 'none',
  cursor: 'pointer',
  width: '100%'
};

const footerStyle: React.CSSProperties = {
  padding: '10px 16px',
  display: 'flex',
  justifyContent: 'space-around',
  marginTop: 'auto',
};

