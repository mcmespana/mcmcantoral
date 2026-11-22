/**
 * Bloque «Directo» de Ajustes (`04-directo.md` §6-§7, §5.6): qué tocas (los
 * avisos dirigidos a tu instrumento solo te llegan si lo marcas), esconder
 * las reacciones y aplicar sin preguntar el cantoral más nuevo de quien
 * dirige.
 */
import React from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useTheme } from '@/hooks/useTheme';
import { useLive } from '@/contexts/LiveContext';
import {
  INSTRUMENTOS,
  INSTRUMENTO_LABEL,
  type Instrumento,
} from '@/services/live/protocol';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

export default function LivePrefsSettings() {
  const t = useTheme();
  const styles = createStyles(t);
  const { prefs, setPrefs } = useLive();

  const toggleInst = (i: Instrumento) => {
    h.select();
    setPrefs({
      inst: prefs.inst.includes(i)
        ? prefs.inst.filter((x) => x !== i)
        : [...prefs.inst, i],
    });
  };

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Directo</Text>
      <Text style={styles.rowTitle}>¿Qué tocas?</Text>
      <View style={styles.chips}>
        {INSTRUMENTOS.map((i) => {
          const on = prefs.inst.includes(i);
          return (
            <PressableFeedback
              key={i}
              onPress={() => toggleInst(i)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={INSTRUMENTO_LABEL[i]}
            >
              <PressableFeedback.Highlight />
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {INSTRUMENTO_LABEL[i]}
              </Text>
            </PressableFeedback>
          );
        })}
      </View>
      <Text style={styles.help}>
        Los avisos para un instrumento («Bajos: fuera») solo te llegan si lo
        marcas aquí.
      </Text>

      <Row
        title="Esconder las reacciones"
        value={prefs.reactionsMuted}
        onChange={(reactionsMuted) => setPrefs({ reactionsMuted })}
        styles={styles}
        t={t}
      />
      <Row
        title="Actualizar el cantoral sin preguntar"
        help="Si quien dirige tiene uno más nuevo, se aplica solo."
        value={prefs.autoCatalog}
        onChange={(autoCatalog) => setPrefs({ autoCatalog })}
        styles={styles}
        t={t}
      />
      {Platform.OS !== 'web' ? (
        <Row
          title="Subir el brillo en directo"
          help="Al máximo con la canción delante; al salir vuelve el de antes."
          value={prefs.brightUp}
          onChange={(brightUp) => setPrefs({ brightUp })}
          styles={styles}
          t={t}
        />
      ) : null}
    </View>
  );
}

function Row({
  title,
  help,
  value,
  onChange,
  styles,
  t,
}: {
  title: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {help ? <Text style={styles.help}>{help}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.separator, true: t.accent }}
        thumbColor={t.card}
        accessibilityLabel={title}
      />
    </View>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    block: { marginBottom: spacing.lg },
    flex: { flex: 1 },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginBottom: spacing.sm,
    },
    rowTitle: { ...typography.body, color: t.text },
    help: { ...typography.caption, color: t.textMuted, marginTop: 2 },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginVertical: spacing.sm,
    },
    chip: {
      minHeight: TouchTarget.min,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pillFull,
      backgroundColor: t.cardRaised,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    chipOn: { backgroundColor: t.accentSoft },
    chipText: { ...typography.subhead, color: t.text, fontWeight: '600' },
    chipTextOn: { color: t.accentText },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.min,
      marginTop: spacing.md,
    },
  });
