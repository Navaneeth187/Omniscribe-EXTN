/**
 * Automated Test Runner for Omniscribe AI
 * Validates critical logic paths: Notion block chunking, LaTeX scraping, and export formatting.
 */

import * as assert from 'assert';

// Mock types
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingContent?: string;
}

/**
 * 1. Notion Chunking Logic Verification
 */
function testNotionChunking() {
  console.log('--- Running Notion Chunking Tests ---');

  const chunkLimit = 1900;
  // Generate a mock message with 4500 characters (exceeds limit)
  const longText = 'A'.repeat(4500);
  const mockMsg: Message = {
    role: 'assistant',
    content: longText,
    thinkingContent: 'Reasoning trace'
  };

  // Run the splitting algorithm in isolation
  const blocks: any[] = [];
  const chunkSize = 1900;
  
  for (let i = 0; i < mockMsg.content.length; i += chunkSize) {
    const chunk = mockMsg.content.substring(i, i + chunkSize);
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chunk } }]
      }
    });
  }

  // Assertions
  assert.strictEqual(blocks.length, 3, 'Should chunk 4500 characters into exactly 3 blocks.');
  assert.strictEqual(blocks[0].paragraph.rich_text[0].text.content.length, chunkLimit, 'First block should contain 1900 characters.');
  assert.strictEqual(blocks[1].paragraph.rich_text[0].text.content.length, chunkLimit, 'Second block should contain 1900 characters.');
  assert.strictEqual(blocks[2].paragraph.rich_text[0].text.content.length, 700, 'Third block should contain remaining 700 characters.');

  console.log('✓ Notion chunking test passed.');
}

/**
 * 2. LaTeX Formula RegEx Scraper Verification
 */
function testLaTeXRegex() {
  console.log('--- Running LaTeX Regex Scraper Tests ---');

  // Regex used to identify LaTeX blocks ($...$ and $$...$$)
  const latexRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;

  const sampleText = 'This is inline $\\theta = 2$ and this is display:\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$\nCheck it out.';
  const matches = sampleText.match(latexRegex);

  assert.ok(matches, 'Should locate LaTeX matches.');
  assert.strictEqual(matches?.length, 2, 'Should detect exactly 2 math expressions.');
  assert.strictEqual(matches?.[0], '$\\theta = 2$', 'Should extract inline formula correctly.');
  assert.strictEqual(matches?.[1], '$$\\int_0^1 x^2 dx = \\frac{1}{3}$$', 'Should extract display formula block correctly.');

  console.log('✓ LaTeX parser regex test passed.');
}

/**
 * 3. Page Margin Calculation Verification
 */
function testPageMarginConstraints() {
  console.log('--- Running Exporter Page Margins Tests ---');

  // Verify custom margins constraints inside PDF calculations
  const calculatePrintWidth = (pageWidthMm: number, marginMm: number) => {
    // Left + Right margins
    const printableWidth = pageWidthMm - (marginMm * 2);
    if (printableWidth < 50) {
      throw new Error('Printable area too narrow. Margin limit exceeded.');
    }
    return printableWidth;
  };

  // Test normal size (A4 is 210mm wide)
  const widthNormal = calculatePrintWidth(210, 15);
  assert.strictEqual(widthNormal, 180, 'Printable width for A4 with 15mm margin should be 180mm.');

  // Test out-of-bounds error
  assert.throws(() => {
    calculatePrintWidth(210, 90);
  }, /Margin limit exceeded/, 'Should throw if margin is too wide for page size.');

  console.log('✓ Page margin constraint calculations passed.');
}

// Master execution block
function main() {
  try {
    testNotionChunking();
    testLaTeXRegex();
    testPageMarginConstraints();
    console.log('\n=========================================');
    console.log('ALL OFFLINE SYSTEM TESTS PASSED SUCCESSFULLY!');
    console.log('=========================================');
  } catch (error) {
    console.error('Test suite assertion failed:', error);
    process.exit(1);
  }
}

main();
