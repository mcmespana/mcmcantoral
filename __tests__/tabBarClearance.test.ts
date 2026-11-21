/**
 * Hueco al final de una pantalla (`hooks/useTabBarClearance.ts`).
 *
 * MCM Cantoral no tiene barra de pestañas (T-05): el único hueco que hay que
 * dejar abajo es el área segura del sistema más el respiro de la pantalla,
 * igual en todas las plataformas.
 */
import { tabBarPaddingBottom } from '@/hooks/useTabBarClearance';

describe('tabBarPaddingBottom', () => {
  it('es el área segura más el respiro, en cualquier plataforma', () => {
    expect(tabBarPaddingBottom('ios', 34, 24)).toBe(58);
    expect(tabBarPaddingBottom('android', 24, 24)).toBe(48);
    expect(tabBarPaddingBottom('web', 0, 24)).toBe(24);
  });
});
