/**
 * Guardarraíles del sistema de diseño de MCM Cantoral (`design.md`,
 * `constants/theme.ts`). Lo que se blinda:
 *
 *  1. `global.css` (tema de HeroUI en web) y `constants/theme.ts` dicen lo
 *     mismo: dos capas con los mismos nombres y distintos colores ya mordió.
 *  2. Contraste: interfaz ≥ 4,5:1; la letra del Atril ≥ 7:1 (AAA) en los
 *     cuatro temas, también al sol y en el escenario (`03` §6).
 *  3. Los acordes se distinguen también SIN color (peso), por daltonismo.
 *  4. Escalas ordenadas (espaciado, radios, sombras).
 *
 * Si añades un token, añade aquí su comprobación.
 */
import fs from 'fs';
import path from 'path';

import { Colors } from '@/constants/colors';
import { Palette, SheetPalette } from '@/constants/theme';
import { radii, shadows } from '@/constants/uiStyles';
import { SHEET_CSS } from '@/utils/songSheetLayout';
import { onColor } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';

const css = fs.readFileSync(path.join(__dirname, '..', 'global.css'), 'utf8');

function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(v)
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v;
}

function cssVar(name: string, mode: 'light' | 'dark'): string {
  const block =
    mode === 'light'
      ? css.slice(0, css.indexOf(":root[data-theme='dark']"))
      : css.slice(css.indexOf(":root[data-theme='dark']"));
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`No existe --${name} en global.css (${mode})`);
  return normalizeHex(match[1]);
}

describe('global.css deriva de constants/theme.ts', () => {
  for (const mode of ['light', 'dark'] as const) {
    const p = Palette[mode];
    const mapping: [string, string][] = [
      ['background', p.background],
      ['foreground', p.text],
      ['surface', p.card],
      ['muted', p.textMuted],
      ['accent', p.accent],
      ['accent-foreground', p.onAccent],
      ['focus', p.accent],
      ['link', p.accentText],
      ['danger', p.danger],
      ['success', p.success],
      ['separator', p.separator],
    ];
    it.each(mapping)(`${mode}: --%s cuadra`, (name, value) => {
      expect(cssVar(name, mode)).toBe(normalizeHex(value));
    });
  }

  it('constants/colors.ts sale de theme.ts (no es otra paleta)', () => {
    expect(Colors.dark.background).toBe(Palette.dark.background);
    expect(Colors.light.link).toBe(Palette.light.accentText);
  });
});

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contraste de la interfaz (≥ 4,5:1)', () => {
  for (const mode of ['light', 'dark'] as const) {
    const p = Palette[mode];
    const cases: [string, string, string][] = [
      ['text / fondo', p.text, p.background],
      ['textSecondary / fondo', p.textSecondary, p.background],
      ['textMuted / fondo', p.textMuted, p.background],
      ['textMuted / card', p.textMuted, p.card],
      ['textMuted / hundido', p.textMuted, p.backgroundSunken],
      ['accentText / fondo', p.accentText, p.background],
      ['accentText / card', p.accentText, p.card],
      ['onAccent / accent', p.onAccent, p.accent],
    ];
    it.each(cases)(`${mode}: %s`, (_l, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('el ámbar como relleno NO vale como texto sobre claro (por eso accentText)', () => {
    expect(contrast(Palette.light.accent, Palette.light.background)).toBeLessThan(
      4.5,
    );
  });

  it('onColor elige una tinta legible sobre el ámbar', () => {
    expect(
      contrast(onColor(Palette.light.accent), Palette.light.accent),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Atril: la letra ≥ 7:1 (AAA) en los cuatro temas', () => {
  it.each(Object.keys(SheetPalette) as (keyof typeof SheetPalette)[])(
    '%s',
    (id) => {
      const p = SheetPalette[id];
      expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.title, p.bg)).toBeGreaterThanOrEqual(7);
      // Acordes y etiquetas se leen (texto normal, 4,5:1).
      expect(contrast(p.chord, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.label, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('Escenario es negro real (OLED) y Sol, blanco y negro', () => {
    expect(SheetPalette.stage.bg).toBe('#000000');
    expect(SheetPalette.sun.bg).toBe('#FFFFFF');
    expect(SheetPalette.sun.text).toBe('#000000');
  });

  it('los acordes se distinguen también sin color: van en negrita', () => {
    const rule = SHEET_CSS.match(/\n\s*\.c \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toMatch(/font-weight:\s*700/);
  });
});

describe('escalas ordenadas', () => {
  it('spacing es estrictamente creciente', () => {
    const values = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('radii es estrictamente creciente', () => {
    const values = [
      radii.xs,
      radii.sm,
      radii.md,
      radii.lg,
      radii.xl,
      radii.full,
      radii.pillFull,
    ];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('el nombre de la sombra dice su intensidad', () => {
    const elevation = (s: unknown) =>
      (s as { elevation?: number }).elevation ?? 0;
    const values = [
      shadows.card,
      shadows.raised,
      shadows.hero,
      shadows.overlay,
    ].map(elevation);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});
