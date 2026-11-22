/**
 * La capa del DIRECTO sobre el Atril (`04-directo.md` §6-§7, `03` §4.3). No es
 * otra pantalla: va debajo de la letra, en el flujo, así que una cinta
 * **empuja** la hoja hacia arriba en vez de taparla (design.md §8).
 *
 *  - Quien SIGUE: la cinta del aviso (grande, se lee a un metro), la cuenta
 *    atrás, «Ahora: Puente», y una fila con por dónde le llega, «Ir por
 *    libre / Volver», «Tono del maestro» y las reacciones.
 *  - Quien DIRIGE: cuántos le siguen, ‹ › a 56 pt, los avisos de 1 toque
 *    (todos) y «Más» para dirigirlos, cuentas atrás y el resto.
 *
 * El destello (`kind: 'destello'`) late además el borde de la pantalla
 * (`LiveFlash`, montado por la pantalla): nunca tapa la letra.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useNow } from '@/hooks/useNow';
import { useLive } from '@/contexts/LiveContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import {
  agregarReacciones,
  avisosVivos,
  presenceSummary,
  type Aviso,
  type LiveTransport,
} from '@/services/live/protocol';
import LiveAvisosSheet from '@/components/live/LiveAvisosSheet';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** Cuánto se queda «Ahora: …» en pantalla. */
const CUE_MS = 8_000;

/** «por la wifi del coro», «por internet»… (la píldora de quien sigue). */
export function viaLabel(via: LiveTransport[]): string {
  if (via.includes('local') && via.includes('cloud'))
    return 'wifi del coro e internet';
  if (via.includes('local')) return 'wifi del coro';
  if (via.includes('cloud')) return 'internet';
  return 'sin conexión · sigues con lo último';
}

