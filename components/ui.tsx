// Reusable design-system components. Square corners everywhere, flat surfaces, 1px borders.
import React from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, font, spacing } from '../utils/theme';

export const DURATION = 220;

// ---- Buttons -------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, testID }: ButtonProps) {
  const pressed = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.25,
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));
  const bg =
    variant === 'primary' ? colors.accent :
    variant === 'danger' ? colors.danger :
    variant === 'secondary' ? colors.surface : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' ? colors.white :
    variant === 'secondary' ? colors.text : colors.accent;
  const border = variant === 'secondary' ? colors.border : variant === 'ghost' ? colors.accent : 'transparent';
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
        onPressOut={() => { pressed.value = withTiming(0, { duration: 160 }); }}
        onPress={onPress}
        style={[styles.button, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text style={[font.button, { color: fg }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---- Form inputs ----------------------------------------------------------

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[font.label, styles.fieldLabel]}>
        {label}{required ? <Text style={{ color: colors.expense }}> *</Text> : null}
      </Text>
      {children}
      <View style={{ minHeight: 18, marginTop: 4 }}>
        {error ? (
          <Animated.Text entering={FadeIn.duration(160)} style={styles.errorText}>{error}</Animated.Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    </View>
  );
}

interface InputProps extends TextInputProps {
  invalid?: boolean;
}

export function Input({ invalid, style, ...rest }: InputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.input, invalid && { borderColor: colors.expense }, style]}
      {...rest}
    />
  );
}

interface PasswordInputProps extends Omit<InputProps, 'secureTextEntry'> {
  secure?: boolean;
}

export function PasswordInput({ secure = true, invalid, style, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(!secure);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        secureTextEntry={visible ? false : secure}
        style={[styles.input, { flex: 1 }, invalid && { borderColor: colors.expense }, style]}
        {...rest}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.eyeBtn}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide' : 'Show'}
        hitSlop={8}
      >
        {visible ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
      </Pressable>
    </View>
  );
}

// ---- Amount input -----------------------------------------------------------

interface AmountInputProps {
  value: string;
  onChangeText: (t: string) => void;
  currencyDisplay: string;   // e.g. "Rs." or "PKR"
  large?: boolean;
  error?: string;
  onBlur?: () => void;
  testID?: string;
}

export function AmountInput({ value, onChangeText, currencyDisplay, large, error, onBlur, testID }: AmountInputProps) {
  return (
    <View style={[styles.amountBox, large && styles.amountBoxLarge, (error || invalidAmount(value)) && styles.amountBoxInvalid]}>
      <Text style={[styles.amountSymbol, large && { fontSize: 22 }]}>{currencyDisplay}</Text>
      <TextInput
        testID={testID}
        style={[styles.amountInput, large && { fontSize: 34 }]}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        onBlur={onBlur}
        returnKeyType="done"
      />
    </View>
  );
}

function invalidAmount(v: string): boolean {
  return v.length > 0 && !/^\d+(\.\d{0,2})?$/.test(v);
}

// ---- Segmented option selector ----------------------------------------------

interface Option { value: string; label: string; }

export function SegmentedOptions({ options, value, onChange, scrollable }: {
  options: Option[]; value: string; onChange: (v: string) => void; scrollable?: boolean;
}) {
  const inner = (
    <View style={{ flexDirection: 'row', flexWrap: scrollable ? 'nowrap' : 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && { color: colors.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (scrollable) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>{inner}</ScrollView>;
  }
  return inner;
}

// ---- Cards / sections / rows ---------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={font.section}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[font.body, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[font.amount, { color: valueColor ?? colors.text }]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---- Empty / loading states ------------------------------------------------------

export function EmptyState({ title, message, actionLabel, onAction }: {
  title: string; message: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={font.section}>{title}</Text>
      <Text style={[font.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg, width: 220 }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

// ---- Confirmation dialog ------------------------------------------------------------

interface ConfirmProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <Text style={font.section}>{title}</Text>
          <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 }]}>{message}</Text>
          <View style={styles.dialogActions}>
            <View style={{ flex: 1 }}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---- Screen wrapper with keyboard handling ----------------------------------------

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: object }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
    >
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {children}
        </ScrollView>
      ) : children}
    </KeyboardAvoidingView>
  );
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(DURATION)} style={styles.toast} pointerEvents="none">
      <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 0, paddingHorizontal: spacing.lg,
  },
  fieldLabel: { marginBottom: spacing.xs + 2 },
  errorText: { color: colors.expense, fontSize: 12, fontWeight: '500' },
  hintText: { color: colors.textMuted, fontSize: 12 },
  input: {
    height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 0,
    paddingHorizontal: spacing.md, backgroundColor: colors.surface,
    color: colors.text, fontSize: 15,
  },
  eyeBtn: {
    width: 48, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt,
  },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    borderRadius: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.md, height: 56,
  },
  amountBoxLarge: { height: 72 },
  amountBoxInvalid: { borderColor: colors.expense },
  amountSymbol: { fontSize: 18, fontWeight: '700', color: colors.textMuted, marginRight: spacing.sm },
  amountInput: {
    flex: 1, fontSize: 26, fontWeight: '700', color: colors.text,
    fontVariant: ['tabular-nums'] as unknown as never, paddingVertical: 0,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 0, padding: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2, gap: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.border },
  empty: { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl, alignItems: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  backdrop: { flex: 1, backgroundColor: 'rgba(32,35,31,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  dialog: {
    width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 0,
    borderWidth: 1, borderColor: colors.border, padding: spacing.xl,
  },
  dialogActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: colors.text,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 0,
  },
});
