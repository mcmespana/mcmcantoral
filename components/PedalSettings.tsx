/**
 * Bloque «Pedal» para la hoja de Ajustes (`04-directo.md` §8): botones de
 * volumen como pedal, zona de prueba y el aviso del teclado de iOS. Se mete
 * como `children` de `AjustesSheet`.
 *
 * La zona de prueba escucha el pedal por su cuenta (`usePedal`), así que la
 * pantalla de debajo debe pasar `enabled: false` a su propio `usePedal`
 * mientras la hoja esté abierta, o recibiría también las pulsaciones.
 */
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { usePedal } from '@/hooks/usePedal';
import { usePedalSettings } from '@/hooks/usePedalSettings';
import { useTheme } from '@/hooks/useTheme';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import {
  PEDAL_ACTION_LABEL,
  volumeAllowedRemotely,
  type PedalAction,
} from '@/utils/pedalKeys';

export default function PedalSettings() {
  const t = useTheme();
  const styles = createStyles(t);
  const config = useCantoralConfig();
  const { settings, setSettings } = usePedalSettings();
  const [last, setLast] = useState<PedalAction | null>(null);

  const canUseVolume =
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    volumeAllowedRemotely(config, Platform.OS);

  const onAction = useCallback((a: PedalAction) => setLast(a), []);
  usePedal({ enabled: true, onAction });

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Pedal</Text>

      {canUseVolume ? (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Botones de volumen como pedal</Text>
            <Text style={styles.help}>
              Subir pasa a lo siguiente y bajar a lo anterior. Mientras esté
              activo no cambian el volumen.
            </Text>
          </View>
          <Switch
            value={settings.volumeButtons}
            onValueChange={(volumeButtons) => setSettings({ volumeButtons })}
            trackColor={{ false: t.separator, true: t.accent }}
            thumbColor={t.card}
            accessibilityLabel="Botones de volumen como pedal"
          />
        </View>
      ) : null}

      <View
        style={styles.testZone}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          last
            ? `Pulsa el pedal para probar. Última acción: ${PEDAL_ACTION_LABEL[last]}`
            : 'Pulsa el pedal para probar'
        }
      >
        <Text style={styles.testHint}>Pulsa el pedal para probar</Text>
        <Text style={[styles.testResult, last ? null : styles.testEmpty]}>
          {last ? PEDAL_ACTION_LABEL[last] : '—'}
        </Text>
      </View>

      {Platform.OS === 'ios' ? (
        <Text style={styles.help}>
          Con un pedal conectado, iOS esconde el teclado en pantalla y la
          búsqueda no se puede escribir. Casi todos los pedales tienen un botón
          para alternarlo.
        </Text>
      ) : null}
    </View>
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.min,
      marginBottom: spacing.md,
    },
    rowText: { flex: 1 },
    rowTitle: { ...typography.body, color: t.text },
    help: {
      ...typography.caption,
      color: t.textMuted,
      marginTop: spacing.xs,
    },
    testZone: {
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: TouchTarget.live,
      alignItems: 'center',
      justifyContent: 'center',
    },
    testHint: { ...typography.caption, color: t.textSecondary },
    testResult: {
      ...typography.h2,
      color: t.accentText,
      marginTop: spacing.xs,
    },
    testEmpty: { color: t.textMuted },
  });
