/**
 * Tema de heroui-native en tiempo de ejecución (nativo): las mismas variables
 * que `global.css` (web), con los valores de `constants/theme.ts` (dirección
 * A, «Escenario»). Se registran una vez y se cambia de esquema con
 * `syncHeroUITheme`.
 */
import { Uniwind } from 'uniwind';
import type { ThemeScheme } from '@/contexts/AppSettingsContext';
import { Palette } from '@/constants/theme';

const L = Palette.light;
const D = Palette.dark;

/** Tinta con transparencia (para los «hover» y «focus» de las superficies). */
const inkLight = (a: number) => `rgba(23, 20, 15, ${a})`;
const inkDark = (a: number) => `rgba(245, 240, 230, ${a})`;

const lightThemeVars = {
  '--color-background': L.background,
  '--color-foreground': L.text,
  '--color-surface': L.card,
  '--color-surface-foreground': L.text,
  '--color-surface-hover': inkLight(0.04),
  '--color-surface-secondary': L.cardRaised,
  '--color-surface-tertiary': L.backgroundSunken,
  '--color-overlay': L.card,
  '--color-overlay-foreground': L.text,
  '--color-muted': L.textMuted,
  '--color-default': L.backgroundSunken,
  '--color-default-foreground': L.text,
  '--color-accent': L.accent,
  '--color-accent-foreground': L.onAccent,
  '--color-accent-hover': '#ffc94f',
  '--color-accent-soft': L.accentSoft,
  '--color-accent-soft-foreground': L.accentText,
  '--color-accent-soft-hover': 'rgba(255, 190, 46, 0.3)',
  '--color-focus': L.accent,
  '--color-link': L.accentText,
  '--color-success': L.success,
  '--color-success-foreground': '#ffffff',
  '--color-warning': L.accent,
  '--color-warning-foreground': L.onAccent,
  '--color-danger': L.danger,
  '--color-danger-foreground': '#ffffff',
  '--color-danger-soft': 'rgba(198, 46, 35, 0.12)',
  '--color-danger-soft-foreground': L.danger,
  '--color-segment': L.card,
  '--color-segment-foreground': L.text,
  '--color-border': L.separator,
  '--color-separator': L.separator,
  '--color-field-background': L.card,
  '--color-field-foreground': L.text,
  '--color-field-placeholder': L.textMuted,
  '--color-field-border': L.separator,
  '--color-on-surface-foreground': L.text,
  '--color-on-surface-hover': inkLight(0.08),
  '--color-on-surface-focus': inkLight(0.12),
  '--color-on-surface-secondary': inkLight(0.08),
  '--color-on-surface-secondary-foreground': L.text,
  '--color-on-surface-secondary-hover': inkLight(0.12),
  '--color-on-surface-secondary-focus': inkLight(0.16),
  '--color-on-surface-tertiary': inkLight(0.12),
  '--color-on-surface-tertiary-foreground': L.text,
  '--color-on-surface-tertiary-hover': inkLight(0.16),
  '--color-on-surface-tertiary-focus': inkLight(0.2),
  '--color-separator-secondary': '#d2c8b4',
  '--color-separator-tertiary': '#c1b6a0',
  '--color-border-secondary': '#d2c8b4',
  '--color-border-tertiary': '#c1b6a0',
} as const;

const darkThemeVars = {
  '--color-background': D.background,
  '--color-foreground': D.text,
  '--color-surface': D.card,
  '--color-surface-foreground': D.text,
  '--color-surface-hover': inkDark(0.05),
  '--color-surface-secondary': D.cardRaised,
  '--color-surface-tertiary': D.separator,
  '--color-overlay': D.card,
  '--color-overlay-foreground': D.text,
  '--color-muted': D.textMuted,
  '--color-default': D.cardRaised,
  '--color-default-foreground': D.text,
  '--color-accent': D.accent,
  '--color-accent-foreground': D.onAccent,
  '--color-accent-hover': '#ffc94f',
  '--color-accent-soft': D.accentSoft,
  '--color-accent-soft-foreground': D.accentText,
  '--color-accent-soft-hover': 'rgba(255, 190, 46, 0.2)',
  '--color-focus': D.accent,
  '--color-link': D.accentText,
  '--color-success': D.success,
  '--color-success-foreground': D.background,
  '--color-warning': D.accent,
  '--color-warning-foreground': D.onAccent,
  '--color-danger': D.danger,
  '--color-danger-foreground': D.background,
  '--color-danger-soft': 'rgba(255, 107, 94, 0.16)',
  '--color-danger-soft-foreground': '#ff8177',
  '--color-segment': D.cardRaised,
  '--color-segment-foreground': D.text,
  '--color-border': D.separator,
  '--color-separator': D.separator,
  '--color-field-background': D.card,
  '--color-field-foreground': D.text,
  '--color-field-placeholder': D.textMuted,
  '--color-field-border': D.separator,
  '--color-on-surface': inkDark(0.08),
  '--color-on-surface-foreground': D.text,
  '--color-on-surface-hover': inkDark(0.12),
  '--color-on-surface-focus': inkDark(0.16),
  '--color-on-surface-secondary': inkDark(0.12),
  '--color-on-surface-secondary-foreground': D.text,
  '--color-on-surface-secondary-hover': inkDark(0.16),
  '--color-on-surface-secondary-focus': inkDark(0.2),
  '--color-on-surface-tertiary': inkDark(0.16),
  '--color-on-surface-tertiary-foreground': D.text,
  '--color-on-surface-tertiary-hover': inkDark(0.2),
  '--color-on-surface-tertiary-focus': inkDark(0.24),
  '--color-separator-secondary': '#4a443a',
  '--color-separator-tertiary': '#5c5548',
  '--color-border-secondary': '#4a443a',
  '--color-border-tertiary': '#5c5548',
} as const;

let runtimeThemeRegistered = false;

export function registerHeroUIRuntimeTheme() {
  if (runtimeThemeRegistered) {
    return;
  }

  Uniwind.updateCSSVariables('light', lightThemeVars);
  Uniwind.updateCSSVariables('dark', darkThemeVars);
  runtimeThemeRegistered = true;
}

export function syncHeroUITheme(theme: ThemeScheme) {
  registerHeroUIRuntimeTheme();
  Uniwind.setTheme(theme);
}
