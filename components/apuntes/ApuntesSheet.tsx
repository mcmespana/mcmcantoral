/**
 * ✎ Apuntes de la canción (`05` §2): qué capas se ven en este dispositivo
 * (de serie, todas) y la lista de los apuntes, con los huérfanos arriba
 * («¿Dónde iba esto?») para recolocarlos.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { layerLabel, type Apunte, type ApunteLayer } from '@/services/apuntes';
import { INSTRUMENTOS } from '@/services/live/protocol';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

const ALL_LAYERS: ApunteLayer[] = [
  'todos',
  ...INSTRUMENTOS.map((i) => `inst:${i}` as ApunteLayer),
  'yo',
];

export default function ApuntesSheet({
  visible,
  onClose,
  notes,
  hidden,
  onHiddenChange,
  onEdit,
}: {
  visible: boolean;
  onClose: () => void;
  notes: Apunte[];
  hidden: ApunteLayer[];
  onHiddenChange: (h: ApunteLayer[]) => void;
  onEdit: (a: Apunte) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) => Number(!!b.orphan) - Number(!!a.orphan) || a.line - b.line,
      ),
    [notes],
  );
  // Solo las capas que esta canción usa (y siempre Todos / Solo yo).
  const used = new Set(notes.map((n) => n.layer));
  const layers = ALL_LAYERS.filter(
    (l) => l === 'todos' || l === 'yo' || used.has(l),
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Apuntes">
      <ScrollView>
        <Text style={styles.label}>Ver</Text>
        {layers.map((l) => (
          <View key={l} style={styles.row}>
            <Text style={styles.rowTitle}>{layerLabel(l)}</Text>
            <Switch
              value={!hidden.includes(l)}
              onValueChange={(on) =>
                onHiddenChange(
                  on ? hidden.filter((x) => x !== l) : [...hidden, l],
                )
              }
              trackColor={{ false: t.separator, true: t.accent }}
              thumbColor={t.card}
              accessibilityLabel={`Ver apuntes: ${layerLabel(l)}`}
            />
          </View>
        ))}

        <Text style={styles.label}>En esta canción</Text>
        {sorted.length === 0 ? (
          <Text style={styles.help}>
            Mantén pulsada una línea de la letra para apuntar algo en ella.
          </Text>
        ) : (
          sorted.map((n) => (
            <PressableFeedback
              key={n.id}
              onPress={() => onEdit(n)}
              style={styles.note}
              accessibilityRole="button"
              accessibilityLabel={`${layerLabel(n.layer)}: ${n.text}`}
            >
              <PressableFeedback.Highlight />
              <Text style={styles.noteMeta}>
                {n.orphan ? '¿Dónde iba esto? · ' : ''}
                {layerLabel(n.layer)}
              </Text>
              <Text style={styles.noteText} numberOfLines={2}>
                {n.text}
              </Text>
            </PressableFeedback>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    help: { ...typography.subhead, color: t.textMuted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: TouchTarget.min,
    },
    rowTitle: { ...typography.body, color: t.text },
    note: {
      minHeight: TouchTarget.min,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: t.card,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    noteMeta: { ...typography.overline, color: t.accentText },
    noteText: { ...typography.body, color: t.text },
  });
