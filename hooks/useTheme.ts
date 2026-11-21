import { useColorScheme } from '@/hooks/useColorScheme';
import { theme, type ThemeRoles } from '@/constants/theme';

/** Los roles de color del modo activo (`constants/theme.ts`). */
export function useTheme(): ThemeRoles & { isDark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { ...theme(isDark), isDark };
}
