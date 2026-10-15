// Global app context: settings/preferences, currency & date formatting, refresh signals.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../database/db';
import { DateFormat, formatDate, formatMoney, parseAmountToMinor } from '../utils/format';

interface AppCtx {
  currency: string;
  setCurrency: (c: string) => Promise<void>;
  dateFormat: DateFormat;
  setDateFormat: (f: DateFormat) => Promise<void>;
  hideBalancesDefault: boolean;
  setHideBalancesDefault: (b: boolean) => Promise<void>;
  allowNegative: boolean;
  setAllowNegative: (b: boolean) => Promise<void>;
  autoLockSeconds: number;
  setAutoLockSeconds: (n: number) => Promise<void>;
  fmtMoney: (minor: number, opts?: { sign?: boolean }) => string;
  fmtDate: (iso: string) => string;
  toMinor: (s: string) => number | null;
  refreshTick: number;
  notifyDataChanged: () => void;
  ready: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState('PKR');
  const [dateFormat, setDateFmtState] = useState<DateFormat>('dmy');
  const [hideBalancesDefault, setHideDefault] = useState(false);
  const [allowNegative, setAllowNeg] = useState(false);
  const [autoLockSeconds, setAutoLockSec] = useState(60);
  const [ready, setReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [cur, df, hb, an, al] = await Promise.all([
          getSetting('currency'), getSetting('date_format'), getSetting('hide_balances'),
          getSetting('allow_negative'), getSetting('auto_lock_seconds'),
        ]);
        if (cur) setCurrencyState(cur);
        if (df) setDateFmtState(df as DateFormat);
        setHideDefault(hb === '1');
        setAllowNeg(an === '1');
        if (al) setAutoLockSec(parseInt(al, 10) || 60);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setCurrency = useCallback(async (c: string) => { setCurrencyState(c); await setSetting('currency', c); }, []);
  const setDateFormat = useCallback(async (f: DateFormat) => { setDateFmtState(f); await setSetting('date_format', f); }, []);
  const setHideBalancesDefault = useCallback(async (b: boolean) => { setHideDefault(b); await setSetting('hide_balances', b ? '1' : '0'); }, []);
  const setAllowNegative = useCallback(async (b: boolean) => { setAllowNeg(b); await setSetting('allow_negative', b ? '1' : '0'); }, []);
  const setAutoLockSeconds = useCallback(async (n: number) => { setAutoLockSec(n); await setSetting('auto_lock_seconds', String(n)); }, []);
  const notifyDataChanged = useCallback(() => setRefreshTick((t) => t + 1), []);

  const value = useMemo<AppCtx>(() => ({
    currency, setCurrency, dateFormat, setDateFormat,
    hideBalancesDefault, setHideBalancesDefault,
    allowNegative, setAllowNegative,
    autoLockSeconds, setAutoLockSeconds,
    fmtMoney: (minor, opts) => formatMoney(minor, currency, opts),
    fmtDate: (iso) => formatDate(iso, dateFormat),
    toMinor: parseAmountToMinor,
    refreshTick, notifyDataChanged, ready,
  }), [currency, dateFormat, hideBalancesDefault, allowNegative, autoLockSeconds, refreshTick, ready,
       setCurrency, setDateFormat, setHideBalancesDefault, setAllowNegative, setAutoLockSeconds, notifyDataChanged]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}
