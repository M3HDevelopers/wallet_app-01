// Backup / export / restore service.
// - CSV export of transactions (plain file, not encrypted).
// - JSON structured backup including all records and preferences (never credentials).
// - Restore validates structure, versions, relationships; REPLACE mode is transactional.
import * as FileSystem from 'expo-file-system/legacy';
import { getDb, isoNow } from '../database/db';
import { SCHEMA_VERSION } from '../database/db';

export const BACKUP_FORMAT = 'personal-wallet-manager-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  schemaVersion: number;
  data: {
    categories: unknown[];
    people: unknown[];
    debts: unknown[];
    debt_repayments: unknown[];
    transactions: unknown[];
    settings: Record<string, string>;
  };
}

const TX_TYPES = new Set([
  'opening_balance', 'earned_income', 'gift_allowance', 'family_money', 'person_money',
  'borrowed_in', 'repayment_received', 'other_income', 'expense', 'repayment_out',
]);

export async function buildBackup(): Promise<BackupFile> {
  const db = await getDb();
  const [categories, people, debts, debt_repayments, transactions] = await Promise.all([
    db.getAllSync('SELECT * FROM categories'),
    db.getAllSync('SELECT * FROM people'),
    db.getAllSync('SELECT * FROM debts'),
    db.getAllSync('SELECT * FROM debt_repayments'),
    db.getAllSync('SELECT * FROM transactions'),
  ]);
  const settingsRows = await db.getAllSync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const r of settingsRows) settings[r.key] = r.value;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: isoNow(),
    schemaVersion: SCHEMA_VERSION,
    data: { categories, people, debts, debt_repayments, transactions, settings },
  };
}

/** Validate parsed backup JSON. Throws with a readable message when invalid. */
export function validateBackup(obj: unknown): BackupFile {
  if (!obj || typeof obj !== 'object') throw new Error('Backup file is not a valid JSON object');
  const b = obj as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) throw new Error('Not a Personal Wallet Manager backup file');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(b.version)}). This app supports up to version ${BACKUP_VERSION}.`);
  }
  if (!b.data || typeof b.data !== 'object') throw new Error('Backup is missing its data section');
  const d = b.data;
  for (const key of ['categories', 'people', 'debts', 'debt_repayments', 'transactions'] as const) {
    if (!Array.isArray(d[key])) throw new Error(`Backup section "${key}" is missing or malformed`);
  }
  const catIds = new Set((d.categories as { id: number }[]).map((c) => c.id));
  const personIds = new Set((d.people as { id: number }[]).map((p) => p.id));
  const debtIds = new Set((d.debts as { id: number }[]).map((x) => x.id));
  for (const t of d.transactions as Record<string, unknown>[]) {
    const type = t.transaction_type as string;
    const amount = t.amount_minor_units as number;
    if (typeof type !== 'string' || !TX_TYPES.has(type)) {
      throw new Error(`Transaction has unknown type: ${String(type)}`);
    }
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error(`Transaction #${String(t.id)} has an invalid monetary amount`);
    }
    const cid = t.category_id;
    if (cid != null && !catIds.has(cid as number)) {
      throw new Error(`Transaction #${String(t.id)} references a category that does not exist in the backup`);
    }
    const pid = t.related_person_id;
    if (pid != null && !personIds.has(pid as number)) {
      throw new Error(`Transaction #${String(t.id)} references a person that does not exist in the backup`);
    }
    const did = t.related_debt_id;
    if (did != null && !debtIds.has(did as number)) {
      throw new Error(`Transaction #${String(t.id)} references a borrowing record that does not exist in the backup`);
    }
    if (typeof t.transaction_date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(t.transaction_date as string)) {
      throw new Error(`Transaction #${String(t.id)} has an invalid date`);
    }
  }
  for (const r of d.debt_repayments as Record<string, unknown>[]) {
    if (!debtIds.has(r.debt_id as number)) {
      throw new Error(`Repayment #${String(r.id)} references a missing borrowing record`);
    }
    if (!Number.isInteger(r.amount_minor_units as number) || (r.amount_minor_units as number) <= 0) {
      throw new Error(`Repayment #${String(r.id)} has an invalid amount`);
    }
  }
  for (const dd of d.debts as Record<string, unknown>[]) {
    if (!personIds.has(dd.person_id as number)) {
      throw new Error(`Borrowing record #${String(dd.id)} references a missing person`);
    }
    if (!Number.isInteger(dd.original_amount_minor) || (dd.original_amount_minor as number) <= 0) {
      throw new Error(`Borrowing record #${String(dd.id)} has an invalid amount`);
    }
  }
  return b as BackupFile;
}

