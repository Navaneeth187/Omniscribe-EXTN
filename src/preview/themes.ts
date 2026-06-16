/**
 * Theme Presets for Omniscribe AI Options & Previews
 */

export interface ColorTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cardBg: string;
  cardBorder: string;
  accent: string;
  accentText: string;
  userBubble: string;
  userText: string;
  assistantBubble: string;
  assistantText: string;
  fontFamily: string;
}

export const THEME_PRESETS: Record<string, ColorTheme> = {
  slate: {
    id: 'slate',
    name: 'Sleek Slate (Default)',
    background: '#0f172a',
    foreground: '#f8fafc',
    cardBg: '#1e293b',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    accent: '#6366f1',
    accentText: '#ffffff',
    userBubble: '#312e81',
    userText: '#e0e7ff',
    assistantBubble: 'rgba(255, 255, 255, 0.03)',
    assistantText: '#f1f5f9',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  sakura: {
    id: 'sakura',
    name: 'Cherry Sakura',
    background: '#1f161e',
    foreground: '#fdf2f8',
    cardBg: '#2d1f2b',
    cardBorder: 'rgba(244, 114, 182, 0.15)',
    accent: '#db2777',
    accentText: '#ffffff',
    userBubble: '#831843',
    userText: '#fce7f3',
    assistantBubble: 'rgba(255, 255, 255, 0.02)',
    assistantText: '#fbcfe8',
    fontFamily: '"Georgia", serif'
  },
  lavender: {
    id: 'lavender',
    name: 'Royal Lavender',
    background: '#131124',
    foreground: '#f5f3ff',
    cardBg: '#1e1b3a',
    cardBorder: 'rgba(167, 139, 250, 0.15)',
    accent: '#7c3aed',
    accentText: '#ffffff',
    userBubble: '#4c1d95',
    userText: '#ede9fe',
    assistantBubble: 'rgba(255, 255, 255, 0.02)',
    assistantText: '#ddd6fe',
    fontFamily: '"Segoe UI", Roboto, sans-serif'
  },
  charcoal: {
    id: 'charcoal',
    name: 'Dark Charcoal',
    background: '#0a0a0a',
    foreground: '#e5e5e5',
    cardBg: '#171717',
    cardBorder: 'rgba(255, 255, 255, 0.04)',
    accent: '#a3a3a3',
    accentText: '#0a0a0a',
    userBubble: '#262626',
    userText: '#f5f5f5',
    assistantBubble: 'rgba(255, 255, 255, 0.01)',
    assistantText: '#e5e5e5',
    fontFamily: 'monospace'
  },
  emerald: {
    id: 'emerald',
    name: 'Deep Emerald',
    background: '#061c15',
    foreground: '#ecfdf5',
    cardBg: '#0b2f24',
    cardBorder: 'rgba(52, 211, 153, 0.12)',
    accent: '#10b981',
    accentText: '#061c15',
    userBubble: '#064e3b',
    userText: '#d1fae5',
    assistantBubble: 'rgba(255, 255, 255, 0.02)',
    assistantText: '#a7f3d0',
    fontFamily: 'system-ui, sans-serif'
  }
};
