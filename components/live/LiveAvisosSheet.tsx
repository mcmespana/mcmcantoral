/**
 * «Avisos» de quien dirige (`04-directo.md` §6, §10): los de 1 toque están
 * ya en la barra del directo; aquí, dirigirlos a un instrumento, escribir uno
 * libre, «Ahora: Puente», la cuenta atrás de bloque, apagar las reacciones,
 * compartir el directo y dejar de dirigir.
 */
import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useLive } from '@/contexts/LiveContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { useToast } from '@/contexts/AppToastContext';
import {
  INSTRUMENTOS,
  INSTRUMENTO_LABEL,
  type Aviso,
  type AvisoKind,
} from '@/services/live/protocol';
import { WEB_BASE_URL } from '@/constants/appLinks';
import { openCantoral } from '@/utils/cantoralNavigation';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

/** Lo que se anuncia con «Ahora:» (el orden lo decide quien dirige). */
export const SECTION_CUES = [
  'Estribillo',
  'Estrofa 1',
  'Estrofa 2',
  'Estrofa 3',
  'Estrofa 4',
  'Puente',
  'Final',
];

const COUNTDOWNS_MIN = [1, 2, 5];

function hhmm(at: number): string {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LiveAvisosSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const choir = useChoirSession();
  const config = useCantoralConfig();
  const { toast } = useToast();
  const [to, setTo] = useState<Aviso['to']>('todos');
  const [kind, setKind] = useState<AvisoKind>('cinta');
  const [text, setText] = useState('');
  const [cdLabel, setCdLabel] = useState('Cambio de bloque');

  const state = live.view.state;
  const code = choir.code ?? live.localSession?.key ?? '';
  const sent = live.view.avisos.slice(-5).reverse();

  const send = (a: { kind: AvisoKind; text: string; preset?: string }) => {
    h.tap();
    live.sendAviso({ ...a, to });
  };

  const share = () => {
    const url = `${WEB_BASE_URL}/coro?c=${code}`;
    if (Platform.OS === 'web') {
      void Clipboard.setStringAsync(url);
      toast.show({ label: 'Enlace copiado' });
    } else {
      Share.share({ message: `Sigue el directo:\n${url}` }).catch(() => {});
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Directo">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.label}>¿A quién?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(['todos', ...INSTRUMENTOS] as const).map((i) => (
            <Chip
              key={i}
              label={i === 'todos' ? 'Todos' : INSTRUMENTO_LABEL[i]}
              active={to === i}
              onPress={() => setTo(i)}
              styles={styles}
            />
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {config.livePresets.map((p) => (
            <PressableFeedback
              key={p.id}
              onPress={() => send({ kind: p.kind, text: p.text, preset: p.id })}
              style={styles.tile}
              accessibilityRole="button"
              accessibilityLabel={`Mandar: ${p.text}`}
            >
              <PressableFeedback.Highlight />
              {p.kind === 'destello' ? (
                <MaterialIcons name="flash-on" size={18} color={t.accentText} />
              ) : null}
              <Text style={styles.tileText} numberOfLines={2}>
                {p.text}
              </Text>
            </PressableFeedback>
          ))}
        </View>

        <Text style={styles.label}>Aviso libre</Text>
        <SegmentedControl<AvisoKind>
          options={[
            { value: 'cinta', label: 'Cinta', icon: 'short-text' },
            { value: 'destello', label: 'Destello', icon: 'flash-on' },
          ]}
          value={kind === 'cuenta' ? 'cinta' : kind}
          onChange={setKind}
          accentColor={t.accent}
          accessibilityLabel="Cómo se ve el aviso"
        />
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe el aviso…"
            placeholderTextColor={t.textMuted}
            style={styles.input}
            maxLength={80}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (!text.trim()) return;
              send({ kind, text });
              setText('');
            }}
            accessibilityLabel="Texto del aviso"
          />
          <PressableFeedback
            onPress={() => {
              if (!text.trim()) return;
              send({ kind, text });
              setText('');
            }}
            isDisabled={!text.trim()}
            style={[styles.sendButton, !text.trim() && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Mandar aviso"
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="send" size={24} color={t.onAccent} />
          </PressableFeedback>
        </View>

        <Text style={styles.label}>Ahora hacemos…</Text>
        <View style={styles.chipsWrap}>
          {SECTION_CUES.map((label) => (
            <Chip
              key={label}
              label={label}
              active={state?.sectionCue?.label === label}
              onPress={() => {
                h.tap();
                live.cueSection(-1, label);
              }}
              styles={styles}
            />
          ))}
        </View>

        <Text style={styles.label}>Cuenta atrás</Text>
        <TextInput
          value={cdLabel}
          onChangeText={setCdLabel}
          style={styles.input}
          maxLength={40}
          accessibilityLabel="Texto de la cuenta atrás"
        />
        <View style={[styles.chipsWrap, styles.mt]}>
          {COUNTDOWNS_MIN.map((m) => (
            <Chip
              key={m}
              label={`${m} min`}
              onPress={() => {
                h.tap();
                live.startCountdown(cdLabel.trim() || 'Empezamos', m * 60_000);
              }}
              styles={styles}
            />
          ))}
          {state?.countdown ? (
            <Chip
              label="Quitar"
              onPress={() => live.clearCountdown()}
              styles={styles}
            />
          ) : null}
        </View>

        <Text style={styles.label}>Reacciones</Text>
        <SegmentedControl<'on' | 'off'>
          options={[
            { value: 'on', label: 'Encendidas' },
            { value: 'off', label: 'Apagadas para todos' },
          ]}
          value={state?.reactionsOff ? 'off' : 'on'}
          onChange={(v) => live.setReactionsOff(v === 'off')}
          accentColor={t.accent}
          accessibilityLabel="Reacciones del directo"
        />

        {sent.length ? (
          <>
            <Text style={styles.label}>Mandados</Text>
            {sent.map((a) => (
              <Text key={a.id} style={styles.sent} numberOfLines={1}>
                {hhmm(a.at)} · {a.to && a.to !== 'todos' ? `${a.to}: ` : ''}
                {a.text}
              </Text>
            ))}
          </>
        ) : null}

        <View style={styles.actions}>
          {code ? (
            <Action
              icon="ios-share"
              label={`Compartir el directo (${code})`}
              onPress={share}
              styles={styles}
              color={t.text}
            />
          ) : null}
          {live.serving ? (
            <Action
              icon="router"
              label="Modo equipo base"
              onPress={() => {
                onClose();
                openCantoral('EquipoBase');
              }}
              styles={styles}
              color={t.text}
            />
          ) : null}
          <Action
            icon="logout"
            label={choir.isOwner ? 'Cerrar el directo' : 'Dejar de dirigir'}
            onPress={() => {
              onClose();
              void live.end();
            }}
            styles={styles}
            color={t.danger}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
    >
      <PressableFeedback.Highlight />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

function Action({
  icon,
  label,
  onPress,
  styles,
  color,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  styles: Styles;
  color: string;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons name={icon} size={22} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </PressableFeedback>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: { paddingBottom: spacing.xl },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    chips: { gap: spacing.sm },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      minHeight: TouchTarget.min,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pillFull,
      backgroundColor: t.cardRaised,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    chipActive: { backgroundColor: t.accentSoft },
    chipText: { ...typography.subhead, color: t.text, fontWeight: '600' },
    chipTextActive: { color: t.accentText },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: TouchTarget.live,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: t.cardRaised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      overflow: 'hidden',
    },
    tileText: { ...typography.button, color: t.text, flex: 1 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    input: {
      ...typography.body,
      flex: 1,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      minHeight: TouchTarget.min,
    },
    sendButton: {
      width: TouchTarget.live,
      height: TouchTarget.live,
      borderRadius: radii.pillFull,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    disabled: { opacity: 0.4 },
    mt: { marginTop: spacing.sm },
    sent: {
      ...typography.subhead,
      color: t.textSecondary,
      paddingVertical: 2,
    },
    actions: { marginTop: spacing.lg, gap: spacing.xs },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.live,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    actionText: { ...typography.body, fontWeight: '600' },
  });
