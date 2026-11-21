/**
 * Iconos de la cabecera del cantoral: se leen en las tres plataformas y en
 * los dos modos. La cabecera es la del fondo de la pantalla (vidrio en iOS,
 * sólida en Android y web) y los botones van en el ámbar de acción.
 */
import fs from 'fs';
import path from 'path';
import {
  cantoralHeaderBackground,
  cantoralHeaderTint,
} from '@/utils/cantoralHeader';
import { themeColors } from '@/constants/colors';
import { contrastRatio } from '@/utils/colorUtils';

/** Mínimo para texto (los botones de la cabecera llevan texto, «Listo»…). */
const TEXT = 4.5;

describe('cantoralHeaderTint', () => {
  it.each(['ios', 'android', 'web'] as const)(
    'en %s se lee sobre la cabecera y el fondo, en los dos modos',
    (os) => {
      for (const isDark of [false, true]) {
        const c = cantoralHeaderTint(isDark, os);
        const t = themeColors(isDark);
        expect(
          contrastRatio(c, cantoralHeaderBackground(isDark)),
        ).toBeGreaterThanOrEqual(TEXT);
        expect(contrastRatio(c, t.backgroundSunken)).toBeGreaterThanOrEqual(
          TEXT,
        );
      }
    },
  );
});

describe('las pantallas del cantoral no deciden el color a mano', () => {
  const ROOT = path.join(__dirname, '..');
  it.each([
    'app/cancionero/_layout.tsx',
    'screens/CategoriesScreen.tsx',
    'screens/SongListScreen.tsx',
    'screens/SongDetailScreen.tsx',
  ])('%s usa cantoralHeaderTint', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(src).toContain('cantoralHeaderTint(');
    // Los dos valores de iOS escritos a mano eran justo el fallo en Android.
    expect(src).not.toMatch(/accentYellow|#3d79b9/i);
  });
});
