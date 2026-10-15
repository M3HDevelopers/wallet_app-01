// Settings: security (password / PIN / auto-lock / hide balances),
// preferences (currency, date format), data management (export, backup,
// restore, reset). Everything here is fully functional - no placeholder rows.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { StatusBarBand } from '../../components/StatusBarBand';
import { Button, Card, ConfirmDialog, Field, Input, PasswordInput, SectionTitle, Toast } from '../../components/ui';
import { useApp } from '../../hooks/useAppContext';
import { useAndroidBack } from '../../hooks/useBackHandler';
import { changePassword, clearAllCredentials, hasPin, removePin, setPin, validatePasswordStrength, verifyPassword } from '../../services/auth';
import { buildBackup, buildTransactionsCsv, listBackups, readTextFile, restoreBackup, shareFile, validateBackup, writeExportFile, BACKUP_FORMAT } from '../../services/backup';
import { deleteDatabaseFile } from '../../database/db';
import { CURRENCIES, DateFormat } from '../../utils/format';
import { colors, font, spacing } from '../../utils/theme';

type Panel = null | 'password' | 'pin' | 'restore';

export default function SettingsScreen() {
  const app = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backups, setBackups] = useState<{ name: string; uri: string; size: number }[]>([]);

  // Android back: close an open panel first, otherwise leave the screen.
  useAndroidBack(() => {
    if (panel) { setPanel(null); return true; }
    if (confirmReset) { setConfirmReset(false); return true; }
    return false;
  });

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  const refreshBackups = useCallback(() => { listBackups().then(setBackups).catch(() => {}); }, []);
  useEffect(() => { refreshBackups(); }, [refreshBackups]);

  // ---- Export actions ------------------------------------------------------
  const exportCsv = async () => {
    setBusy(true);
    try {
      const csv = await buildTransactionsCsv();
      const uri = await writeExportFile(`transactions-${Date.now()}.csv`, csv);
      try { await shareFile(uri, 'text/csv'); showToast('CSV shared'); }
      catch (e) { showToast((e as Error).message.slice(0, 60)); }
    } catch { showToast('Export failed'); } finally { setBusy(false); }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const json = JSON.stringify(await buildBackup(), null, 2);
      const uri = await writeExportFile(`${BACKUP_FORMAT}-${new Date().toISOString().slice(0, 10)}.json`, json);
      try { await shareFile(uri, 'application/json'); } catch { /* file still saved */ }
      showToast('Backup created');
      refreshBackups();
    } catch { showToast('Backup failed'); } finally { setBusy(false); }
  };

  const restoreFrom = async (uri: string) => {
    setBusy(true);
    try {
      const raw = await readTextFile(uri);
      const parsed = validateBackup(JSON.parse(raw)); // throws on invalid structure
      await restoreBackup(parsed); // transactional replace - validated first
      app.notifyDataChanged();
      setPanel(null);
      showToast('Backup restored');
    } catch (e) {
      showToast(e instanceof Error ? e.message.slice(0, 70) : 'Restore failed - file rejected');
    } finally { setBusy(false); }
  };

  const pickBackupFile = async () => {
    // Restore from the in-app backup list (no cloud, no Storage permission needed).
    setPanel('restore');
    refreshBackups();
  };

  const resetAll = async () => {
    setBusy(true);
    try {
      await deleteDatabaseFile();       // closes DB and removes wallet.db
      await clearAllCredentials();      // removes password + PIN from SecureStore
      setConfirmReset(false);
      setBusy(false);
      // Relaunch the app process so every provider re-initializes on a fresh DB.
      setTimeout(() => RNRestart(), 400);
    } catch {
      showToast('Reset failed');
      setBusy(false);
    }
  };

  // expo-dev-launcher / native restart is not available in production APKs,
  // so we trigger a graceful process exit; Android relaunches on next tap.
  const RNRestart = () => {
    try {
      const NativeModules = require('react-native').NativeModules;
      if (NativeModules.ExpoDevLauncher) { NativeModules.ExpoDevLauncher.restartAsync(); return; }
    } catch { /* production build */ }
    try {
      const { ExitApp } = require('expo-modules-core') as { ExitApp?: () => void };
      if (ExitApp) { ExitApp(); return; }
    } catch { /* fall through */ }
    showToast('Data erased - close and reopen the app');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBand title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }} keyboardShouldPersistTaps="handled">
        {/* Security */}
        <SectionTitle title="Security" />
        <Card style={{ paddingVertical: spacing.xs }}>
          <Row label="Change password" hint="Requires current password" onPress={() => setPanel(panel === 'password' ? null : 'password')} />
          <Row label="PIN unlock" hint="Set, change or remove quick-unlock PIN" onPress={() => setPanel(panel === 'pin' ? null : 'pin')} />
          <ToggleRow label="Hide balances by default" value={app.hideBalancesDefault} onToggle={(v) => app.setHideBalancesDefault(v)} />
          <View style={styles.rowWrap}>
            <Text style={font.body}>Auto-lock after background</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
              {[15, 60, 300, 900].map((s) => (
                <Pressable key={s} onPress={() => app.setAutoLockSeconds(s)} style={[styles.chip, app.autoLockSeconds === s && styles.chipActive]}>
                  <Text style={[styles.chipText, app.autoLockSeconds === s && { color: colors.white }]}>{s < 60 ? `${s}s` : `${s / 60} min`}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {panel === 'password' ? <PasswordPanel onClose={() => setPanel(null)} onDone={(m) => { setPanel(null); showToast(m); }} onError={showToast} /> : null}
        {panel === 'pin' ? <PinPanel onClose={() => setPanel(null)} onDone={(m) => { setPanel(null); showToast(m); }} onError={showToast} /> : null}

        {/* Preferences */}
        <SectionTitle title="Preferences" />
        <Card style={{ paddingVertical: spacing.sm }}>
          <Field label="Currency">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {Object.entries(CURRENCIES).map(([code, meta]) => (
                <Pressable key={code} onPress={() => app.setCurrency(code)} style={[styles.chip, app.currency === code && styles.chipActive]}>
                  <Text style={[styles.chipText, app.currency === code && { color: colors.white }]}>{meta.symbol} {code}</Text>
                </Pressable>
              ))}
            </View>
          </Field>
          <Field label="Date format">
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {(['dmy', 'mdy', 'iso', 'long'] as DateFormat[]).map((f) => (
                <Pressable key={f} onPress={() => app.setDateFormat(f)} style={[styles.chip, app.dateFormat === f && styles.chipActive]}>
                  <Text style={[styles.chipText, app.dateFormat === f && { color: colors.white }]}>{f.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </Field>
          <ToggleRow label="Allow negative balance" hint="Expenses above your balance need explicit confirmation" value={app.allowNegative} onToggle={(v) => app.setAllowNegative(v)} last />
        </Card>

        {/* Data management */}
        <SectionTitle title="Data Management" />
        <Card style={{ paddingVertical: spacing.xs }}>
          <Row label="Export transactions (CSV)" hint="Plain text - not encrypted" onPress={exportCsv} disabled={busy} />
          <Row label="Create full backup" hint="JSON with all records and preferences" onPress={exportBackup} disabled={busy} />
          <Row label="Restore a backup" hint="Replaces current data after validation" onPress={pickBackupFile} />
          <Row label="Danger zone: reset all data" danger onPress={() => setConfirmReset(true)} />
        </Card>
        <Text style={[font.caption, { marginTop: spacing.md }]}>
          This app stores everything only on this device. If you delete the app, lose the device, or forget your password without a backup, the data cannot be recovered. Keep regular backups.
        </Text>

        {panel === 'restore' ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <SectionTitle title="Available backups" />
            {backups.length === 0 ? (
              <Text style={[font.body, { color: colors.textMuted }]}>No backups found on this device yet.</Text>
            ) : (
              <Card style={{ paddingVertical: spacing.xs }}>
                {backups.map((b) => (
                  <Row key={b.uri} label={b.name} hint={`${Math.round(b.size / 1024)} KB - restoring replaces current data`} onPress={() => restoreFrom(b.uri)} disabled={busy} />
                ))}
              </Card>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>

      <ConfirmDialog visible={confirmReset} title="Reset all data?"
        message="This permanently deletes every transaction, debt, category, person, preference AND your password/PIN. There is no undo and no recovery without a backup."
        confirmLabel="Erase everything" danger busy={busy} onConfirm={resetAll} onCancel={() => setConfirmReset(false)} />

      <Toast message={toast ?? ''} visible={!!toast} />
    </View>
  );
}

// ---- Panels ---------------------------------------------------------------

function PasswordPanel({ onClose, onDone, onError }: { onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    const strength = validatePasswordStrength(next);
    if (strength) { setErr(strength); return; }
    if (next !== confirm) { setErr('New passwords do not match'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      onDone('Password changed');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to change password');
    } finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Card style={{ marginTop: spacing.md }}>
        <Field label="Current password" error={err ?? undefined}>
          <PasswordInput value={current} onChangeText={setCurrent} accessibilityLabel="Current password" />
        </Field>
        <Field label="New password" hint="Minimum 8 characters, letters and numbers">
          <PasswordInput value={next} onChangeText={setNext} accessibilityLabel="New password" />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChangeText={setConfirm} accessibilityLabel="Confirm new password" />
        </Field>
        <Button label="Update password" onPress={submit} disabled={!current || !next || busy} loading={busy} />
        <View style={{ height: spacing.sm }} />
        <Button label="Cancel" variant="ghost" onPress={onClose} />
      </Card>
    </Animated.View>
  );
}

function PinPanel({ onClose, onDone, onError }: { onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hasPin().then(setEnabled).catch(() => {}); }, []);

  const save = async () => {
    setErr(null);
    if (!/^\d{4}$|^\d{6}$/.test(pin)) { setErr('PIN must be exactly 4 or 6 digits'); return; }
    if (pin !== confirm) { setErr('PINs do not match'); return; }
    setBusy(true);
    try {
      if (!(await verifyPassword(password))) { setErr('Password is incorrect'); setBusy(false); return; }
      await setPin(pin);
      setEnabled(true);
      onDone('PIN enabled');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to set PIN');
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      if (!(await verifyPassword(password))) { setErr('Password is incorrect'); setBusy(false); return; }
      await removePin();
      setEnabled(false);
      onDone('PIN removed');
    } finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={font.body}>{enabled ? 'PIN unlock is currently ON.' : 'PIN unlock is OFF. Set a 4 or 6 digit PIN for quick unlocking.'}</Text>
        <Field label="Verify password" hint="Required to add or remove a PIN">
          <PasswordInput value={password} onChangeText={setPassword} accessibilityLabel="Password to verify" />
        </Field>
        {!enabled ? (
          <>
            <Field label="New PIN" error={err ?? undefined}>
              <Input value={pin} onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} secureTextEntry placeholder="4 or 6 digits" accessibilityLabel="New PIN" />
            </Field>
            <Field label="Confirm PIN">
              <Input value={confirm} onChangeText={(t) => setConfirm(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} secureTextEntry placeholder="Repeat PIN" accessibilityLabel="Confirm PIN" />
            </Field>
            <Button label="Enable PIN" onPress={save} disabled={!password || !pin || busy} loading={busy} />
          </>
        ) : (
          <>
            <Field label="Change PIN (optional)">
              <Input value={pin} onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} secureTextEntry placeholder="New PIN" accessibilityLabel="New PIN" />
            </Field>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Update PIN" onPress={async () => { if (/^\d{4}$|^\d{6}$/.test(pin)) await save(); else setErr('PIN must be 4 or 6 digits'); }} disabled={!password || !pin || busy} /></View>
              <View style={{ flex: 1 }}><Button label="Remove PIN" variant="secondary" onPress={disable} disabled={!password || busy} /></View>
            </View>
          </>
        )}
        <View style={{ height: spacing.sm }} />
        <Button label="Close" variant="ghost" onPress={onClose} />
      </Card>
    </Animated.View>
  );
}

// ---- Small building blocks --------------------------------------------------

function Row({ label, hint, onPress, danger, disabled, hidden }: { label?: string; hint?: string; onPress?: () => void; danger?: boolean; disabled?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyMedium, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {onPress ? <ChevronRight size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

function ToggleRow({ label, hint, value, onToggle, last }: { label: string; hint?: string; value: boolean; onToggle: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <View style={{ flex: 1 }}>
        <Text style={font.bodyMedium}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Pressable onPress={() => onToggle(!value)} accessibilityRole="switch" accessibilityLabel={label} hitSlop={6}
        style={[styles.switch, value ? styles.switchOn : null]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowWrap: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  switch: { width: 46, height: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, padding: 2, borderRadius: 0 },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  knob: { width: 20, height: 20, backgroundColor: colors.white, borderRadius: 0 },
  knobOn: { transform: [{ translateX: 20 }] },
});