/**
 * Replace ALL financial data with the backup contents. Runs inside one
 * transaction so a failure leaves existing data untouched. Settings keys are
 * merged (backup values win) but auth-related state is never touched here.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const validated = validateBackup(JSON.parse(JSON.stringify(backup)));
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    await validated__clear(db);
    for (const c of validated.data.categories as Record<string, unknown>[]) {
      await db.runAsync(
        'INSERT INTO categories (id,name,kind,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        [c.id, c.name, c.kind, c.is_default ?? 0, c.created_at ?? isoNow(), c.updated_at ?? isoNow()]);
    }
    for (const p of validated.data.people as Record<string, unknown>[]) {
      await db.runAsync(
        'INSERT INTO people (id,name,notes,created_at,updated_at) VALUES (?,?,?,?,?)',
        [p.id, p.name, p.notes ?? null, p.created_at ?? isoNow(), p.updated_at ?? isoNow()]);
    }
    for (const d of validated.data.debts as Record<string, unknown>[]) {
      await db.runAsync(
        `INSERT INTO debts (id,person_id,original_amount_minor,borrowed_date,due_date,notes,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [d.id, d.person_id, d.original_amount_minor, d.borrowed_date, d.due_date ?? null,
         d.notes ?? null, d.status ?? 'open', d.created_at ?? isoNow(), d.updated_at ?? isoNow()]);
    }
    for (const r of validated.data.debt_repayments as Record<string, unknown>[]) {
      await db.runAsync(
        'INSERT INTO debt_repayments (id,debt_id,amount_minor_units,repayment_date,notes,created_at) VALUES (?,?,?,?,?,?)',
        [r.id, r.debt_id, r.amount_minor_units, r.repayment_date, r.notes ?? null, r.created_at ?? isoNow()]);
    }
    for (const t of validated.data.transactions as Record<string, unknown>[]) {
      await db.runAsync(
        `INSERT INTO transactions (id,transaction_type,amount_minor_units,currency_code,category_id,
          related_person_id,description,notes,transaction_date,created_at,updated_at,related_debt_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [t.id, t.transaction_type, t.amount_minor_units, t.currency_code ?? 'PKR', t.category_id ?? null,
         t.related_person_id ?? null, t.description ?? '', t.notes ?? null, t.transaction_date,
         t.created_at ?? isoNow(), t.updated_at ?? isoNow(), t.related_debt_id ?? null]);
    }
    // Reset sqlite sequence so future inserts don't collide with restored ids.
    await db.execAsync(`UPDATE sqlite_sequence SET seq =
        (SELECT MAX(id) FROM transactions) WHERE name = 'transactions';`);
    const settings = validated.data.settings ?? {};
    for (const [k, v] of Object.entries(settings)) {
      if (['schema_version'].includes(k)) continue;
      await db.runAsync(
        'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [k, String(v)]);
    }
  });
}

async function validated__clear(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM debt_repayments;
    DELETE FROM debts;
    DELETE FROM people;
    DELETE FROM categories;
  `);
}

// ---- Files ---------------------------------------------------------------

export async function documentsDir(): Promise<string> {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const dir = `${base}wallet-backups/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export async function writeExportFile(filename: string, contents: string): Promise<string> {
  const dir = await documentsDir();
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, contents, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function readTextFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}

export async function listBackups(): Promise<{ name: string; uri: string; size: number; modified: number }[]> {
  const dir = await documentsDir();
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const out: { name: string; uri: string; size: number; modified: number }[] = [];
    for (const n of names) {
      const info = await FileSystem.getInfoAsync(`${dir}${n}`);
      if (!info.isDirectory) {
        out.push({ name: n, uri: `${dir}${n}`, size: (info as { size?: number }).size ?? 0, modified: Date.now() });
      }
    }
    return out.sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

export async function shareFile(uri: string, mimeType: string): Promise<void> {
  // expo-sharing is native-only; guarded import keeps web dev builds working.
  try {
    const Sharing = require('expo-sharing');
    if (Sharing && Sharing.isAvailableAsync && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Wallet backup', UTI: mimeType });
      return;
    }
    throw new Error('sharing-unavailable');
  } catch (e) {
    throw new Error(`Sharing is not available on this device. The file was saved to: ${uri}`);
  }
}

// ---- CSV -----------------------------------------------------------------

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildTransactionsCsv(): Promise<string> {
  const rows = await (await getDb()).getAllSync<{
    id: number; transaction_type: string; amount_minor_units: number; currency_code: string;
    category: string | null; person: string | null; description: string; notes: string | null;
    transaction_date: string;
  }>(`SELECT t.id, t.transaction_type, t.amount_minor_units, t.currency_code,
             c.name AS category, p.name AS person, t.description, t.notes, t.transaction_date
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN people p ON p.id = t.related_person_id
      ORDER BY t.transaction_date ASC, t.id ASC`);
  const header = ['id', 'type', 'amount', 'currency', 'category', 'person', 'description', 'notes', 'date'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const amount = (r.amount_minor_units / 100).toFixed(2);
    lines.push([
      r.id, r.transaction_type, amount, r.currency_code,
      csvEscape(r.category ?? ''), csvEscape(r.person ?? ''), csvEscape(r.description),
      csvEscape(r.notes ?? ''), r.transaction_date,
    ].join(','));
  }
  return lines.join('\n');
}
