/**
 * Document Export Drivers for RelayOne AI
 * Handles client-side compiles and local file downloads for Markdown, Word, PDF, and JSON.
 */

import { jsPDF } from 'jspdf';
import { type Message, type Conversation } from '../database/local_db.ts';

/**
 * Triggers a client-side file download for a given Blob.
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to escape HTML characters in files that are parsed as HTML (like Word doc templates)
 * to prevent bracketed code fragments (e.g. <Props>, Vector<int>) from being swallowed.
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes conversation titles for safe local file naming, keeping spaces and unicode/foreign characters.
 */
function getSafeFilename(title: string, fallback: string = 'export'): string {
  return title.trim().replace(/[\/\\:*?"<>|]/g, '_') || fallback;
}

/**
 * Format markdown text to structured HTML that Word renders beautifully.
 * Converts code blocks, inline code, lists, and bold/italic text.
 */
function formatContentForWord(text: string): string {
  if (!text) return '';
  
  // 1. Escape HTML first to prevent any HTML injection or bracket swallowing
  let html = escapeHtml(text);
  
  // 2. Convert code blocks: ```lang ... ```
  html = html.replace(/```(\w*)\r?\n([\s\S]*?)\r?\n```/g, (_, lang, code) => {
    const langLabel = lang ? `<div style="font-size: 9pt; color: #a5b4fc; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif;">Code Block: ${lang}</div>` : '';
    return `
      <div style="background-color: #1e1e2e; padding: 14px; margin: 12px 0; border-left: 4px solid #6366f1; font-family: 'Consolas', 'Courier New', monospace; font-size: 10pt; color: #cdd6f4;">
        ${langLabel}
        <pre style="margin: 0; white-space: pre-wrap; font-family: 'Consolas', 'Courier New', monospace; color: #cdd6f4;">${code}</pre>
      </div>
    `;
  });

  // 3. Convert inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code style="font-family: \'Consolas\', \'Courier New\', monospace; background-color: #f1f5f9; color: #eb5757; padding: 2px 6px; font-size: 9.5pt; border: 1px solid #e2e8f0; border-radius: 4px;">$1</code>');

  // 4. Convert bold text: **text** or __text__
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([\s\S]+?)__/g, '<strong>$1</strong>');

  // 5. Convert italic text: *text* or _text_
  html = html.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([\s\S]+?)_/g, '<em>$1</em>');

  // 6. Convert bullet lists: lines starting with * or - followed by space
  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const content = trimmed.substring(2);
      let prefix = '';
      if (!inList) {
        inList = true;
        prefix = '<ul style="margin-top: 6px; margin-bottom: 6px; padding-left: 20px;">';
      }
      return `${prefix}<li style="margin-bottom: 4px;">${content}</li>`;
    } else {
      let suffix = '';
      if (inList) {
        inList = false;
        suffix = '</ul>';
      }
      return suffix + line;
    }
  });
  if (inList) {
    processedLines.push('</ul>');
  }
  html = processedLines.join('\n');

  // 7. Convert line breaks to <br/>
  html = html.split('\n').join('<br/>');

  return html;
}

/**
 * Draws formatted lines on jsPDF by dynamically switching styles for **bold** and `inline code`.
 */
