// Design system: colors, typography scale, spacing. Square corners everywhere.
import { TextStyle } from 'react-native';

export const colors = {
  background: '#F7F7F3',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFE9',
  text: '#20231F',
  textMuted: '#777B75',
  accent: '#376B4B',
  income: '#34764A',
  expense: '#B84C43',
  border: '#E4E5DF',
  white: '#FFFFFF',
  danger: '#B84C43',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const font: Record<string, TextStyle> = {
  screenTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  balance: { fontSize: 36, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  section: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  bodyMedium: { fontSize: 15, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },
  caption: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  button: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  // Tabular figures for aligned amounts where the platform supports it.
  amount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

export const radii = 0; // Mandatory: no rounded corners anywhere.

// Status-bar contrast helper: on the warm off-white background, white system
// status-bar icons (battery / time) are invisible, so every screen paints a
// dark forest-green band behind them and uses light ("inverted") icons.
export const STATUS_BAND_LIGHT = '#376B4B'; // top-band color for tab screens
export const STATUS_BAR_STYLE = 'light' as const; // light icons over dark band
