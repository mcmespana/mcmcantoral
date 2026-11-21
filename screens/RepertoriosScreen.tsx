/**
 * Repertorios (`03-diseno-y-flujos.md` §3): los tuyos (el que estás usando,
 * primero) y los bloques del cantoral agrupados por evento. Crear uno nuevo
 * está en la barra de abajo.
 */
import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/components/ui/icons';
import BottomBar, { BOTTOM_BAR_SPACE } from '@/components/ui/BottomBar';
import EmptyState from '@/components/ui/EmptyState';
import { useTheme } from '@/hooks/useTheme';
import { useRepertorios } from '@/hooks/useRepertorios';
import { openCantoral } from '@/utils/cantoralNavigation';
import { repertorioMeta, shortDate } from '@/components/home/HomeSections';
import type { Repertorio } from '@/services/repertorios';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

interface Section {
  title: string;
  data: Repertorio[];
}

export default function RepertoriosScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const reps = useRepertorios();
  const [naming, setNaming] = useState<string | null>(null);

  const sections = useMemo<Section[]>(() => {
    const active = reps.list.find((r) => r.id === reps.activeId);
    const mine = active
      ? [active, ...reps.list.filter((r) => r.id !== active.id)]
      : reps.list;
    const out: Section[] = [{ title: 'Tus repertorios', data: mine }];
    const byEvent = new Map<string, Repertorio[]>();
    for (const p of reps.packs) {
      const key = p.event ?? 'Bloques del cantoral';
      byEvent.set(key, [...(byEvent.get(key) ?? []), p]);
    }
    for (const [title, data] of byEvent) out.push({ title, data });
    return out;
  }, [reps.list, reps.activeId, reps.packs]);

  const createNow = () => {
    const name = (naming ?? '').trim() || 'Nuevo repertorio';
    const rep = reps.create(name);
    setNaming(null);
    openCantoral('Repertorio', { id: rep.id });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Repertorios' }} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: BOTTOM_BAR_SPACE + insets.bottom + spacing.lg,
        }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          naming !== null ? (
            <View style={styles.newCard}>
              <TextInput
                autoFocus
                value={naming}
                onChangeText={setNaming}
                placeholder="Nombre (Eucaristía 23 nov, Ensayo…)"
                placeholderTextColor={t.textMuted}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={createNow}
                accessibilityLabel="Nombre del repertorio"
              />
              <PressableFeedback
                onPress={createNow}
                style={styles.createButton}
                accessibilityRole="button"
                accessibilityLabel="Crear repertorio"
              >
                <PressableFeedback.Highlight />
                <Text style={styles.createText}>Crear</Text>
              </PressableFeedback>
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => {
          const d = reps.durationOf(item);
          const active = item.id === reps.activeId;
          const last = index === section.data.length - 1;
          return (
            <PressableFeedback
              onPress={() => openCantoral('Repertorio', { id: item.id })}
              style={[
                styles.row,
                index === 0 && styles.first,
                last && styles.last,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}${active ? ', el que estás usando' : ''}`}
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name={item.readOnly ? 'library-music' : 'queue-music'}
                size={22}
                color={active ? t.accentText : t.icon}
              />
              <View style={[styles.rowBody, !last && styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.date ? `${shortDate(item.date)} · ` : ''}
                    {repertorioMeta(item, d.seconds, d.unknownSongs)}
                  </Text>
                </View>
                {active ? <Text style={styles.badge}>EN USO</Text> : null}
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={t.textMuted}
                />
              </View>
            </PressableFeedback>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="queue-music"
            title="Sin repertorios"
            subtitle="Crea uno para la misa, el ensayo o el directo."
          />
        }
      />
      <BottomBar
        items={[
          {
            key: 'new',
            icon: 'add',
            label: 'Nuevo repertorio',
            primary: true,
            grow: false,
            showLabel: true,
            onPress: () => {
              h.tap();
              setNaming('');
            },
          },
          {
            key: 'import',
            icon: 'qr-code-scanner',
            label: 'Importar',
            showLabel: true,
            onPress: () => openCantoral('SelectedSongs', { hoja: 'importar' }),
          },
        ]}
      />
    </View>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    flex: { flex: 1 },
    sectionLabel: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingLeft: spacing.md,
      backgroundColor: t.card,
      minHeight: TouchTarget.min + spacing.md,
      overflow: 'hidden',
    },
    first: {
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    last: {
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
    },
    rowBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingRight: spacing.md,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.separator,
    },
    rowTitle: { ...typography.body, fontWeight: '600', color: t.text },
    rowMeta: { ...typography.caption, color: t.textMuted, marginTop: 2 },
    badge: {
      ...typography.overline,
      color: t.accentText,
    },
    newCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: radii.lg,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: t.text,
      paddingHorizontal: spacing.sm,
      minHeight: TouchTarget.min,
    },
    createButton: {
      backgroundColor: t.accent,
      borderRadius: radii.pillFull,
      paddingHorizontal: spacing.lg,
      minHeight: TouchTarget.min,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    createText: { ...typography.button, color: t.onAccent },
  });