function drawFormattedLine(
  doc: jsPDF,
  lineText: string,
  startX: number,
  y: number,
  baseFontSize: number,
  baseColor: { r: number; g: number; b: number }
): void {
  const parts = lineText.split('**');
  let currentX = startX;

  parts.forEach((part, index) => {
    const isBold = index % 2 === 1;
    doc.setFont('Helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(baseFontSize);
    
    const subparts = part.split('`');
    subparts.forEach((subpart, subIndex) => {
      const isCode = subIndex % 2 === 1;
      if (isCode) {
        doc.setFont('Courier', 'normal');
        doc.setTextColor(190, 24, 74); // pinkish-red inline code
      } else {
        doc.setFont('Helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(baseColor.r, baseColor.g, baseColor.b);
      }
      doc.text(subpart, currentX, y);
      currentX += doc.getTextWidth(subpart);
    });
  });
}

/**
 * Compiles a plain text Markdown document.
 */
export function exportToMarkdown(title: string, messages: Message[], conversation?: Conversation): void {
  console.log(`[Exporter] Compiling Markdown export for: ${title}`);
  
  const platformName = conversation
    ? (conversation.platform === 'chatgpt' ? 'ChatGPT' :
       conversation.platform === 'claude' ? 'Claude' :
       conversation.platform === 'gemini' ? 'Gemini' :
       conversation.platform === 'perplexity' ? 'Perplexity' :
       conversation.platform === 'grok' ? 'Grok' :
       conversation.platform.charAt(0).toUpperCase() + conversation.platform.slice(1))
    : 'ChatGPT';
    
  const createdDate = conversation && conversation.timestamp 
    ? new Date(conversation.timestamp).toLocaleString() 
    : new Date().toLocaleString();
    
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const updatedDate = lastMsg && lastMsg.timestamp 
    ? new Date(lastMsg.timestamp).toLocaleString() 
    : createdDate;
    
  const exportedDate = new Date().toLocaleString();
  const url = conversation?.url || 'https://chatgpt.com';

  chrome.storage.local.get(['settings'], (res) => {
    const userName = res.settings?.userName || 'RelayOne User';

    const contentArray: string[] = [
      `# ${platformName}`,
      '',
      `**User:** ${userName}`,
      `**Created:** ${createdDate}`,
      `**Updated:** ${updatedDate}`,
      `**Exported:** ${exportedDate}`,
      `**Link:** [${url}](${url})`,
      '',
      '## Response:',
      ''
    ];

    messages.forEach(msg => {
      if (msg.role === 'system') {
        contentArray.push(`*System info*:\n${msg.content}\n`);
      } else {
        const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
        contentArray.push(`${roleLabel}:\n${msg.content}\n`);
        
        if (msg.thinkingContent) {
          contentArray.push(`> *Reasoning Trace:*\n> ${msg.thinkingContent.split('\n').join('\n> ')}\n`);
        }
      }
      contentArray.push('---\n');
    });

    contentArray.push('Powered by RelayOne AI.');

    const blob = new Blob([contentArray.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    downloadFile(blob, `${getSafeFilename(title, 'chat_export')}.md`);
  });
}

/**
 * Exports the conversation metadata and messages array as a clean JSON schema file.
 */
export function exportToJSON(title: string, messages: Message[], conversation?: Conversation): void {
  console.log(`[Exporter] Compiling JSON dump for: ${title}`);
  
  const platformName = conversation?.platform || 'unknown';
  const createdDate = conversation && conversation.timestamp 
    ? new Date(conversation.timestamp).toISOString() 
    : new Date().toISOString();
    
  chrome.storage.local.get(['settings'], (res) => {
    const userName = res.settings?.userName || 'RelayOne User';

    const payload = {
      $schema: "https://relayone.ai/schemas/conversation-v2.json",
      metadata: {
        title: title,
        platform: platformName,
        sourceUrl: conversation?.url || null,
        exportedBy: userName,
        exportedAt: new Date().toISOString(),
        conversationStarted: createdDate,
        messageCount: messages.length
      },
      thread: messages.map((m, idx) => ({
        index: idx + 1,
        role: m.role,
        timestamp: new Date(m.timestamp).toISOString(),
        content: m.content,
        reasoningTrace: m.thinkingContent || null
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    downloadFile(blob, `${getSafeFilename(title, 'chat')}_export.json`);
  });
}

/**
 * Compiles a Microsoft Word document (.docx) using native HTML parsing triggers.
 */
export function exportToDocx(title: string, messages: Message[], conversation?: Conversation): void {
  console.log(`[Exporter] Compiling Docx file for: ${title}`);
  
  const platformName = conversation
    ? (conversation.platform === 'chatgpt' ? 'ChatGPT' :
       conversation.platform === 'claude' ? 'Claude' :
       conversation.platform === 'gemini' ? 'Gemini' :
       conversation.platform === 'perplexity' ? 'Perplexity' :
       conversation.platform === 'grok' ? 'Grok' :
       conversation.platform.charAt(0).toUpperCase() + conversation.platform.slice(1))
    : 'ChatGPT';
    
  const createdDate = conversation && conversation.timestamp 
    ? new Date(conversation.timestamp).toLocaleString() 
    : new Date().toLocaleString();
    
  const exportedDate = new Date().toLocaleString();
  const url = conversation?.url || 'https://chatgpt.com';

  const htmlHeader = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; padding: 30px; background-color: #ffffff; }
        h1 { color: #1e1b4b; border-bottom: 2px solid #e0e7ff; padding-bottom: 10px; font-size: 26px; font-weight: bold; margin-bottom: 15px; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .meta-cell { font-size: 11px; color: #4b5563; padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
        .meta-label { font-weight: bold; color: #4f46e5; width: 120px; text-transform: uppercase; letter-spacing: 0.05em; }
        
        .message-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .user-cell { 
          padding: 16px; 
          background-color: #f5f7ff; 
          border-left: 5px solid #4f46e5; 
          border-top: 1px solid #e0e7ff;
          border-right: 1px solid #e0e7ff;
          border-bottom: 1px solid #e0e7ff;
        }
        .assistant-cell { 
          padding: 16px; 
          background-color: #ffffff; 
          border-left: 5px solid #10b981; 
          border-top: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
        }
        .system-cell { 
          padding: 12px; 
          background-color: #f9fafb; 
          border-left: 5px solid #9ca3af; 
          border-top: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          color: #4b5563;
        }
        
        .role-header { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .user-header { color: #4f46e5; }
        .assistant-header { color: #10b981; }
        .system-header { color: #6b7280; }
        
        .message-content { font-size: 11.5px; color: #1f2937; }
        
        .thinking-box { 
          margin-top: 12px; 
          padding: 12px; 
          background-color: #f8fafc; 
          border-left: 3px solid #64748b; 
          font-style: italic; 
          color: #475569; 
          font-size: 10.5px;
        }
        
        .footer { 
          margin-top: 50px; 
          border-top: 1px solid #e5e7eb; 
          padding-top: 15px; 
          text-align: center; 
          font-size: 11px; 
          color: #9ca3af; 
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      
      <table class="meta-table">
        <tr>
          <td class="meta-cell meta-label">Platform</td>
          <td class="meta-cell">${platformName}</td>
        </tr>
        <tr>
          <td class="meta-cell meta-label">Created</td>
          <td class="meta-cell">${createdDate}</td>
        </tr>
        <tr>
          <td class="meta-cell meta-label">Exported</td>
          <td class="meta-cell">${exportedDate}</td>
        </tr>
        <tr>
          <td class="meta-cell meta-label">Source Link</td>
          <td class="meta-cell"><a href="${url}" style="color: #4f46e5; text-decoration: none;">${url}</a></td>
        </tr>
      </table>
  `;

  const htmlBody = messages.map(msg => {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    
    let cellClass = 'assistant-cell';
    let headerClass = 'role-header assistant-header';
    let roleLabel = 'Assistant Response';
    
    if (isUser) {
      cellClass = 'user-cell';
      headerClass = 'role-header user-header';
      roleLabel = 'User Prompt';
    } else if (isSystem) {
      cellClass = 'system-cell';
      headerClass = 'role-header system-header';
      roleLabel = 'System Log';
    }
    
    let block = `
      <table class="message-table">
        <tr>
          <td class="${cellClass}">
            <div class="${headerClass}">${roleLabel}</div>
            <div class="message-content">${formatContentForWord(msg.content)}</div>
    `;

    if (msg.thinkingContent) {
      block += `
            <div class="thinking-box">
              <strong style="font-style: normal; text-transform: uppercase; font-size: 9.5px; color: #64748b; display: block; margin-bottom: 4px;">Reasoning Trace:</strong>
              ${formatContentForWord(msg.thinkingContent)}
            </div>
      `;
    }

    block += `
          </td>
        </tr>
      </table>
    `;
    return block;
  }).join('\n');

  const htmlFooter = `
      <div class="footer">
        ---<br/>
        Powered by <strong>RelayOne AI</strong>.
      </div>
    </body>
    </html>
  `;

  const finalHtml = htmlHeader + htmlBody + htmlFooter;
  const blob = new Blob([finalHtml], { type: 'application/msword' });
  downloadFile(blob, `${getSafeFilename(title, 'chat_export')}.doc`);
}

/**
 * Compiles a formatted PDF document using jsPDF with page-wrapping margins.
 */
export function exportToPDF(
  title: string,
  messages: Message[],
  styles: { fontSize: number; theme: string; margin: number },
  conversation?: Conversation
): void {
  console.log(`[Exporter] Compiling PDF for: ${title}`, styles);
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = styles.margin; // in mm
  const printableWidth = pageWidth - (margin * 2);

  // Set initial Y layout cursor
  let currentY = 24;

  // Header Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(styles.fontSize + 6);
  
  // Custom theme accent coloring
  let accentColor = { r: 79, g: 70, b: 229 }; // Indigo
  if (styles.theme === 'sakura') {
    accentColor = { r: 219, g: 39, b: 119 }; // Pink Accent
  } else if (styles.theme === 'lavender') {
    accentColor = { r: 124, g: 58, b: 237 }; // Purple Accent
  } else if (styles.theme === 'emerald') {
    accentColor = { r: 5, g: 150, b: 105 }; // Emerald Accent
  }
  doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);

  // Handle Title string wrapping
  const splitTitle = doc.splitTextToSize(title, printableWidth);
  splitTitle.forEach((line: string) => {
    if (currentY + 10 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }
    doc.text(line, margin, currentY);
    currentY += 8;
  });

  // Print baseline border line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Add document platform metadata
  const platformName = conversation
    ? (conversation.platform === 'chatgpt' ? 'ChatGPT' :
       conversation.platform === 'claude' ? 'Claude' :
       conversation.platform === 'gemini' ? 'Gemini' :
       conversation.platform === 'perplexity' ? 'Perplexity' :
       conversation.platform === 'grok' ? 'Grok' :
       conversation.platform.charAt(0).toUpperCase() + conversation.platform.slice(1))
    : 'ChatGPT';

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(styles.fontSize - 3);
  doc.setTextColor(107, 114, 128);
  doc.text(`Platform: ${platformName}  |  Generated on ${new Date().toLocaleDateString()}`, margin, currentY);
  currentY += 10;

  // Loop message records
  messages.forEach(msg => {
    // Check height space before printing role headers
    if (currentY + 12 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }

    // Role block header labels
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(styles.fontSize);
    if (msg.role === 'user') {
      doc.setTextColor(79, 70, 229); // Indigo
      doc.text('USER PROMPT:', margin, currentY);
    } else if (msg.role === 'system') {
      doc.setTextColor(107, 114, 128); // Neutral Gray
      doc.text('SYSTEM NOTICE:', margin, currentY);
    } else {
      doc.setTextColor(16, 185, 129); // Emerald / Green
      doc.text('ASSISTANT RESPONSE:', margin, currentY);
    }
    currentY += 6;

    // Body content paragraphs
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(styles.fontSize - 1);
    doc.setTextColor(55, 65, 81);

    const paragraphs = msg.content.split('\n');
    let insideCodeBlock = false;

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      
      // Toggle code block
      if (trimmed.startsWith('```')) {
        insideCodeBlock = !insideCodeBlock;
        currentY += 2;
        return;
      }

      if (insideCodeBlock) {
        // Draw formatted code block line
        const lines = doc.splitTextToSize(para, printableWidth - 6);
        lines.forEach((line: string) => {
          if (currentY + 6 > pageHeight) {
            doc.addPage();
            currentY = 20;
          }
          // Draw code block row background
          doc.setFillColor(244, 244, 245);
          doc.rect(margin, currentY - 3.8, printableWidth, 5.2, 'F');
          
          // Draw left accent bar
          doc.setFillColor(99, 102, 241);
          doc.rect(margin, currentY - 3.8, 1.2, 5.2, 'F');

          doc.setFont('Courier', 'normal');
          doc.setFontSize(styles.fontSize - 2);
          doc.setTextColor(39, 39, 42);
          doc.text(line, margin + 4, currentY);
          currentY += 5;
        });
        return;
      }

      if (!para.trim()) {
        currentY += 4; // Blank paragraph lines
        return;
      }

      const lines = doc.splitTextToSize(para, printableWidth);
      lines.forEach((line: string) => {
        if (currentY + 6 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }
        
        // Draw normal line with custom inline bold/code markdown formatting!
        drawFormattedLine(doc, line, margin, currentY, styles.fontSize - 1, { r: 55, g: 65, b: 81 });
        currentY += 5;
      });
      currentY += 2.5; // Paragraph spacing
    });

    // Reasoning blocks
    if (msg.thinkingContent) {
      if (currentY + 12 > pageHeight) {
        doc.addPage();
        currentY = 20;
      }
      currentY += 2;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(styles.fontSize - 2);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('Reasoning Trace:', margin, currentY);
      currentY += 4;

      const thinkLines = doc.splitTextToSize(msg.thinkingContent, printableWidth - 4);
      thinkLines.forEach((line: string) => {
        if (currentY + 5 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }
        // Draw light grey box for thinking blocks
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY - 3.2, printableWidth, 4.4, 'F');

        // Draw slate grey left border
        doc.setFillColor(148, 163, 184);
        doc.rect(margin, currentY - 3.2, 0.8, 4.4, 'F');

        doc.setFont('Helvetica', 'oblique');
        doc.setFontSize(styles.fontSize - 2);
        doc.setTextColor(71, 85, 105);
        doc.text(line, margin + 3, currentY);
        currentY += 4;
      });
    }

    currentY += 8; // Space between message turns
  });

  // Second pass: Add dynamic running header separators and page indicator numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Running Header
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`RelayOne Export: ${title.length > 50 ? title.substring(0, 50) + '...' : title}`, margin, 12);
    
    doc.setDrawColor(241, 245, 249); // Slate 100
    doc.setLineWidth(0.1);
    doc.line(margin, 14, pageWidth - margin, 14);
    
    // Running Footer
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.1);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    
    doc.text('Powered by RelayOne AI', margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 8);
  }

  doc.save(`${getSafeFilename(title, 'chat_export')}.pdf`);
}
