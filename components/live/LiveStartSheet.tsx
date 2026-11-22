/**
 * «Dirigir» un repertorio (`04-directo.md` §2 bis y §4): por dónde va el
 * directo (lo marcado de serie sale de la conexión de quien dirige, D-23),
 * la clave (la del evento si es un bloque suyo) y el PIN de 4 cifras para
 * los demás maestros (D-08). Si la clave ya tiene un directo, se ofrece
 * entrar a dirigirlo con su PIN en vez de pisarlo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Network from 'expo-network';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useLive } from '@/contexts/LiveContext';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { fetchLiveChoirSession } from '@/services/choirSessionService';
import { LOCAL_LIVE_AVAILABLE } from '@/services/live/local/native';
import {
  defaultTransports,
  isValidPin,
  type LiveTransport,
} from '@/services/live/protocol';
import type { Repertorio } from '@/services/repertorios';
import type { LiveTransportChoice } from '@/utils/cantoralConfig';
import { generateRandomCode, isValidCode } from '@/utils/playlistCodes';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';

export function choiceToTransports(c: LiveTransportChoice): LiveTransport[] {
  return c === 'both' ? ['local', 'cloud'] : [c];
}

export function transportsToChoice(t: LiveTransport[]): LiveTransportChoice {
  if (t.includes('local') && t.includes('cloud')) return 'both';
  return t.includes('local') ? 'local' : 'cloud';
}

export default function LiveStartSheet({
  visible,
  onClose,
  repertorio,
  onStarted,
}: {
  visible: boolean;
  onClose: () => void;
  /** Lo que se va a dirigir (ya activado: materializado si era un bloque). */
  repertorio: Repertorio | null;
  onStarted: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const config = useCantoralConfig();

  const eventKey =
    config.event?.liveKey &&
    repertorio?.source?.ref &&
    config.event.packs.includes(repertorio.source.ref)
      ? config.event.liveKey
      : null;

  // Lo que elija quien dirige; si no ha tocado nada, el del evento o el de
  // su conexión.
  const [picked, setChoice] = useState<LiveTransportChoice | null>(null);
  const [netChoice, setNetChoice] = useState<LiveTransportChoice>('both');
  const eventChoice = eventKey ? config.event?.liveTransport : undefined;
  const choice: LiveTransportChoice = !LOCAL_LIVE_AVAILABLE
    ? 'cloud'
    : (picked ?? eventChoice ?? netChoice);
  // La hoja se monta antes de saber qué se dirige: la clave del evento se
  // decide al pintar, no al crear el estado.
  const [randomCode] = useState(generateRandomCode);
  const [typedCode, setCode] = useState<string | null>(null);
  const code = eventKey ?? typedCode ?? randomCode;
  const [pin, setPin] = useState(() => generateRandomCode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  // Lo marcado de serie según la conexión de este móvil (D-23).
  useEffect(() => {
    if (!visible || !LOCAL_LIVE_AVAILABLE) return;
    let cancelled = false;
    Network.getNetworkStateAsync()
      .then((s) => {
        if (cancelled) return;
        const isWifi = s.type === Network.NetworkStateType.WIFI;
        const internet = s.isInternetReachable ?? s.isConnected ?? false;
        setNetChoice(
          transportsToChoice(defaultTransports({ isWifi, internet })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const codeOk = eventKey ? code === eventKey : isValidCode(code);
  const canStart = !!repertorio && codeOk && isValidPin(pin) && !busy;

  const start = async (force: boolean) => {
    if (!repertorio || !canStart) return;
    setBusy(true);
    setError(null);
    try {
      const transports = choiceToTransports(choice);
      // ¿Ya hay un directo con esa clave? Mejor entrar que pisarlo.
      if (!force && transports.includes('cloud')) {
        const existing = await fetchLiveChoirSession(code).catch(() => null);
        if (existing) {
          setConflict(true);
          setBusy(false);
          return;
        }
      }
      await live.start({ code, repertorio, pin, transports });
      h.success();
      onClose();
      onStarted();
    } catch (e) {
      logger.warn('[directo] no se pudo empezar', e);
      setError('No se pudo abrir el directo. ¿Hay conexión?');
      h.error();
    } finally {
      setBusy(false);
    }
  };

  const joinExisting = async () => {
    setBusy(true);
    setError(null);
    const r = await live.joinWithPin(code, pin).catch(() => 'no-live' as const);
    setBusy(false);
    if (r === 'ok') {
      h.success();
      onClose();
      onStarted();
    } else {
      h.error();
      setError(
        r === 'bad-pin'
          ? 'Ese no es el PIN de ese directo.'
          : 'Ese directo no admite más maestros.',
      );
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={repertorio ? `Dirigir «${repertorio.name}»` : 'Dirigir'}
    >
      {LOCAL_LIVE_AVAILABLE ? (
        <>
          <Text style={styles.label}>Por dónde va</Text>
          <SegmentedControl<LiveTransportChoice>
            options={[
              { value: 'both', label: 'Los dos' },
              { value: 'local', label: 'Wifi del coro' },
              { value: 'cloud', label: 'Internet' },
            ]}
            value={choice}
            onChange={setChoice}
            accentColor={t.accent}
            accessibilityLabel="Por dónde va el directo"
          />
          <Text style={styles.help}>
            {choice === 'both'
              ? 'Por la wifi del coro y por internet: si uno cae, sigue el otro.'
              : choice === 'local'
                ? 'Solo la wifi del coro (sin gastar datos). Quien no esté en esa wifi no puede seguir.'
                : 'Solo por internet: para gente repartida, la web o MCM App.'}
          </Text>
        </>
      ) : (
        <Text style={styles.help}>
          Desde la web el directo va solo por internet.
        </Text>
      )}

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Clave</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setConflict(false);
              setCode(eventKey ? v : v.replace(/\D/g, '').slice(0, 4));
            }}
            editable={!eventKey}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="Clave del directo"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>PIN de maestro</Text>
          <TextInput
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel="PIN de maestro, 4 cifras"
          />
        </View>
      </View>
      <Text style={styles.help}>
        Apunta el PIN: con él entran a dirigir los demás maestros. Seguir no
        pide nada.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {conflict ? (
        <View style={styles.conflict}>
          <Text style={styles.body}>
            Ya hay un directo con la clave {code}. Si eres de ese coro, entra a
            dirigirlo con su PIN.
          </Text>
          <PrimaryButton
            label="Entrar con este PIN"
            icon="login"
            onPress={() => void joinExisting()}
            disabled={busy || !isValidPin(pin)}
            styles={styles}
            color={t.onAccent}
          />
          <PressableFeedback
            onPress={() => void start(true)}
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Sustituir ese directo por el mío"
          >
            <PressableFeedback.Highlight />
            <Text style={styles.secondaryText}>Sustituirlo por el mío</Text>
          </PressableFeedback>
        </View>
      ) : (
        <PrimaryButton
          label="Empezar el directo"
          icon="sensors"
          onPress={() => void start(false)}
          disabled={!canStart}
          busy={busy}
          styles={styles}
          color={t.onAccent}
        />
      )}
    </BottomSheet>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  styles,
  color,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  styles: ReturnType<typeof createStyles>;
  color: string;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      style={[styles.primary, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <PressableFeedback.Highlight />
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <MaterialIcons name={icon} size={24} color={color} />
      )}
      <Text style={styles.primaryText}>{label}</Text>
    </PressableFeedback>
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
    help: { ...typography.caption, color: t.textMuted, marginTop: spacing.xs },
    body: { ...typography.body, color: t.text },
    error: { ...typography.subhead, color: t.danger, marginTop: spacing.md },
    fields: { flexDirection: 'row', gap: spacing.md },
    field: { flex: 1 },
    input: {
      ...typography.h2,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      minHeight: TouchTarget.live,
      letterSpacing: 4,
    },
    conflict: { marginTop: spacing.md, gap: spacing.sm },
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
    disabled: { opacity: 0.45 },
    secondary: {
      minHeight: TouchTarget.min,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pillFull,
      overflow: 'hidden',
    },
    secondaryText: { ...typography.button, color: t.accentText },
  });
