import { Palette, SheetPalette } from '@/constants/theme';
import { useEffect } from 'react';
import { Platform } from 'react-native';

interface StatusBarConfig {
  themeColor: string;
  statusBarStyle: 'default' | 'black' | 'black-translucent';
}

interface PageThemeConfig {
  [key: string]: StatusBarConfig;
}

// Color de la barra del navegador (PWA en iOS). MCM Cantoral no tiene
// colores por sección: la tinta del tema; la pantalla completa, negro real.
const PAGE_THEMES: PageThemeConfig = {
  '/': {
    themeColor: Palette.dark.background,
    statusBarStyle: 'black-translucent',
  },
  '/cancionero/pantalla-completa': {
    themeColor: SheetPalette.stage.bg,
    statusBarStyle: 'black-translucent',
  },
};

/**
 * Hook para configurar dinámicamente el color de la barra de estado en iOS
 * según la página actual
 */
export function useStatusBarTheme(pathname: string) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Detectar si estamos en iOS Safari standalone
    const isIOS = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);

    if (!isIOS) return;

    // Obtener configuración para la página actual
    const config = PAGE_THEMES[pathname] || PAGE_THEMES['/'];

    // Actualizar theme-color meta tag
    let themeColorMeta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = config.themeColor;

    // Actualizar apple-mobile-web-app-status-bar-style
    let statusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    ) as HTMLMetaElement;
    if (!statusBarMeta) {
      statusBarMeta = document.createElement('meta');
      statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(statusBarMeta);
    }
    statusBarMeta.content = config.statusBarStyle;

    // También actualizar msapplication-navbutton-color para otros navegadores
    let navButtonMeta = document.querySelector(
      'meta[name="msapplication-navbutton-color"]',
    ) as HTMLMetaElement;
    if (!navButtonMeta) {
      navButtonMeta = document.createElement('meta');
      navButtonMeta.name = 'msapplication-navbutton-color';
      document.head.appendChild(navButtonMeta);
    }
    navButtonMeta.content = config.themeColor;
  }, [pathname]);
}

/**
 * Función para obtener el color del tema de una página específica
 */
export function getPageThemeColor(pathname: string): string {
  return PAGE_THEMES[pathname]?.themeColor || PAGE_THEMES['/'].themeColor;
}

/**
 * Función para actualizar manualmente el theme color
 */
export function updateThemeColor(
  color: string,
  statusBarStyle:
    'default' | 'black' | 'black-translucent' = 'black-translucent',
) {
  if (Platform.OS !== 'web') return;

  // Actualizar theme-color
  const themeColorMeta = document.querySelector(
    'meta[name="theme-color"]',
  ) as HTMLMetaElement;
  if (themeColorMeta) {
    themeColorMeta.content = color;
  }

  // Actualizar status bar style
  const statusBarMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  ) as HTMLMetaElement;
  if (statusBarMeta) {
    statusBarMeta.content = statusBarStyle;
  }

  // Actualizar nav button color
  const navButtonMeta = document.querySelector(
    'meta[name="msapplication-navbutton-color"]',
  ) as HTMLMetaElement;
  if (navButtonMeta) {
    navButtonMeta.content = color;
  }
}

export default useStatusBarTheme;
