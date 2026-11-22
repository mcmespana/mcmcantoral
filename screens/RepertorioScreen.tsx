/**
 * Un repertorio (`03-diseno-y-flujos.md` §4.3): cada canción con su tono,
 * cejilla y notas del día, las pausas («homilía», «presentación de la
 * hucha») y la duración total. Abajo, **▶ Empezar** (yo solo, pasando
 * canciones) y **Editar** (la pantalla de la selección de siempre); en el
 * «⋯», duplicar, renombrar y borrar.
 *
 * Un bloque del cantoral (`songs/packs`) es de solo lectura: al empezarlo se
 * usa una copia con el transporte calculado hasta el tono del día.
 */
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomBar, { BOTTOM_BAR_SPACE } from '@/components/ui/BottomBar';
import EmptyState from '@/components/ui/EmptyState';
import ContextMenuSheet, {
  type ContextMenuAction,
} from '@/components/ContextMenuSheet';
import { useTheme } from '@/hooks/useTheme';
import { useRepertorios } from '@/hooks/useRepertorios';
import { useLive } from '@/contexts/LiveContext';
import LiveStartSheet from '@/components/live/LiveStartSheet';
import { useSettings } from '@/contexts/SettingsContext';
import { openCantoral } from '@/utils/cantoralNavigation';
import { songNavItemFromEntry, songRouteParams } from '@/utils/songNavList';
import { transposeKey } from '@/utils/transposeKey';
import { convertChord } from '@/utils/chordNotation';
import {
  isBreak,
  isSong,
  type Repertorio,
  type RepertorioSongItem,
} from '@/services/repertorios';
import {
  repertorioDurationLabel,
  shortDate,
} from '@/components/home/HomeSections';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

