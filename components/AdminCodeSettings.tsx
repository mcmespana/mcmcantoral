/**
 * «Soy administrador» en Ajustes (`06-administracion.md` §2): se escribe el
 * código y, si el servidor lo da por bueno, este dispositivo pasa a ser
 * administrador (editor de canciones y herramientas del cantoral). Para quien
 * lo usa es una contraseña y ya.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useTheme } from '@/hooks/useTheme';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { adminStore, type ClaimResult } from '@/services/adminService';
import { TouchTarget } from '@/constants/theme';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

const REASON_TEXT: Record<
  Exclude<ClaimResult, { ok: true }>['reason'],
  string
> = {
  'bad-code': 'Ese código no es.',
  'too-many': 'Demasiados intentos. Prueba dentro de una hora.',
  offline: 'Hace falta internet para comprobarlo.',
  error: 'No se pudo comprobar. Inténtalo luego.',
};

export default function AdminCodeSettings() {
  const t = useTheme();
  const styles = createStyles(t);
  const { isAdmin } = useAdminStatus();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAdmin) {
    return (
      <View style={[styles.block, styles.row]}>
        <MaterialIcons name="verified-user" size={22} color={t.accentText} />
        <Text style={styles.title}>Eres administrador en este dispositivo</Text>
      </View>
    );
  }

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await adminStore.claim(code);
    setBusy(false);
    if (r.ok) {
      h.success();
      setCode('');
      setOpen(false);
    } else {
      h.error();
      setError(REASON_TEXT[r.reason]);
    }
  };

  if (!open) {
    return (
      <PressableFeedback
        onPress={() => setOpen(true)}
        style={[styles.block, styles.row]}
        accessibilityRole="button"
        accessibilityLabel="Soy administrador"
      >
        <PressableFeedback.Highlight />
        <MaterialIcons name="admin-panel-settings" size={22} color={t.text} />
        <Text style={styles.title}>Soy administrador</Text>
      </PressableFeedback>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Código de administrador</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setError(null);
            setCode(v);
          }}
          placeholder="Escribe el código"
          placeholderTextColor={t.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={Platform.OS !== 'web'}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          style={styles.input}
          accessibilityLabel="Código de administrador"
        />
        <PressableFeedback
          onPress={() => void submit()}
          isDisabled={busy || !code.trim()}
          style={[styles.go, (busy || !code.trim()) && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Comprobar el código"
        >
          <PressableFeedback.Highlight />
          {busy ? (
            <ActivityIndicator color={t.onAccent} />
          ) : (
            <MaterialIcons name="arrow-forward" size={22} color={t.onAccent} />
          )}
        </PressableFeedback>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.help}>
        Lo comprueba el servidor; el código no se guarda en el móvil.
      </Text>
    </View>
  );
}

const createStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    block: { marginBottom: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TouchTarget.min,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    title: { ...typography.body, color: t.text, flex: 1 },
    label: {
      ...typography.sectionLabel,
      color: t.textSecondary,
      marginBottom: spacing.sm,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      ...typography.body,
      flex: 1,
      minWidth: 0,
      color: t.text,
      backgroundColor: t.cardRaised,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      minHeight: TouchTarget.min,
    },
    go: {
      width: TouchTarget.min,
      height: TouchTarget.min,
      borderRadius: radii.pillFull,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    disabled: { opacity: 0.45 },
    error: { ...typography.subhead, color: t.danger, marginTop: spacing.sm },
    help: { ...typography.caption, color: t.textMuted, marginTop: spacing.xs },
  });
