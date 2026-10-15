// SQLite persistence layer built on expo-sqlite (async API).
import * as SQLite from 'expo-sqlite';
import { todayISO } from '../utils/format';

export const DB_NAME = 'wallet.db';
export const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Reset in-memory handle (used by full data reset / restore-replace flows). */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    dbPromise = null;
    try { await db.closeAsync(); } catch { /* ignore */ }
  }
}

const V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense','general')),
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  original_amount_minor INTEGER NOT NULL CHECK (original_amount_minor > 0),
  borrowed_date TEXT NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN
    ('opening_balance','earned_income','gift_allowance','family_money','person_money',
     'borrowed_in','repayment_received','other_income','expense','repayment_out')),
  amount_minor_units INTEGER NOT NULL CHECK (amount_minor_units >= 0),
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  related_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  transaction_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  related_debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS debt_repayments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount_minor_units INTEGER NOT NULL CHECK (amount_minor_units > 0),
  repayment_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_person ON transactions(related_person_id);
CREATE INDEX IF NOT EXISTS idx_tx_debt ON transactions(related_debt_id);
CREATE INDEX IF NOT EXISTS idx_rep_debt ON debt_repayments(debt_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food', 'Transport', 'Petrol', 'Shopping', 'Education',
  'Mobile & Internet', 'Personal', 'Family', 'Health', 'Entertainment', 'Other',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Allowance', 'Gift', 'Loan', 'Other Income',
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstSync<{ v: number | null }>(
    'SELECT CAST(value AS INTEGER) AS v FROM meta WHERE key = ?', ['schema_version']
  );
  // execAsync for DDL batches
  if (!row || row.v == null || row.v < 1) {
    await db.execAsync(V1);
    await db.runAsync(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      ['schema_version', String(SCHEMA_VERSION)]
    );
    await seedDefaults(db);
  }
}

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, kind, is_default, created_at, updated_at) VALUES (?,?,?,?,?)',
      [name, 'expense', 1, now, now]
    );
  }
  for (const name of DEFAULT_INCOME_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (name, kind, is_default, created_at, updated_at) VALUES (?,?,?,?,?)',
      [name, 'income', 1, now, now]
    );
  }
  // Default preferences (non-sensitive only).
  const defaults: Record<string, string> = {
    currency: 'PKR',
    date_format: 'dmy',
    hide_balances: '0',
    auto_lock_seconds: '60',
    allow_negative: '0',
    setup_complete: '0',
  };
  for (const [k, v] of Object.entries(defaults)) {
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
}

// ---- Settings -----------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r ? r.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function isoNow(): string { return new Date().toISOString(); }
export { todayISO };
