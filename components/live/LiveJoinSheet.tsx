/**
 * «Unirme a un directo» (`04-directo.md` §5.1, `03` §5): los que hay **cerca**
 * (por la wifi del coro, Bonjour) a un toque, o con la **clave**. Con el PIN
 * de maestro se entra a dirigir en vez de a seguir (D-08).
 *
 * Con `presetKey` (la tarjeta del evento) se une solo: lo que llegue antes,
 * la wifi del coro o internet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useLive, keyOfSessionId } from '@/contexts/LiveContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import {
  fetchLiveChoirSession,
  isSessionKey,
} from '@/services/choirSessionService';
import {
  LOCAL_LIVE_AVAILABLE,
  discoverLive,
  type FoundLive,
} from '@/services/live/local/native';
import { isValidPin } from '@/services/live/protocol';
import { openCantoral } from '@/utils/cantoralNavigation';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** Sin wifi del coro en este rato, se sugiere el QR o internet (§5.3). */
const NEARBY_HINT_MS = 10_000;

export default function LiveJoinSheet({
  visible,
  onClose,
  presetKey,
}: {
  visible: boolean;
  onClose: () => void;
  presetKey?: string | null;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const choir = useChoirSession();
  const [nearby, setNearby] = useState<FoundLive[]>([]);
  const [code, setCode] = useState(presetKey ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const joinedRef = useRef(false);
  // Lo que usan los avisos de Bonjour y el plazo (siempre lo último).
  const autoRef = useRef<{
    presetKey?: string | null;
    joinNearby: (f: FoundLive) => void;
    joinByCode: (key: string) => Promise<void>;
  } | null>(null);

  // Buscar por la wifi solo con la hoja abierta (el permiso de red local de
  // iOS sale aquí, cuando la persona lo ha pedido).
  useEffect(() => {
    if (!visible || !LOCAL_LIVE_AVAILABLE) return;
    joinedRef.current = false;
    const stop = discoverLive(
      (f) => {
        setNearby((prev) =>
          prev.some((p) => p.service === f.service)
            ? prev.map((p) => (p.service === f.service ? f : p))
            : [...prev, f],
        );
        // La tarjeta del evento: por la wifi en cuanto aparece.
        const auto = autoRef.current;
        if (
          auto?.presetKey &&
          !joinedRef.current &&
          keyOfSessionId(f.sessionId) === auto.presetKey
        ) {
          auto.joinNearby(f);
        }
      },
      (service) =>
        setNearby((prev) => prev.filter((p) => p.service !== service)),
    );
    const timer = setTimeout(() => setSlow(true), NEARBY_HINT_MS);
    return () => {
      stop();
      clearTimeout(timer);
      setNearby([]);
      setSlow(false);
    };
  }, [visible]);

  const finish = () => {
    joinedRef.current = true;
    h.success();
    onClose();
  };

  const joinNearby = (f: FoundLive) => {
    if (pin && !isValidPin(pin)) {
      setError('El PIN son 4 cifras.');
      return;
    }
    live.joinLocal(f, pin || undefined);
    finish();
  };

  const joinByCode = async (key: string) => {
    if (!isSessionKey(key)) {
      setError('La clave son 4 cifras.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (pin) {
        const r = await live.joinWithPin(key, pin);
        if (r !== 'ok') {
          setError(
            r === 'bad-pin'
              ? 'Ese no es el PIN de ese directo.'
              : 'No hay ningún directo con esa clave.',
          );
          h.error();
          return;
        }
      } else {
        const session = await fetchLiveChoirSession(key);
        if (!session) {
          setError('No hay ningún directo con esa clave.');
          h.error();
          return;
        }
        await choir.joinAsSlave(key);
      }
      finish();
    } catch {
      setError('No se pudo conectar. ¿Hay internet?');
      h.error();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    autoRef.current = { presetKey, joinNearby, joinByCode };
  });

  // La tarjeta del evento: si la wifi del coro no aparece enseguida, por
  // internet (lo que llegue antes).
  useEffect(() => {
    if (!visible || !presetKey) return;
    const timer = setTimeout(
      () => {
        if (!joinedRef.current) void autoRef.current?.joinByCode(presetKey);
      },
      LOCAL_LIVE_AVAILABLE ? 2_500 : 0,
    );
    return () => clearTimeout(timer);
  }, [visible, presetKey]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Unirme a un directo"
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {LOCAL_LIVE_AVAILABLE ? (
          <>
            <Text style={styles.label}>Cerca de ti (wifi del coro)</Text>
            {nearby.length === 0 ? (
              <View style={styles.searching}>
                <ActivityIndicator color={t.textMuted} />
                <Text style={styles.help}>
                  {slow
                    ? '¿Estás en la wifi del coro? Si no, usa la clave o el QR (va por internet).'
                    : 'Buscando…'}
                </Text>
              </View>
            ) : (
              nearby.map((f) => (
                <PressableFeedback
                  key={f.service}
                  onPress={() => joinNearby(f)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`Unirme a ${f.title}`}
                >
                  <PressableFeedback.Highlight />
                  <MaterialIcons name="wifi" size={24} color={t.accentText} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {f.title}
                    </Text>
                    <Text style={styles.help}>
                      Clave {keyOfSessionId(f.sessionId) ?? '—'}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={t.textMuted}
                  />
                </PressableFeedback>
              ))
            )}
          </>
        ) : null}

        <Text style={styles.label}>Con la clave</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setError(null);
              setCode(v.trim());
            }}
            placeholder="1234"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
            accessibilityLabel="Clave del directo"
            returnKeyType="go"
            onSubmitEditing={() => void joinByCode(code)}
          />
          <PressableFeedback
            onPress={() => void joinByCode(code)}
            isDisabled={busy || !code}
            style={[styles.go, (busy || !code) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={pin ? 'Entrar a dirigir' : 'Unirme'}
          >
            <PressableFeedback.Highlight />
            {busy ? (
              <ActivityIndicator color={t.onAccent} />
            ) : (
              <MaterialIcons
                name="arrow-forward"
                size={26}
                color={t.onAccent}
              />
            )}
          </PressableFeedback>
        </View>

        <Text style={styles.label}>¿Vas a dirigir? PIN de maestro</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          placeholder="Opcional"
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          style={styles.input}
          accessibilityLabel="PIN de maestro (opcional)"
        />
        <Text style={styles.help}>
          Sin PIN, sigues. Con el PIN de quien lo abrió, diriges con él.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableFeedback
          onPress={() => {
            onClose();
            openCantoral('SelectedSongs', { hoja: 'unirse' });
          }}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel="Escanear el QR del directo"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="qr-code-scanner" size={24} color={t.text} />
          <Text style={[styles.rowTitle, styles.flex]}>Escanear el QR</Text>
        </PressableFeedback>
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    help: { ...typography.caption, color: t.textMuted },
    error: { ...typography.subhead, color: t.danger, marginTop: spacing.md },
    searching: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.min,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.live,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    rowTitle: { ...typography.title, color: t.text },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      ...typography.h2,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      minHeight: TouchTarget.live,
    },
    go: {
      width: TouchTarget.live,
      height: TouchTarget.live,
      borderRadius: radii.pillFull,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    disabled: { opacity: 0.45 },
  });
