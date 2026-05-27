const DEFAULT_PALETTE: Record<string, string> = {
  '--brand-50': '#f0f9ff',
  '--brand-100': '#e0f2fe',
  '--brand-500': '#0ea5e9',
  '--brand-600': '#0284c7',
  '--brand-700': '#0369a1',
};

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateBrandPalette(primaryHex: string): Record<string, string> {
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryHex)) return { ...DEFAULT_PALETTE };
  const [h, s] = hexToHsl(primaryHex);
  return {
    '--brand-50':  hslToHex(h, Math.min(s, 80), 97),
    '--brand-100': hslToHex(h, Math.min(s, 80), 93),
    '--brand-500': hslToHex(h, s, 50),
    '--brand-600': hslToHex(h, s, 40),
    '--brand-700': hslToHex(h, s, 30),
  };
}

export function applyBrandColors(primaryHex: string | null | undefined) {
  const palette = primaryHex ? generateBrandPalette(primaryHex) : { ...DEFAULT_PALETTE };
  for (const [key, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty(key, value);
  }
}
