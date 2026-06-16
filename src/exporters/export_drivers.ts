/**
 * Document Export Drivers for Omniscribe AI
 * Handles client-side compiles and local file downloads for Markdown, Word, PDF, and JSON.
 */

import { jsPDF } from 'jspdf';
import { type Message } from '../database/local_db.ts';

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
 * Compiles a plain text Markdown document.
 */
export function exportToMarkdown(title: string, messages: Message[]): void {
  console.log(`[Exporter] Compiling Markdown export for: ${title}`);
  
  const contentArray: string[] = [
    `# ${title}`,
    `*Exported via Omniscribe AI on ${new Date().toLocaleString()}*`,
    '\n---\n'
  ];

  messages.forEach(msg => {
    const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
    contentArray.push(`${roleLabel}:\n${msg.content}\n`);
    
    if (msg.thinkingContent) {
      contentArray.push(`> *Reasoning Trace:*\n> ${msg.thinkingContent.split('\n').join('\n> ')}\n`);
    }
    contentArray.push('---\n');
  });

  const blob = new Blob([contentArray.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  downloadFile(blob, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`);
}

/**
 * Exports the conversation metadata and messages array as a clean JSON schema file.
 */
export function exportToJSON(title: string, messages: Message[]): void {
  console.log(`[Exporter] Compiling JSON dump for: ${title}`);
  
  const payload = {
    title,
    exportedAt: Date.now(),
    messageCount: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      thinkingContent: m.thinkingContent || null,
      timestamp: m.timestamp
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_export.json`);
}

/**
 * Compiles a Microsoft Word document (.docx) using native HTML parsing triggers.
 */
export function exportToDocx(title: string, messages: Message[]): void {
  console.log(`[Exporter] Compiling Docx file for: ${title}`);
  
  const htmlHeader = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333333; padding: 20px; }
        h1 { color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; font-size: 24px; }
        .meta { color: #6b7280; font-size: 11px; margin-bottom: 20px; font-style: italic; }
        .message-block { margin-bottom: 24px; padding: 12px; border-radius: 6px; background-color: #f9fafb; border-left: 4px solid #d1d5db; }
        .user-block { border-left-color: #6366f1; background-color: #f5f3ff; }
        .role-title { font-weight: bold; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; color: #4b5563; }
        .user-block .role-title { color: #4f46e5; }
        .content { font-size: 12px; white-space: pre-wrap; }
        .thinking { font-style: italic; color: #6b7280; background-color: #f3f4f6; padding: 8px; border-left: 2px solid #9ca3af; margin-top: 8px; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Exported via Omniscribe AI on ${new Date().toLocaleString()}</div>
  `;

  const htmlBody = messages.map(msg => {
    const isUser = msg.role === 'user';
    const blockClass = isUser ? 'message-block user-block' : 'message-block';
    const roleLabel = isUser ? 'User Prompt' : 'Assistant Response';
    
    let block = `
      <div class="${blockClass}">
        <div class="role-title">${roleLabel}</div>
        <div class="content">${msg.content}</div>
    `;

    if (msg.thinkingContent) {
      block += `<div class="thinking"><strong>Reasoning Trace:</strong><br>${msg.thinkingContent}</div>`;
    }

    block += `</div>`;
    return block;
  }).join('\n');

  const htmlFooter = `
    </body>
    </html>
  `;

  const finalHtml = htmlHeader + htmlBody + htmlFooter;
  const blob = new Blob([finalHtml], { type: 'application/msword' });
  downloadFile(blob, `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.doc`);
}

/**
 * Compiles a formatted PDF document using jsPDF with page-wrapping margins.
 */
export function exportToPDF(
  title: string,
  messages: Message[],
  styles: { fontSize: number; theme: string; margin: number }
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
  if (styles.theme === 'sakura') {
    doc.setTextColor(219, 39, 119); // Pink Accent
  } else if (styles.theme === 'lavender') {
    doc.setTextColor(124, 58, 237); // Purple Accent
  } else if (styles.theme === 'emerald') {
    doc.setTextColor(5, 150, 105); // Emerald Accent
  } else {
    doc.setTextColor(79, 70, 229); // Standard Slate Indigo Accent
  }

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

  // Add document date
  doc.setFont('Helvetica', 'oblique');
  doc.setFontSize(styles.fontSize - 2);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, currentY);
  currentY += 10;

  // Loop message records
  messages.forEach(msg => {
    const isUser = msg.role === 'user';
    
    // Check height space before printing role headers
    if (currentY + 12 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }

    // Role block header labels
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(styles.fontSize);
    if (isUser) {
      doc.setTextColor(99, 102, 241); // Indigo
      doc.text('USER PROMPT:', margin, currentY);
    } else {
      doc.setTextColor(31, 41, 55); // Dark Gray
      doc.text('ASSISTANT RESPONSE:', margin, currentY);
    }
    currentY += 6;

    // Body content paragraphs
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(styles.fontSize - 1);
    doc.setTextColor(55, 65, 81);

    const paragraphs = msg.content.split('\n');
    paragraphs.forEach(para => {
      if (!para.trim()) return;

      const lines = doc.splitTextToSize(para, printableWidth);
      lines.forEach((line: string) => {
        if (currentY + 6 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(line, margin, currentY);
        currentY += 5;
      });
      currentY += 2; // paragraph spacing spacing
    });

    // Reasoning blocks
    if (msg.thinkingContent) {
      if (currentY + 8 > pageHeight) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(styles.fontSize - 2);
      doc.setTextColor(156, 163, 175);
      doc.text('Reasoning Trace:', margin, currentY);
      currentY += 4;

      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(styles.fontSize - 2);
      doc.setTextColor(107, 114, 128);
      
      const thinkLines = doc.splitTextToSize(msg.thinkingContent, printableWidth - 4);
      thinkLines.forEach((line: string) => {
        if (currentY + 5 > pageHeight) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(line, margin + 2, currentY);
        currentY += 4;
      });
    }

    currentY += 6; // Space between message blocks
  });

  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`);
}
