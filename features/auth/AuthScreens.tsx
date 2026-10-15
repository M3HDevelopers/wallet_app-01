// Welcome (create password) and Lock screens. No financial data shown here.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, Hash } from 'lucide-react-native';
import { Button, Field, PasswordInput } from '../../components/ui';
import { validatePasswordStrength } from '../../services/auth';
import { colors, font, spacing } from '../../utils/theme';

export function WelcomeScreen({ onCreate }: { onCreate: (pw: string) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const v = validatePasswordStrength(pw);
    if (v) { setError(v); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    try {
      await onCreate(pw);
    } catch {
      setError('Could not save credentials. Please try again.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingTop: insets.top + 60, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(280)}>
          <Text style={[font.screenTitle, { fontSize: 30 }]}>Personal Wallet Manager</Text>
          <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 }]}>
            A private, offline record of your money. Create a password to secure this device. It is stored only on this phone.
          </Text>
          <Text style={[styles.note, { marginTop: spacing.lg }]}>
            Important: there is no password recovery. If you forget it and have no backup, the data may need to be reset.
          </Text>
        </Animated.View>
        <View style={{ marginTop: spacing.xxxl }}>
          <Field label="Password" required error={error ?? undefined}>
            <PasswordInput value={pw} onChangeText={(t) => { setPw(t); setError(null); }} placeholder="At least 8 characters, letters and numbers" autoCapitalize="none" autoCorrect={false} secure testID="setup-password" />
          </Field>
          <Field label="Confirm password" required>
            <PasswordInput value={confirm} onChangeText={(t) => { setConfirm(t); setError(null); }} placeholder="Re-enter your password" autoCapitalize="none" autoCorrect={false} secure testID="setup-confirm" />
          </Field>
          <Button label="Create password" onPress={submit} loading={busy} disabled={!pw || !confirm} testID="setup-create" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LockScreen({ onPassword, onPin, pinAvailable }: {
  onPassword: (pw: string) => Promise<boolean>;
  onPin: (pin: string) => Promise<boolean>;
  pinAvailable: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'password' | 'pin'>(pinAvailable ? 'pin' : 'password');
  const [pw, setPw] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tryUnlock = async (kind: 'password' | 'pin') => {
    if (busy) return;
    setBusy(true);
    const ok = kind === 'password' ? await onPassword(pw) : await onPin(pin);
    setBusy(false);
    if (!ok) {
      setError(kind === 'password' ? 'Incorrect password' : 'Incorrect PIN');
      if (kind === 'pin') setPin('');
    }
  };

  const pressPinDigit = (d: string) => {
    setError(null);
    if (pin.length < 6) setPin(pin + d);
  };
  const pressBackspace = () => { setError(null); setPin((p) => p.slice(0, -1)); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingTop: insets.top + 80, minHeight: '100%' }} keyboardShouldPersistTaps="handled">
        <Text style={[font.screenTitle, { textAlign: 'center' }]}>Wallet Locked</Text>
        <Text style={[font.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          Enter your {mode === 'password' ? 'password' : 'PIN'} to continue.
        </Text>
        <View style={{ marginTop: spacing.xxl }}>
          {mode === 'password' ? (
            <>
              <Field label="Password" error={error ?? undefined}>
                <PasswordInput value={pw} onChangeText={(t) => { setPw(t); setError(null); }} autoFocus placeholder="Your password" autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => tryUnlock('password')} testID="lock-password" />
              </Field>
              <Button label="Unlock" onPress={() => tryUnlock('password')} loading={busy} disabled={!pw} testID="lock-unlock" />
              {pinAvailable ? (
                <Pressable onPress={() => { setMode('pin'); setError(null); setPw(''); }} style={{ marginTop: spacing.lg, alignItems: 'center' }} hitSlop={10}>
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>Use PIN instead</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.pinDots}>
                {Array.from({ length: Math.min(pin.length, 6) }).map((_, i) => (
                  <View key={i} style={styles.pinDot} />
                ))}
              </View>
              {error ? <Text style={[styles.error, { textAlign: 'center' }]}>{error}</Text> : null}
              <View style={styles.keypad}>
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <Pressable key={d} onPress={() => pressPinDigit(d)} style={styles.key} accessibilityRole="button" accessibilityLabel={`Digit ${d}`}>
                    <Hash size={0} />
                    <Text style={styles.keyText}>{d}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => { setMode('password'); setError(null); setPin(''); }} style={styles.key} accessibilityRole="button" accessibilityLabel="Use password">
                  <Text style={[styles.keyText, { fontSize: 13 }]}>ABC</Text>
                </Pressable>
                <Pressable onPress={() => pressPinDigit('0')} style={styles.key} accessibilityRole="button" accessibilityLabel="Digit 0">
                  <Text style={styles.keyText}>0</Text>
                </Pressable>
                <Pressable onPress={pressBackspace} style={styles.key} accessibilityRole="button" accessibilityLabel="Delete">
                  <Delete size={20} color={colors.text} />
                </Pressable>
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <Button label="Unlock" onPress={() => tryUnlock('pin')} loading={busy} disabled={pin.length < 4} testID="lock-pin-unlock" />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  error: { color: colors.expense, fontSize: 13, fontWeight: '500' },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.lg, height: 16 },
  pinDot: { width: 12, height: 12, backgroundColor: colors.text, borderRadius: 0 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  key: {
    width: '30%', aspectRatio: 1.6, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderRadius: 0,
  },
  keyText: { fontSize: 22, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
