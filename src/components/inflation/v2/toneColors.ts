// Shared tone palette for the v2 inflation dashboard.
// Status bands are derived from the Banrep inflation target (3% ±1).

export type Tone = 'high' | 'mid' | 'low' | 'neutral';

const TEXT_BY_TONE: Record<Tone, string> = {
  high: '#B02A37',
  low: '#188754',
  mid: '#212529',
  neutral: '#212529',
};

const BORDER_BY_TONE: Record<Tone, string> = {
  high: '#B02A37',
  low: '#188754',
  mid: '#FFC106',
  neutral: '#A6A6A6',
};

const ACCENT_BY_TONE: Record<Tone, string> = {
  high: '#B02A37',
  low: '#188754',
  mid: '#FFC106',
  neutral: '#A6A6A6',
};

const PILL_BG_BY_TONE: Record<'pos' | 'neg' | 'neutral', string> = {
  pos: '#FCE5E7',
  neg: '#DCEFE3',
  neutral: '#EDEDEF',
};

const PILL_TEXT_BY_TONE: Record<'pos' | 'neg' | 'neutral', string> = {
  pos: '#B02A37',
  neg: '#188754',
  neutral: '#3A3845',
};

const ROW_BG_BY_TONE: Record<Tone, string> = {
  high: '#FCE5E720',
  low: '#DCEFE320',
  mid: '#FFF3CD20',
  neutral: '#F5F5F7',
};

export const toneText = (t: Tone) => TEXT_BY_TONE[t];
export const toneBorder = (t: Tone) => BORDER_BY_TONE[t];
export const toneAccent = (t: Tone) => ACCENT_BY_TONE[t];
export const toneRowBg = (t: Tone) => ROW_BG_BY_TONE[t];

export type DirTone = 'pos' | 'neg' | 'neutral';

export const pillBg = (t: DirTone) => PILL_BG_BY_TONE[t];
export const pillText = (t: DirTone) => PILL_TEXT_BY_TONE[t];

export const TARGET = 3;
export const BAND = 1;

export const toneFromYoy = (yoy: number | null | undefined): Tone => {
  if (yoy == null || Number.isNaN(yoy)) return 'neutral';
  if (yoy > TARGET + BAND) return 'high';
  if (yoy < TARGET - BAND) return 'low';
  return 'mid';
};

export const dirToneFromDelta = (v: number | null | undefined): DirTone => {
  if (v == null || Number.isNaN(v)) return 'neutral';
  if (v > 0.005) return 'pos';
  if (v < -0.005) return 'neg';
  return 'neutral';
};
