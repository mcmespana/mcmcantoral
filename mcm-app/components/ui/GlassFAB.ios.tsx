import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';
import GlassSurface from './GlassSurface';

interface GlassFABProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  tintColor?: string;
  iconColor?: string;
  size?: number;
  style?: ViewStyle;
}

/**
 * iOS-only glass FAB. Delegates the glass effect to GlassSurface so the
 * brightness / LiquidGlass-vs-BlurView decision lives in one place.
 */
export default function GlassFAB({
  icon,
  onPress,
  tintColor = '#f4c11e',
  iconColor = '#222',
  size = 24,
  style,
}: GlassFABProps) {
  return (
    <PressableFeedback onPress={onPress} style={[styles.fab, style]}>
      <PressableFeedback.Scale />
      <GlassSurface tintColor={tintColor} variant="regular" />
      <MaterialIcons name={icon} size={size} color={iconColor} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 1000,
    ...(shadows.lg as ViewStyle),
  },
});