/** «1:45» de unos milisegundos (nunca negativo). */
export function countdownLabel(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function LiveLayer({
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  bottomOffset = 0,
  compact = false,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Hueco de la barra inferior (la capa va justo encima). */
  bottomOffset?: number;
  /** Pantalla completa: solo cintas y reacciones, sin fila de controles. */
  compact?: boolean;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const choir = useChoirSession();
  const config = useCantoralConfig();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [tray, setTray] = useState(false);

  const { role, view, prefs } = live;
  const state = view.state;
  const countdown = state?.countdown ?? null;
  const cue = state?.sectionCue ?? null;
  const ticking =
    role !== 'off' &&
    (view.avisos.length > 0 || !!countdown || !!cue || role === 'master');
  const now = useNow(ticking);

  const avisos = useMemo(
    () =>
      role === 'off'
        ? []
        : avisosVivos(view.avisos, now, prefs.inst).filter(
            (a) => !dismissed.includes(a.id),
          ),
    [role, view.avisos, now, prefs.inst, dismissed],
  );
  const aviso: Aviso | undefined = avisos[avisos.length - 1];

  if (role === 'off') return null;

  const isMaster = role === 'master';
  const reactions =
    prefs.reactionsMuted || state?.reactionsOff
      ? []
      : agregarReacciones(view.reacciones, now);
  const cueLive = cue && now - cue.at < CUE_MS ? cue : null;
  const countdownLeft = countdown ? countdown.endsAt - now : 0;
  const presence = isMaster ? presenceSummary(live.presence, now) : null;
  const masterName = state?.by.name || choir.session?.master?.name;

  return (
    <View style={[styles.wrap, { marginBottom: bottomOffset }]}>
      {countdown && countdownLeft > -5_000 ? (
        <View style={[styles.cinta, styles.cintaCuenta]}>
          <MaterialIcons name="timer" size={28} color={t.onAccent} />
          <Text style={styles.cintaTextOnAccent} numberOfLines={2}>
            {countdown.label} · {countdownLabel(countdownLeft)}
          </Text>
        </View>
      ) : null}

      {cueLive ? (
        <View style={styles.cinta}>
          <Text style={styles.cintaText} numberOfLines={1}>
            Ahora: {cueLive.label}
          </Text>
        </View>
      ) : null}

      {aviso ? (
        <PressableFeedback
          onPress={() => setDismissed((d) => [...d.slice(-20), aviso.id])}
          style={[styles.cinta, aviso.kind === 'destello' && styles.cintaFlash]}
          accessibilityRole="button"
          accessibilityLabel={`Aviso: ${aviso.text}. Toca para quitarlo`}
          accessibilityLiveRegion="assertive"
        >
          <PressableFeedback.Highlight />
          {aviso.to && aviso.to !== 'todos' ? (
            <Text style={styles.cintaTo}>{aviso.to.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.cintaText} numberOfLines={3}>
            {aviso.text}
          </Text>
        </PressableFeedback>
      ) : null}

      {reactions.length ? (
        <View style={styles.reactions} accessibilityLabel="Reacciones">
          {reactions.map((r) => (
            <Text key={r.e} style={styles.reaction}>
              {r.e}
              {r.n > 1 ? <Text style={styles.reactionN}>×{r.n}</Text> : null}
            </Text>
          ))}
        </View>
      ) : null}

      {compact ? null : isMaster ? (
        <>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                En directo · {presence?.total ?? 0}{' '}
                {presence?.total === 1 ? 'te sigue' : 'te siguen'}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {live.masterCount > 1 ? `${live.masterCount} dirigen · ` : ''}
                {viaLabel(live.via)}
              </Text>
            </View>
            <LiveButton
              icon="chevron-left"
              label="Canción anterior"
              onPress={onPrev}
              disabled={!hasPrev}
            />
            <LiveButton
              icon="chevron-right"
              label="Canción siguiente"
              onPress={onNext}
              disabled={!hasNext}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presets}
            keyboardShouldPersistTaps="handled"
          >
            <PressableFeedback
              onPress={() => {
                h.tap();
                setShowSheet(true);
              }}
              style={[styles.preset, styles.presetPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Más avisos y opciones del directo"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons name="campaign" size={24} color={t.onAccent} />
              <Text style={styles.presetPrimaryText}>Avisos</Text>
            </PressableFeedback>
            {config.livePresets.map((p) => (
              <PressableFeedback
                key={p.id}
                onPress={() => {
                  h.tap();
                  live.sendAviso({ kind: p.kind, text: p.text, preset: p.id });
                }}
                style={styles.preset}
                accessibilityRole="button"
                accessibilityLabel={`Mandar a todos: ${p.text}`}
              >
                <PressableFeedback.Highlight />
                <Text style={styles.presetText} numberOfLines={1}>
                  {p.text}
                </Text>
              </PressableFeedback>
            ))}
          </ScrollView>
          <LiveAvisosSheet
            visible={showSheet}
            onClose={() => setShowSheet(false)}
          />
        </>
      ) : (
        <>
          <View style={styles.row}>
            <View
              style={[styles.liveDot, live.via.length === 0 && styles.offDot]}
            />
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {live.free
                  ? 'Vas por libre'
                  : `Sigues a ${masterName || 'quien dirige'}`}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {viaLabel(live.via)}
              </Text>
            </View>
            {choir.overrideTranspose !== null ? (
              <LiveButton
                icon="music-note"
                label="Volver al tono del maestro"
                onPress={() => choir.setOverrideTranspose(null)}
              />
            ) : null}
            {!state?.reactionsOff ? (
              <LiveButton
                icon={tray ? 'close' : 'add-reaction'}
                label={tray ? 'Cerrar reacciones' : 'Reaccionar'}
                onPress={() => setTray((v) => !v)}
              />
            ) : null}
            <LiveButton
              icon={live.free ? 'sensors' : 'directions-walk'}
              label={live.free ? 'Volver con el maestro' : 'Ir por libre'}
              onPress={() => live.setFree(!live.free)}
              showLabel
            />
          </View>
          {live.catalogNewer ? (
            <PressableFeedback
              onPress={() => void live.updateCatalog()}
              style={styles.catalogRow}
              accessibilityRole="button"
              accessibilityLabel="Quien dirige tiene un cantoral más nuevo. Actualizar"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons name="sync" size={20} color={t.accentText} />
              <Text style={styles.catalogText}>
                Quien dirige tiene un cantoral más nuevo · Actualizar
              </Text>
            </PressableFeedback>
          ) : null}
          {tray && !state?.reactionsOff ? (
            <View style={styles.tray}>
              {config.reactions.map((e) => (
                <PressableFeedback
                  key={e}
                  onPress={() => {
                    h.tap();
                    live.react(e);
                  }}
                  style={styles.trayItem}
                  accessibilityRole="button"
                  accessibilityLabel={`Reaccionar ${e}`}
                >
                  <PressableFeedback.Highlight />
                  <Text style={styles.trayEmoji}>{e}</Text>
                </PressableFeedback>
              ))}
            </View>
          ) : null}
        </>
      )}
      {live.localError ? (
        <PressableFeedback
          onPress={() => live.reportLocalError(null)}
          style={styles.catalogRow}
          accessibilityRole="button"
          accessibilityLabel={`${live.localError}. Toca para cerrar`}
        >
          <MaterialIcons name="wifi-off" size={20} color={t.textSecondary} />
          <Text style={styles.rowMeta}>{live.localError}</Text>
        </PressableFeedback>
      ) : null}
    </View>
  );
}

/** Botón de directo: 56 pt siempre (guantes y prisa, design.md §6). */
function LiveButton({
  icon,
  label,
  onPress,
  disabled,
  showLabel,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const t = useTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress?.();
      }}
      isDisabled={disabled || !onPress}
      style={[
        buttonStyles.button,
        { backgroundColor: t.cardRaised },
        showLabel && buttonStyles.withLabel,
        (disabled || !onPress) && buttonStyles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons name={icon} size={28} color={t.text} />
      {showLabel ? (
        <Text style={[buttonStyles.label, { color: t.text }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </PressableFeedback>
  );
}

const buttonStyles = StyleSheet.create({
  button: {
    minWidth: TouchTarget.live,
    minHeight: TouchTarget.live,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  withLabel: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    maxWidth: 200,
  },
  label: { ...typography.subhead, fontWeight: '600' },
  disabled: { opacity: 0.35 },
});

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      gap: spacing.xs,
      backgroundColor: t.background,
    },
    flex: { flex: 1 },
    cinta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.live,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: t.cardRaised,
      borderWidth: 2,
      borderColor: t.accent,
      overflow: 'hidden',
    },
    cintaFlash: {
      borderColor: t.live,
    },
    cintaCuenta: {
      backgroundColor: t.accent,
    },
    cintaText: {
      ...typography.h1,
      color: t.text,
      flex: 1,
    },
    cintaTextOnAccent: {
      ...typography.h1,
      color: t.onAccent,
      flex: 1,
    },
    cintaTo: {
      ...typography.overline,
      color: t.accentText,
    },
    reactions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    reaction: {
      ...typography.h2,
    },
    reactionN: {
      ...typography.caption,
      color: t.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.live,
    },
    liveDot: {
      width: 12,
      height: 12,
      borderRadius: radii.pillFull,
      backgroundColor: t.live,
      marginLeft: spacing.xs,
    },
    offDot: {
      backgroundColor: t.textMuted,
    },
    rowTitle: {
      ...typography.title,
      color: t.text,
    },
    rowMeta: {
      ...typography.caption,
      color: t.textSecondary,
    },
    presets: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
    },
    preset: {
      minHeight: TouchTarget.live,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pillFull,
      backgroundColor: t.cardRaised,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      overflow: 'hidden',
    },
    presetPrimary: {
      backgroundColor: t.accent,
    },
    presetText: {
      ...typography.button,
      color: t.text,
    },
    presetPrimaryText: {
      ...typography.button,
      color: t.onAccent,
      fontWeight: '700',
    },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.min,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    catalogText: {
      ...typography.subhead,
      color: t.accentText,
      fontWeight: '600',
      flex: 1,
    },
    tray: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingBottom: spacing.xs,
    },
    trayItem: {
      minWidth: TouchTarget.live,
      minHeight: TouchTarget.live,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pillFull,
      overflow: 'hidden',
    },
    trayEmoji: {
      ...typography.h1,
    },
  });
