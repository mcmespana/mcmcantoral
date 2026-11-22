/**
 * Ajustes de la app (`03-diseno-y-flujos.md` §3): tema, cómo te llamas en el
 * coro, el directo (qué tocas, reacciones), el pedal, «Soy administrador» y
 * la versión. Lo de la hoja de canción (letra, acordes, notación) vive
 * en «Aa» dentro del Atril.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import BottomSheet from '@/components/BottomSheet';
import SegmentedControl from '@/components/ui/SegmentedControl';
import {
  useAppSettings,
  type ThemeScheme,
} from '@/contexts/AppSettingsContext';
import { useTheme } from '@/hooks/useTheme';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { APP_NAME } from '@/constants/appLinks';
import LivePrefsSettings from '@/components/live/LivePrefsSettings';
import PedalSettings from '@/components/PedalSettings';
import AdminCodeSettings from '@/components/AdminCodeSettings';

export default function AjustesSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Más filas (p. ej. «Soy administrador», `06`). */
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const styles = createStyles(t);
  const { settings, setSettings } = useAppSettings();
  const version = String(Constants.expoConfig?.version ?? '');
  const update = Updates.updateId ? ` · ${Updates.updateId.slice(0, 7)}` : '';

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajustes">
      <View style={styles.block}>
        <Text style={styles.label}>Tema</Text>
        <SegmentedControl<ThemeScheme>
          options={[
            { value: 'dark', label: 'Oscuro', icon: 'dark-mode' },
            { value: 'light', label: 'Claro', icon: 'light-mode' },
            { value: 'system', label: 'Sistema', icon: 'brightness-auto' },
          ]}
          value={settings.theme}
          onChange={(theme) => setSettings({ theme })}
          accentColor={t.accent}
          accessibilityLabel="Tema de la app"
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>¿Cómo te llamas en el coro?</Text>
        <TextInput
          value={settings.choirName}
          onChangeText={(choirName) => setSettings({ choirName })}
          placeholder="Opcional: lo verá quien dirige"
          placeholderTextColor={t.textMuted}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={40}
          accessibilityLabel="Tu nombre en el coro"
        />
        <Text style={styles.help}>
          Solo se guarda en este dispositivo. Sale en los directos y en los
          fallitos que mandes.
        </Text>
      </View>

      <LivePrefsSettings />
      <PedalSettings />
      <AdminCodeSettings />

      {children}

      <Text style={styles.version}>
        {APP_NAME} {version}
        {update}
      </Text>
    </BottomSheet>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    block: { marginBottom: spacing.lg },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginBottom: spacing.sm,
    },
    input: {
      ...typography.body,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      minHeight: TouchTarget.min,
    },
    help: {
      ...typography.caption,
      color: t.textMuted,
      marginTop: spacing.xs,
    },
    version: {
      ...typography.caption,
      color: t.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
  });
