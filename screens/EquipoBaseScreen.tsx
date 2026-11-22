/**
 * «Equipo base» (`04-directo.md` §5.2): el móvil o tablet enchufado junto al
 * router que SIRVE el directo por la wifi del coro. Pantalla siempre
 * encendida y, en grande, lo que se canta y quién está conectado: hace de
 * monitor para la mesa de sonido. Los maestros dirigen desde sus móviles
 * (entran con el PIN); este solo reparte.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useNow } from '@/hooks/useNow';
import { useKeepAwakeWhileFocused } from '@/hooks/useKeepAwakeWhileFocused';
import { useLive } from '@/contexts/LiveContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import {
  INSTRUMENTO_LABEL,
  presenceSummary,
  type Instrumento,
} from '@/services/live/protocol';
import { viaLabel, countdownLabel } from '@/components/live/LiveLayer';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

export default function EquipoBaseScreen() {
  useKeepAwakeWhileFocused('equipo-base');
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const live = useLive();
  const choir = useChoirSession();
  const now = useNow(true);

  const state = live.view.state;
  const items = state?.repertorio.items ?? [];
  const next =
    state && state.index >= 0 && state.index + 1 < items.length
      ? items[state.index + 1]
      : null;
  const sum = presenceSummary(live.presence, now);
  const code = choir.code ?? live.localSession?.key;

  if (live.role !== 'master') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.title}>No hay ningún directo abierto</Text>
        <Text style={styles.meta}>
          Abre un directo desde un repertorio («Dirigir») en este dispositivo y
          vuelve aquí: lo servirá por la wifi del coro.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {live.serving
            ? 'No bloquees este dispositivo: está sirviendo el directo.'
            : 'Este dispositivo no sirve el directo por la wifi (va por internet).'}
        </Text>
      </View>

      <Text style={styles.kicker}>
        {state?.repertorio.name ?? 'Directo'}
        {code ? ` · clave ${code}` : ''}
      </Text>
      <Text style={styles.song} numberOfLines={3}>
        {state?.song?.title ?? state?.song?.filename ?? 'Sin canción todavía'}
      </Text>
      {state && state.index >= 0 ? (
        <Text style={styles.meta}>
          {state.index + 1} de {items.length}
          {state.song?.key ? ` · ${state.song.key}` : ''}
          {state.sectionCue ? ` · ahora: ${state.sectionCue.label}` : ''}
        </Text>
      ) : null}
      {next ? (
        <Text style={styles.next} numberOfLines={1}>
          Siguiente: {next.title ?? next.filename}
        </Text>
      ) : null}
      {state?.countdown ? (
        <Text style={styles.countdown}>
          {state.countdown.label} ·{' '}
          {countdownLabel(state.countdown.endsAt - now)}
        </Text>
      ) : null}

      <View style={styles.stats}>
        <Stat label="Conectados" value={String(sum.total)} styles={styles} />
        <Stat
          label="Por la wifi"
          value={String(sum.byVia.local)}
          styles={styles}
        />
        <Stat
          label="Por internet"
          value={String(sum.byVia.cloud)}
          styles={styles}
        />
        <Stat
          label="Dirigen"
          value={String(live.masterCount)}
          styles={styles}
        />
      </View>
      <Text style={styles.meta}>
        {Object.entries(sum.byInstrument)
          .map(([i, n]) => `${INSTRUMENTO_LABEL[i as Instrumento]} ${n}`)
          .join(' · ') || 'Nadie ha dicho su instrumento'}
      </Text>
      <Text style={[styles.meta, styles.mt]}>Va por {viaLabel(live.via)}</Text>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    content: { padding: spacing.lg, gap: spacing.sm },
    banner: {
      backgroundColor: t.accentSoft,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    bannerText: { ...typography.body, color: t.text, fontWeight: '600' },
    kicker: { ...typography.overline, color: t.accentText },
    title: { ...typography.h2, color: t.text, textAlign: 'center' },
    song: { ...typography.display, color: t.text },
    meta: { ...typography.body, color: t.textSecondary },
    next: { ...typography.h3, color: t.textSecondary },
    countdown: { ...typography.h1, color: t.accentText },
    mt: { marginTop: spacing.sm },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    stat: {
      flexGrow: 1,
      flexBasis: '22%',
      minWidth: 120,
      backgroundColor: t.card,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    statValue: { ...typography.h0, color: t.text },
    statLabel: { ...typography.caption, color: t.textSecondary },
  });
