/**
 * Lo de arriba de Inicio (`03-diseno-y-flujos.md` §4.1), encima de las
 * categorías del cantoral:
 *
 *  1. **Directo**: solo si hay uno (el tuyo, o el del evento en modo Navidad).
 *     «Unirme» en 1 toque.
 *  2. **Evento** (modo Navidad, `songs/cantoralConfig`): título, sitio, fecha
 *     y sus bloques con su hora; un toque abre el bloque.
 *  3. **Repertorios**: el activo primero; «Ver todos».
 *
 * Funcional, no decorativo (T-08): en modo normal solo salen el directo (si
 * lo hay) y los repertorios.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useRepertorios } from '@/hooks/useRepertorios';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { openCantoral } from '@/utils/cantoralNavigation';
import { formatDuration } from '@/utils/songCategories';
import { isSong, type Repertorio } from '@/services/repertorios';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** «sáb 19 dic» de un `YYYY-MM-DD`. */
export function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  return `${days[date.getDay()]} ${d} ${months[m - 1]}`;
}

/** «12 · ~38 min» de un repertorio. */
export function repertorioMeta(
  rep: Repertorio,
  seconds: number,
  unknownSongs: number,
): string {
  const songs = rep.items.filter(isSong).length;
  const parts = [`${songs} ${songs === 1 ? 'canción' : 'canciones'}`];
  if (seconds > 0) {
    parts.push(`${unknownSongs > 0 ? '~' : ''}${Math.round(seconds / 60)} min`);
  }
  return parts.join(' · ');
}

export default function HomeSections() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const config = useCantoralConfig();
  const choir = useChoirSession();
  const reps = useRepertorios();

  const navidad = config.effectiveMode === 'navidad' && !!config.event;
  const eventPacks = useMemo(() => {
    if (!config.event) return [];
    const wanted = config.event.packs;
    const byRef = new Map(reps.packs.map((p) => [p.source?.ref, p]));
    const listed = wanted
      .map((id) => byRef.get(id))
      .filter((p): p is Repertorio => !!p);
    return listed.length ? listed : reps.packs;
  }, [config.event, reps.packs]);

  const ordered = useMemo(() => {
    const active = reps.list.find((r) => r.id === reps.activeId);
    return active
      ? [active, ...reps.list.filter((r) => r.id !== active.id)]
      : reps.list;
  }, [reps.list, reps.activeId]);

  const live = choir.mode !== 'off' && choir.session;
  const liveLabel =
    choir.mode === 'master'
      ? 'Estás dirigiendo'
      : `Sigues a ${choir.session?.master?.name || 'quien dirige'}`;

  return (
    <View>
      {live ? (
        <PressableFeedback
          onPress={() => openCantoral('SelectedSongs')}
          style={[styles.card, styles.liveCard]}
          accessibilityRole="button"
          accessibilityLabel={`En directo. ${liveLabel}`}
        >
          <PressableFeedback.Highlight />
          <View style={styles.liveDot} />
          <View style={styles.flex}>
            <Text style={styles.kicker}>EN DIRECTO</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {choir.session?.choirName || `Directo ${choir.code ?? ''}`}
            </Text>
            <Text style={styles.cardMeta}>{liveLabel}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={t.textMuted} />
        </PressableFeedback>
      ) : null}

      {navidad && config.event ? (
        <View style={[styles.card, styles.eventCard]}>
          <Text style={styles.kicker}>
            {[shortDate(config.event.date), config.event.place]
              .filter(Boolean)
              .join(' · ')
              .toUpperCase()}
          </Text>
          <Text style={styles.eventTitle}>{config.event.title}</Text>
          {config.event.liveKey ? (
            <PressableFeedback
              onPress={() => {
                h.tap();
                openCantoral('SelectedSongs', { c: config.event!.liveKey });
              }}
              style={styles.joinButton}
              accessibilityRole="button"
              accessibilityLabel="Unirme al directo del evento"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons name="sensors" size={22} color={t.onAccent} />
              <Text style={styles.joinText}>Unirme al directo</Text>
            </PressableFeedback>
          ) : null}
          {eventPacks.map((pack, i) => {
            const d = reps.durationOf(pack);
            return (
              <PressableFeedback
                key={pack.id}
                onPress={() => openCantoral('Repertorio', { id: pack.id })}
                style={[styles.packRow, i > 0 && styles.packDivider]}
                accessibilityRole="button"
                accessibilityLabel={`Bloque ${pack.name}`}
              >
                <PressableFeedback.Highlight />
                <View style={styles.flex}>
                  <Text style={styles.packTitle} numberOfLines={1}>
                    {pack.name}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {repertorioMeta(pack, d.seconds, d.unknownSongs)}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={t.textMuted}
                />
              </PressableFeedback>
            );
          })}
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          Repertorios
        </Text>
        <PressableFeedback
          onPress={() => openCantoral('Repertorios')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Ver todos los repertorios"
        >
          <Text style={styles.seeAll}>Ver todos</Text>
        </PressableFeedback>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {ordered.map((rep) => {
          const d = reps.durationOf(rep);
          const active = rep.id === reps.activeId;
          return (
            <PressableFeedback
              key={rep.id}
              onPress={() => openCantoral('Repertorio', { id: rep.id })}
              style={[styles.repCard, active && styles.repCardActive]}
              accessibilityRole="button"
              accessibilityLabel={`${rep.name}${active ? ', el que estás usando' : ''}`}
            >
              <PressableFeedback.Highlight />
              <Text style={styles.repName} numberOfLines={2}>
                {rep.name}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {rep.date ? `${shortDate(rep.date)} · ` : ''}
                {repertorioMeta(rep, d.seconds, d.unknownSongs)}
              </Text>
            </PressableFeedback>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Duración legible de un repertorio («38 min» o «1:02:05»). */
export function repertorioDurationLabel(seconds: number): string {
  return seconds >= 3600
    ? formatDuration(seconds)
    : `${Math.round(seconds / 60)} min`;
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      backgroundColor: t.card,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    liveCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.live,
    },
    liveDot: {
      width: 12,
      height: 12,
      borderRadius: radii.pillFull,
      backgroundColor: t.live,
    },
    kicker: {
      ...typography.overline,
      color: t.accentText,
    },
    cardTitle: {
      ...typography.title,
      color: t.text,
    },
    cardMeta: {
      ...typography.caption,
      color: t.textMuted,
      marginTop: 2,
    },
    eventCard: {
      borderWidth: 1,
      borderColor: t.accentSoft,
    },
    eventTitle: {
      ...typography.h2,
      color: t.text,
      marginTop: spacing.xs,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: t.accent,
      borderRadius: radii.pillFull,
      minHeight: TouchTarget.live,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      overflow: 'hidden',
    },
    joinText: {
      ...typography.title,
      color: t.onAccent,
      fontWeight: '700',
    },
    packRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: TouchTarget.min,
      paddingVertical: spacing.sm,
    },
    packDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.separator,
    },
    packTitle: {
      ...typography.body,
      fontWeight: '600',
      color: t.text,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionLabel: {
      ...typography.sectionLabel,
      color: t.textSecondary,
    },
    seeAll: {
      ...typography.subhead,
      color: t.accentText,
      fontWeight: '600',
    },
    strip: {
      gap: spacing.sm,
      paddingRight: spacing.md,
    },
    repCard: {
      width: 168,
      minHeight: 88,
      backgroundColor: t.card,
      borderRadius: radii.lg,
      padding: spacing.md,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    repCardActive: {
      borderColor: t.accent,
    },
    repName: {
      ...typography.title,
      color: t.text,
    },
  });
