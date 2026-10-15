// Authentication gate: setup, unlock, auto-lock on background.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { hasPassword, setPassword, verifyPassword, hasPin, verifyPin } from '../../services/auth';
import { getDb } from '../../database/db';
import { useApp } from '../../hooks/useAppContext';
import { LockScreen, WelcomeScreen } from './AuthScreens';

type AuthState = 'loading' | 'setup' | 'locked' | 'unlocked';

interface AuthCtxValue {
  state: AuthState;
  completeSetup: (password: string) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  pinAvailable: boolean;
  lockNow: () => void;
}

const Ctx = createContext<AuthCtxValue | null>(null);

SplashScreen.preventAutoHideAsync().catch(() => {});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [pinAvailable, setPinAvailable] = useState(false);
  const { autoLockSeconds, ready } = useApp();
  const bgSince = useRef<number | null>(null);

  // Bootstrap: open DB (migrates), decide whether setup or lock is needed.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        await getDb();
        const pwSet = await hasPassword();
        setPinAvailable(await hasPin());
        setState(pwSet ? 'locked' : 'setup');
      } catch {
        // Database failure must never expose data; stay locked.
        setState('locked');
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, [ready]);

  const completeSetup = useCallback(async (password: string) => {
    await setPassword(password);
    setState('unlocked');
  }, []);

  const unlockWithPassword = useCallback(async (password: string) => {
    const ok = await verifyPassword(password);
    if (ok) setState('unlocked');
    return ok;
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) setState('unlocked');
    return ok;
  }, []);

  const lockNow = useCallback(() => {
    setState('locked');
    hasPin().then(setPinAvailable).catch(() => {});
  }, []);

  // Auto-lock when returning from background beyond configured timeout.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') {
        if (bgSince.current == null) bgSince.current = Date.now();
      } else if (s === 'active') {
        const since = bgSince.current;
        bgSince.current = null;
        if (since != null && state === 'unlocked') {
          const elapsed = (Date.now() - since) / 1000;
          if (elapsed >= Math.max(autoLockSeconds, 1)) lockNow();
        }
      }
    });
    return () => sub.remove();
  }, [state, autoLockSeconds, lockNow]);

  const value: AuthCtxValue = { state, completeSetup, unlockWithPassword, unlockWithPin, pinAvailable, lockNow };

  return (
    <Ctx.Provider value={value}>
      {/* Financial records are only mounted while unlocked, so no screen content
          exists in the tree (or app-switcher snapshot) when locked. */}
      {state === 'unlocked' ? children : null}
      <Modal visible={state !== 'unlocked'} animationType="fade" transparent={false}
        statusBarTranslucent hardwareAccelerated={Platform.OS === 'android'}>
        {state === 'setup' ? <WelcomeScreen onCreate={completeSetup} /> :
         state === 'locked' ? <LockScreen onPassword={unlockWithPassword} onPin={unlockWithPin} pinAvailable={pinAvailable} /> :
         <View style={{ flex: 1, backgroundColor: '#F7F7F3' }} />}
      </Modal>
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtxValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
