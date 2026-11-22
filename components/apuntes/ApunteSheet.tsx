/**
 * Crear o editar un apunte (`05` §2-§3): toque largo en una línea de la hoja
 * → esta hoja. Qué es (texto, marca o acorde), para quién (Solo yo, Todos o
 * un instrumento) y, si diriges un directo, mandarlo a quien sigue (§2).
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useLive } from '@/contexts/LiveContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import {
  MARCAS,
  anchorFor,
  layerLabel,
  type Apunte,
  type ApunteKind,
  type ApunteLayer,
  type ApunteSong,
} from '@/services/apuntes';
import { INSTRUMENTOS } from '@/services/live/protocol';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

export type ApunteDraft =
  { mode: 'new'; line: number } | { mode: 'edit'; apunte: Apunte };

/** La línea del `.cho` sin acordes, para enseñar dónde va. */
export function linePreview(content: string, line: number): string {
  const raw = content.split(/\r?\n/)[line] ?? '';
  return raw.replace(/\[[^\]]*\]/g, '').trim() || raw.trim();
}

export default function ApunteSheet({
  draft,
  onClose,
  song,
  content,
  onSave,
  onDelete,
  onMove,
}: {
  draft: ApunteDraft | null;
  onClose: () => void;
  song: ApunteSong;
  content: string;
  onSave: (a: Apunte, sendLive: boolean) => void;
  onDelete: (id: string) => void;
  /** Llevarlo a otra línea: el siguiente toque largo dice dónde. */
  onMove?: (id: string) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const live = useLive();
  const choir = useChoirSession();
  const { settings } = useAppSettings();
  const editing = draft?.mode === 'edit' ? draft.apunte : null;
  const line = editing ? editing.line : draft?.mode === 'new' ? draft.line : 0;

  // Estado del formulario, reiniciado al abrir otro apunte (clave = draft).
  const draftKey = editing ? editing.id : `new-${line}`;
  const [form, setForm] = useState<{
    key: string;
    text: string;
    kind: ApunteKind;
    layer: ApunteLayer;
    sendLive: boolean;
  } | null>(null);
  const f =
    form && form.key === draftKey
      ? form
      : {
          key: draftKey,
          text: editing?.text ?? '',
          kind: editing?.kind ?? ('texto' as ApunteKind),
          layer: editing?.layer ?? ('yo' as ApunteLayer),
          sendLive: false,
        };
  const patch = (p: Partial<typeof f>) => setForm({ ...f, ...p });

  const isMaster = live.role === 'master';
  const layers: ApunteLayer[] = [
    'yo',
    'todos',
    ...INSTRUMENTOS.map((i) => `inst:${i}` as ApunteLayer),
  ];
  const canSend = isMaster && f.layer !== 'yo';

  const save = () => {
    const text = f.text.trim();
    if (!text) return;
    const now = Date.now();
    const apunte: Apunte = {
      ...(editing ?? {
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        song,
      }),
      ...anchorFor(content, line),
      layer: f.layer,
      kind: f.kind,
      text: text.slice(0, 200),
      author: {
        deviceId: choir.deviceId,
        name: settings.choirName?.trim() || undefined,
      },
      updatedAt: now,
      orphan: false,
    };
    h.success();
    onSave(apunte, canSend && f.sendLive);
    onClose();
  };

  return (
    <BottomSheet
      visible={!!draft}
      onClose={onClose}
      title={editing ? 'Apunte' : 'Nuevo apunte'}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.preview} numberOfLines={2}>
          {linePreview(content, line) || 'Línea sin letra'}
        </Text>

        <SegmentedControl<ApunteKind>
          options={[
            { value: 'texto', label: 'Texto', icon: 'notes' },
            { value: 'marca', label: 'Marca', icon: 'music-note' },
            { value: 'acorde', label: 'Acorde', icon: 'piano' },
          ]}
          value={f.kind}
          onChange={(kind) => patch({ kind })}
          accentColor={t.accent}
          accessibilityLabel="Qué es el apunte"
        />

        {f.kind === 'marca' ? (
          <View style={styles.chips}>
            {MARCAS.map((m) => (
              <Chip
                key={m}
                label={m}
                active={f.text === m}
                onPress={() => patch({ text: m })}
                styles={styles}
              />
            ))}
          </View>
        ) : null}

        <TextInput
          value={f.text}
          onChangeText={(text) => patch({ text })}
          placeholder={
            f.kind === 'acorde'
              ? 'Aquí yo hago… (p. ej. Gsus4)'
              : f.kind === 'marca'
                ? 'O escribe la tuya'
                : '«Respira aquí», «entra el bajo»…'
          }
          placeholderTextColor={t.textMuted}
          style={styles.input}
          maxLength={200}
          multiline={f.kind === 'texto'}
          accessibilityLabel="Texto del apunte"
        />

        <Text style={styles.label}>Para</Text>
        <View style={styles.chips}>
          {layers.map((l) => (
            <Chip
              key={l}
              label={layerLabel(l)}
              active={f.layer === l}
              onPress={() => patch({ layer: l })}
              styles={styles}
            />
          ))}
        </View>
        <Text style={styles.help}>
          «Solo yo» no sale de este móvil. «Todos» y los de instrumento viajan
          con el repertorio cuando lo compartes.
        </Text>

        {canSend ? (
          <Chip
            label={
              f.sendLive
                ? 'Se manda al directo al guardar'
                : 'Mandarlo también al directo'
            }
            active={f.sendLive}
            onPress={() => patch({ sendLive: !f.sendLive })}
            styles={styles}
          />
        ) : null}

        <PressableFeedback
          onPress={save}
          isDisabled={!f.text.trim()}
          style={[styles.primary, !f.text.trim() && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Guardar apunte"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="check" size={22} color={t.onAccent} />
          <Text style={styles.primaryText}>Guardar</Text>
        </PressableFeedback>
        {editing && onMove ? (
          <PressableFeedback
            onPress={() => {
              h.tap();
              onMove(editing.id);
              onClose();
            }}
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Moverlo a otra línea"
          >
            <PressableFeedback.Highlight />
            <Text style={styles.move}>
              {editing.orphan
                ? '¿Dónde iba? Mantén pulsada su línea'
                : 'Moverlo a otra línea'}
            </Text>
          </PressableFeedback>
        ) : null}
        {editing ? (
          <PressableFeedback
            onPress={() => {
              h.remove();
              onDelete(editing.id);
              onClose();
            }}
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Borrar apunte"
          >
            <PressableFeedback.Highlight />
            <Text style={styles.danger}>Borrar</Text>
          </PressableFeedback>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
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

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    preview: {
      ...typography.body,
      color: t.textSecondary,
      fontStyle: 'italic',
      marginBottom: spacing.md,
    },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    help: { ...typography.caption, color: t.textMuted, marginTop: spacing.xs },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    chip: {
      minHeight: TouchTarget.min,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pillFull,
      backgroundColor: t.cardRaised,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    chipActive: { backgroundColor: t.accentSoft },
    chipText: { ...typography.subhead, color: t.text, fontWeight: '600' },
    chipTextActive: { color: t.accentText },
    input: {
      ...typography.body,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: TouchTarget.min,
      marginTop: spacing.md,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: TouchTarget.min,
      borderRadius: radii.pillFull,
      backgroundColor: t.accent,
      marginTop: spacing.lg,
      overflow: 'hidden',
    },
    primaryText: { ...typography.title, color: t.onAccent, fontWeight: '700' },
    disabled: { opacity: 0.45 },
    secondary: {
      minHeight: TouchTarget.min,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      borderRadius: radii.pillFull,
      overflow: 'hidden',
    },
    danger: { ...typography.button, color: t.danger },
    move: { ...typography.button, color: t.accentText },
  });
