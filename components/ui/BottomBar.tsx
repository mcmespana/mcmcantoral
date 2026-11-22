/**
 * Barra inferior de vidrio, contextual por pantalla (T-05: «me cargaría el FAB
 * y que sean unos botones abajo»). Sustituye a la barra de pestañas y al FAB:
 * lo frecuente vive aquí, al alcance del pulgar (`03-diseno-y-flujos.md` §2).
 *
 * Flota sobre el contenido; la pantalla reserva su hueco con
 * `BOTTOM_BAR_SPACE` + el área segura.
 */
import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableFeedback } from 'heroui-native';
import GlassSurface from '@/components/ui/GlassSurface';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** Alto de la barra (sin área segura): lo que una lista deja libre abajo. */
export const BOTTOM_BAR_SPACE = TouchTarget.min + spacing.md * 2;

export interface BottomBarItem {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Texto visible (en botones anchos) y etiqueta de accesibilidad. */
  label: string;
  onPress: () => void;
  /** Acción principal: relleno ámbar. */
  primary?: boolean;
  /** Ocupa el ancho que sobre, con el texto visible (p. ej. «Buscar…»). */
  grow?: boolean;
  /** Enseña el texto junto al icono aunque no crezca. */
  showLabel?: boolean;
  disabled?: boolean;
  /** Tamaño de directo (56 pt): guantes y prisa. */
  live?: boolean;
}

export default function BottomBar({
  items,
  style,
}: {
  items: BottomBarItem[];
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        style,
      ]}
    >
      <GlassSurface variant="regular" style={styles.bar}>
        {items.map((item) => {
          const size = item.live ? TouchTarget.live : TouchTarget.min;
          const fg = item.primary ? t.onAccent : t.text;
          return (
            <PressableFeedback
              key={item.key}
              isDisabled={item.disabled}
              onPress={() => {
                h.tap();
                item.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[
                styles.item,
                { minHeight: size, minWidth: size },
                item.grow && styles.grow,
                (item.grow || item.showLabel) && styles.withLabel,
                item.grow && { backgroundColor: t.cardRaised },
                item.primary && { backgroundColor: t.accent },
                item.disabled && styles.disabled,
              ]}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name={item.icon}
                size={item.live ? 28 : 22}
                color={item.grow ? t.textMuted : fg}
              />
              {item.grow || item.showLabel ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: item.grow ? t.textMuted : fg },
                    item.primary && styles.labelStrong,
                  ]}
                >
                  {item.label}
                </Text>
              ) : null}
            </PressableFeedback>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.pillFull,
    width: '100%',
    maxWidth: 640,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { position: 'relative' as const } : null),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pillFull,
    overflow: 'hidden',
  },
  grow: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  withLabel: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.subhead,
  },
  labelStrong: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
});
