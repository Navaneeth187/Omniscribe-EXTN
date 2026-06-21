import { useEffect, useState } from 'react';
import { type Message } from '../database/local_db.ts';
import { THEME_PRESETS } from './themes.ts';
import { compileLaTeX } from '../sandbox/sandbox_client.ts';
import 'katex/dist/katex.min.css';

interface PreviewProps {
  messages: Message[];
  fontSize: number;
  theme: string;
  margin: number;
  lineHeight: number;
}

export default function Preview({ messages, fontSize, theme, margin, lineHeight }: PreviewProps) {
  const currentTheme = THEME_PRESETS[theme] || THEME_PRESETS.slate;
  const [renderedMessages, setRenderedMessages] = useState<Record<number, string>>({});

  // Parse and compile math strings inside messages when they change
  useEffect(() => {
    const processMessages = async () => {
      const processed: Record<number, string> = {};
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        let content = msg.content;

        // 1. Gather all block math formulas ($$.*?$$)
        const blockMatches: { raw: string; formula: string }[] = [];
        const blockRegex = /\$\$(.*?)\$\$/gs;
        let match;
        while ((match = blockRegex.exec(content)) !== null) {
          blockMatches.push({ raw: match[0], formula: match[1].trim() });
        }

        // Compile block math in parallel
        const compiledBlocks = await Promise.all(
          blockMatches.map(async (item) => {
            try {
              const html = await compileLaTeX(item.formula, true);
              return { raw: item.raw, html: `<div class="katex-display-block" style="margin: 12px 0; overflow-x: auto;">${html}</div>` };
            } catch (e) {
              console.error('[Preview] Block LaTeX compile failed:', e);
              return { raw: item.raw, html: `<div class="katex-display-block-error" style="color: #ef4444; margin: 12px 0;">${item.raw}</div>` };
            }
          })
        );

        // Replace block matches
        for (const item of compiledBlocks) {
          content = content.replace(item.raw, item.html);
        }

        // 2. Gather all inline math formulas ($[^$]+?$)
        const inlineMatches: { raw: string; formula: string }[] = [];
        const inlineRegex = /\$([^$]+?)\$/g;
        while ((match = inlineRegex.exec(content)) !== null) {
          inlineMatches.push({ raw: match[0], formula: match[1].trim() });
        }

        // Compile inline math in parallel
        const compiledInlines = await Promise.all(
          inlineMatches.map(async (item) => {
            try {
              const html = await compileLaTeX(item.formula, false);
              return { raw: item.raw, html: `<span class="katex-inline" style="display: inline-block;">${html}</span>` };
            } catch (e) {
              console.error('[Preview] Inline LaTeX compile failed:', e);
              return { raw: item.raw, html: `<span class="katex-inline-error" style="color: #ef4444;">${item.raw}</span>` };
            }
          })
        );

        // Replace inline matches
        for (const item of compiledInlines) {
          content = content.replace(item.raw, item.html);
        }

        // Basic line break formatting
        processed[i] = content.split('\n').join('<br/>');
      }

      setRenderedMessages(processed);
    };

    processMessages();
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      backgroundColor: currentTheme.background,
      color: currentTheme.foreground,
      fontFamily: currentTheme.fontFamily,
      padding: `${margin}mm`,
      minHeight: '400px',
      borderRadius: '8px',
      border: `1px solid ${currentTheme.cardBorder}`,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      overflowY: 'auto',
      transition: 'all 0.3s ease'
    }}>
      {/* Simulation Header Banners */}
      <div style={{
        borderBottom: `2px solid ${currentTheme.accent}`,
        paddingBottom: '8px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>
          DOCUMENT LAYOUT PREVIEW
        </span>
        <span style={{
          fontSize: '9px',
          color: currentTheme.accent,
          border: `1px solid ${currentTheme.accent}`,
          padding: '1px 6px',
          borderRadius: '4px',
          fontWeight: 600
        }}>
          {currentTheme.name.toUpperCase()}
        </span>
      </div>

      {messages.length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px',
          color: '#64748b',
          fontSize: '13px'
        }}>
          No conversation history loaded to preview.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '14px',
                  backgroundColor: isUser ? currentTheme.userBubble : currentTheme.assistantBubble,
                  border: isUser ? 'none' : `1px solid ${currentTheme.cardBorder}`,
                  borderRadius: '8px',
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight
                }}
              >
                {/* Message Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: isUser ? '#cbd5e1' : currentTheme.accent,
                  borderBottom: `1px solid ${isUser ? 'rgba(255, 255, 255, 0.08)' : currentTheme.cardBorder}`,
                  paddingBottom: '4px',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  <span>{isUser ? 'User Prompt' : 'AI Assistant'}</span>
                  <span style={{ fontWeight: 'normal', color: '#64748b', marginLeft: 'auto' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Body Text */}
                <div
                  className="omniscribe-preview-body"
                  style={{
                    color: isUser ? currentTheme.userText : currentTheme.assistantText,
                    wordBreak: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedMessages[index] || msg.content }}
                />

                {/* Reasoning Details */}
                {msg.thinkingContent && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderLeft: `2px solid ${currentTheme.accent}`,
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '4px',
                    fontSize: `${fontSize - 2}px`,
                    color: '#64748b',
                    fontStyle: 'italic'
                  }}>
                    <strong style={{ display: 'block', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontStyle: 'normal' }}>
                      Reasoning Chain:
                    </strong>
                    {msg.thinkingContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
