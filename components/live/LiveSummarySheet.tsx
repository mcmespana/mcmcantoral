/**
 * Resumen al cerrar un directo (idea I-07, `04-directo.md` §10.3): lo que se
 * cantó, cuánto duró cada canción de verdad y el total. Se puede guardar como
 * repertorio («lo que cantamos en 2026») para preparar el año siguiente.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useLive, type LiveSummary } from '@/contexts/LiveContext';
import { useToast } from '@/contexts/AppToastContext';
import {
  newId,
  repertoriosStore,
  type Repertorio,
} from '@/services/repertorios';
import { formatDuration } from '@/utils/songCategories';
import { localIsoDate } from '@/utils/cantoralConfig';
import { openCantoral } from '@/utils/cantoralNavigation';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** El resumen como repertorio: lo cantado, en orden, con su categoría. */
export function summaryToRepertorio(sum: LiveSummary, now: number): Repertorio {
  const byFile = new Map(sum.items.map((i) => [i.filename, i]));
  return {
    id: newId(now),
    name: `${sum.name} · cantado`,
    date: localIsoDate(new Date(now)),
    updatedAt: now,
    items: sum.entries.map((e) => {
      const it = byFile.get(e.filename);
      return {
        category: it?.category ?? '',
        filename: e.filename,
        title: e.title ?? it?.title,
        transpose: it?.transpose,
        capo: it?.capo,
        duration: formatDuration(Math.round(e.ms / 1000)),
      };
    }),
  };
}

export default function LiveSummarySheet() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const { toast } = useToast();
  const sum = live.lastSummary;

  const save = () => {
    if (!sum) return;
    const rep = repertoriosStore.create(summaryToRepertorio(sum, Date.now()), {
      activate: false,
    });
    h.success();
    toast.show({ label: 'Guardado en Repertorios' });
    live.clearSummary();
    openCantoral('Repertorio', { id: rep.id });
  };

  return (
    <BottomSheet
      visible={!!sum}
      onClose={live.clearSummary}
      title="Lo que habéis cantado"
    >
      {sum ? (
        <ScrollView>
          <Text style={styles.head}>
            {sum.name} · {sum.songs} {sum.songs === 1 ? 'canción' : 'canciones'}{' '}
            · {formatDuration(Math.round(sum.totalMs / 1000))}
          </Text>
          {sum.entries.map((e, i) => (
            <View key={`${e.filename}-${i}`} style={styles.row}>
              <Text style={styles.n}>{i + 1}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {e.title ?? e.filename}
              </Text>
              <Text style={styles.time}>
                {formatDuration(Math.round(e.ms / 1000))}
              </Text>
            </View>
          ))}
          <PressableFeedback
            onPress={save}
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Guardar como repertorio"
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="library-add" size={22} color={t.onAccent} />
            <Text style={styles.primaryText}>Guardar como repertorio</Text>
          </PressableFeedback>
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    head: {
      ...typography.subhead,
      color: t.textSecondary,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.min,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.separator,
    },
    n: { ...typography.caption, color: t.textMuted, width: 24 },
    title: { ...typography.body, color: t.text, flex: 1 },
    time: { ...typography.subhead, color: t.textSecondary },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.live,
      borderRadius: radii.pillFull,
      backgroundColor: t.accent,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    primaryText: { ...typography.title, color: t.onAccent, fontWeight: '700' },
  });