export default function RepertorioScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reps = useRepertorios();
  const rep = reps.byId(typeof id === 'string' ? id : undefined);
  const { settings } = useSettings();
  const [menu, setMenu] = useState(false);
  const [directing, setDirecting] = useState<Repertorio | null>(null);
  const live = useLive();
  const [renaming, setRenaming] = useState<string | null>(null);

  const duration = rep ? reps.durationOf(rep) : null;
  // Número de canción de cada elemento (las pausas no cuentan).
  const songNumbers: number[] = [];
  {
    let n = 0;
    for (const it of rep?.items ?? []) songNumbers.push(isBreak(it) ? -1 : n++);
  }

  /** Tono que se verá: el del día, o el original transportado. */
  const keyLabel = (item: RepertorioSongItem): string => {
    const song = reps.findSong(item);
    const key = item.key
      ? item.key
      : item.transpose
        ? transposeKey(song?.key, item.transpose)
        : song?.key;
    const parts: string[] = [];
    if (key) parts.push(convertChord(key, settings.notation));
    const capo = item.capo ?? song?.capo;
    if (capo) parts.push(`C${capo}`);
    return parts.join(' · ');
  };

  /** Abre la canción `index` (de las canciones) con el repertorio activo. */
  const start = (fromSong = 0) => {
    if (!rep) return;
    const active = reps.activate(rep);
    const songs = active.items.filter(isSong);
    const list = songs
      .map((it) => {
        const entry = reps.findSong(it);
        return entry?.filename
          ? songNavItemFromEntry({ ...entry, filename: entry.filename })
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const first = songs[fromSong];
    if (!first || !list.length) return;
    h.tap();
    openCantoral(
      'SongDetail',
      songRouteParams({
        filename: first.filename,
        list,
        currentIndex: Math.min(fromSong, list.length - 1),
        source: 'selection',
        firebaseCategory: first.category || undefined,
      }),
    );
  };

  const edit = () => {
    if (!rep) return;
    reps.activate(rep);
    openCantoral('SelectedSongs');
  };

  if (!rep) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Repertorio' }} />
        <EmptyState
          icon="queue-music"
          title="No encontramos este repertorio"
          subtitle="Puede que se haya borrado. Vuelve a Repertorios."
        />
      </View>
    );
  }

  const menuActions: ContextMenuAction[] = [
    {
      key: 'duplicate',
      label: rep.readOnly ? 'Guardar una copia' : 'Duplicar',
      icon: 'content-copy',
      onPress: () => {
        const copy = reps.duplicate(rep);
        router.replace({
          pathname: '/cancionero/repertorio',
          params: { id: copy.id },
        });
      },
    },
    ...(rep.readOnly
      ? []
      : [
          {
            key: 'rename',
            label: 'Renombrar',
            icon: 'edit' as const,
            onPress: () => setRenaming(rep.name),
          },
          {
            key: 'delete',
            label: 'Borrar',
            icon: 'delete-outline' as const,
            destructive: true,
            onPress: () => {
              const go = () => {
                reps.remove(rep.id);
                router.back();
              };
              if (Platform.OS === 'web') go();
              else
                Alert.alert(`¿Borrar «${rep.name}»?`, undefined, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Borrar', style: 'destructive', onPress: go },
                ]);
            },
          },
        ]),
  ];

  const meta = [
    rep.date ? shortDate(rep.date) : null,
    rep.choir?.name ?? rep.event ?? null,
    `${rep.items.filter(isSong).length} canciones`,
    duration && duration.seconds > 0
      ? `${duration.unknownSongs ? '~' : ''}${repertorioDurationLabel(duration.seconds)}`
      : null,
    rep.targetMinutes ? `previsto ${rep.targetMinutes} min` : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: rep.name }} />
      <FlatList
        data={rep.items}
        keyExtractor={(it, i) => (isBreak(it) ? `b${i}` : `${it.filename}${i}`)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: BOTTOM_BAR_SPACE + insets.bottom + spacing.lg,
        }}
        ListHeaderComponent={
          <View style={styles.head}>
            {renaming !== null ? (
              <TextInput
                autoFocus
                value={renaming}
                onChangeText={setRenaming}
                onSubmitEditing={() => {
                  reps.rename(rep.id, renaming);
                  setRenaming(null);
                }}
                onBlur={() => setRenaming(null)}
                style={styles.renameInput}
                returnKeyType="done"
                accessibilityLabel="Nuevo nombre"
              />
            ) : (
              <Text style={styles.title} accessibilityRole="header">
                {rep.name}
              </Text>
            )}
            <Text style={styles.meta}>{meta.join(' · ')}</Text>
            {rep.readOnly ? (
              <Text style={styles.readOnly}>
                Bloque del cantoral: al empezarlo se usa una copia con el tono
                del día.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index: itemIndex }) => {
          if (isBreak(item)) {
            return (
              <View style={styles.breakRow} accessibilityRole="text">
                <View style={styles.breakLine} />
                <Text style={styles.breakText}>
                  {item.title}
                  {item.minutes ? ` · ${item.minutes} min` : ''}
                </Text>
                <View style={styles.breakLine} />
              </View>
            );
          }
          const index = songNumbers[itemIndex];
          const song = reps.findSong(item);
          const title = song?.title ?? item.title ?? item.filename;
          const keys = keyLabel(item);
          return (
            <PressableFeedback
              onPress={() => start(index)}
              style={styles.songRow}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${title}${keys ? `, ${keys}` : ''}`}
            >
              <PressableFeedback.Highlight />
              <Text style={styles.num}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text
                  style={[styles.songTitle, !song && styles.missing]}
                  numberOfLines={2}
                >
                  {title.replace(/^\d+\.\s*/, '')}
                </Text>
                {item.notes || !song ? (
                  <Text style={styles.notes} numberOfLines={2}>
                    {!song ? 'No está en tu cantoral · ' : ''}
                    {item.notes ?? ''}
                  </Text>
                ) : null}
              </View>
              {keys ? <Text style={styles.keys}>{keys}</Text> : null}
            </PressableFeedback>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="library-add"
            title="Repertorio vacío"
            subtitle="Pulsa «Editar» y añade canciones desde el cantoral."
          />
        }
      />
      <BottomBar
        items={[
          {
            key: 'start',
            icon: 'play-arrow',
            label: 'Empezar',
            primary: true,
            showLabel: true,
            disabled: !rep.items.some(isSong),
            onPress: () => start(0),
          },
          ...(live.role === 'off'
            ? [
                {
                  key: 'direct',
                  icon: 'sensors' as const,
                  label: 'Dirigir',
                  showLabel: true,
                  disabled: !rep.items.some(isSong),
                  onPress: () => setDirecting(reps.activate(rep)),
                },
              ]
            : []),
          ...(rep.readOnly
            ? []
            : [
                {
                  key: 'edit',
                  icon: 'edit' as const,
                  label: 'Editar',
                  showLabel: true,
                  onPress: edit,
                },
              ]),
          {
            key: 'more',
            icon: 'more-horiz',
            label: 'Más opciones',
            onPress: () => setMenu(true),
          },
        ]}
      />
      <LiveStartSheet
        visible={!!directing}
        onClose={() => setDirecting(null)}
        repertorio={directing}
        onStarted={() => start(0)}
      />
      <ContextMenuSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={rep.name}
        actions={menuActions}
      />
    </View>
  );
}

/** Para que la ruta pueda reutilizar el tipo en tests. */
export type { Repertorio };

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    centered: { justifyContent: 'center' },
    flex: { flex: 1 },
    head: { marginBottom: spacing.md },
    title: { ...typography.h1, color: t.text },
    renameInput: {
      ...typography.h1,
      color: t.text,
      borderBottomWidth: 1,
      borderBottomColor: t.accent,
      paddingVertical: spacing.xs,
    },
    meta: { ...typography.subhead, color: t.textSecondary, marginTop: 4 },
    readOnly: {
      ...typography.caption,
      color: t.textMuted,
      marginTop: spacing.sm,
    },
    songRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.min + spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: t.card,
      borderRadius: radii.md,
      marginBottom: spacing.xs,
      overflow: 'hidden',
    },
    num: {
      ...typography.title,
      color: t.accentText,
      minWidth: 22,
      textAlign: 'right',
    },
    songTitle: { ...typography.body, fontWeight: '600', color: t.text },
    missing: { color: t.textMuted },
    notes: { ...typography.caption, color: t.textSecondary, marginTop: 2 },
    keys: {
      ...typography.subhead,
      fontWeight: '700',
      color: t.accentText,
    },
    breakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    breakLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.separator,
    },
    breakText: {
      ...typography.caption,
      color: t.textMuted,
      fontStyle: 'italic',
    },
  });
