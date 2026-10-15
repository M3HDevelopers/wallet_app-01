// Repositories: all SQL access to transactions, categories, people, debts.
import { getDb, isoNow } from './db';
import { Category, CategoryKind, Debt, Person, Repayment, Transaction, TxType } from '../types';

interface TxRow {
  id: number;
  transaction_type: TxType;
  amount_minor_units: number;
  currency_code: string;
  category_id: number | null;
  category_name: string | null;
  related_person_id: number | null;
  person_name: string | null;
  description: string;
  notes: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  related_debt_id: number | null;
}

const TX_SELECT = `
SELECT t.id, t.transaction_type, t.amount_minor_units, t.currency_code,
       t.category_id, c.name AS category_name,
       t.related_person_id, p.name AS person_name,
       t.description, t.notes, t.transaction_date, t.created_at, t.updated_at,
       t.related_debt_id
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN people p ON p.id = t.related_person_id
`;

function mapTx(r: TxRow): Transaction {
  return {
    id: r.id,
    type: r.transaction_type,
    amountMinor: r.amount_minor_units,
    currency: r.currency_code,
    categoryId: r.category_id,
    category: r.category_name,
    personId: r.related_person_id,
    person: r.person_name,
    description: r.description,
    notes: r.notes,
    date: r.transaction_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    debtId: r.related_debt_id,
  };
}

export interface NewTransaction {
  type: TxType;
  amountMinor: number;
  currency?: string;
  categoryId?: number | null;
  personId?: number | null;
  description: string;
  notes?: string | null;
  date: string;
  debtId?: number | null;
}

export async function insertTransaction(tx: NewTransaction): Promise<number> {
  const db = await getDb();
  const now = isoNow();
  const res = await db.runAsync(
    `INSERT INTO transactions
      (transaction_type, amount_minor_units, currency_code, category_id, related_person_id,
       description, notes, transaction_date, created_at, updated_at, related_debt_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      tx.type, tx.amountMinor, tx.currency ?? 'PKR', tx.categoryId ?? null, tx.personId ?? null,
      tx.description, tx.notes ?? null, tx.date, now, now, tx.debtId ?? null,
    ]
  );
  return res.lastInsertRowId;
}

export async function updateTransaction(id: number, tx: NewTransaction): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions SET
      transaction_type=?, amount_minor_units=?, currency_code=?, category_id=?,
      related_person_id=?, description=?, notes=?, transaction_date=?, updated_at=?, related_debt_id=?
     WHERE id=?`,
    [
      tx.type, tx.amountMinor, tx.currency ?? 'PKR', tx.categoryId ?? null, tx.personId ?? null,
      tx.description, tx.notes ?? null, tx.date, isoNow(), tx.debtId ?? null, id,
    ]
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const db = await getDb();
  const r = await db.getFirstSync<TxRow>(`${TX_SELECT} WHERE t.id = ?`, [id]);
  return r ? mapTx(r) : null;
}

export interface TxQuery {
  search?: string;        // matches description / notes / person / category
  types?: TxType[];
  categoryId?: number;
  personId?: number;
  from?: string;          // YYYY-MM-DD inclusive
  to?: string;
  limit?: number;
  offset?: number;
}

export async function queryTransactions(q: TxQuery = {}): Promise<Transaction[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q.search && q.search.trim()) {
    const s = `%${q.search.trim().toLowerCase()}%`;
    where.push(`(LOWER(t.description) LIKE ? OR LOWER(t.notes) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(c.name) LIKE ?)`);
    params.push(s, s, s, s);
  }
  if (q.types && q.types.length) {
    where.push(`t.transaction_type IN (${q.types.map(() => '?').join(',')})`);
    params.push(...q.types);
  }
  if (q.categoryId != null) { where.push('t.category_id = ?'); params.push(q.categoryId); }
  if (q.personId != null) { where.push('t.related_person_id = ?'); params.push(q.personId); }
  if (q.from) { where.push('t.transaction_date >= ?'); params.push(q.from); }
  if (q.to) { where.push('t.transaction_date <= ?'); params.push(q.to); }
  let sql = TX_SELECT;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY t.transaction_date DESC, t.id DESC';
  if (q.limit != null) {
    sql += ' LIMIT ?';
    params.push(q.limit);
    if (q.offset) { sql += ' OFFSET ?'; params.push(q.offset); }
  }
  const rows = await db.getAllSync<TxRow>(sql, params);
  return rows.map(mapTx);
}

/** All ledger entries (used for balance/report calculations). */
export async function getAllLedgerEntries(): Promise<(Transaction)[]> {
  const db = await getDb();
  const rows = await db.getAllSync<TxRow>(`${TX_SELECT} ORDER BY t.transaction_date ASC, t.id ASC`);
  return rows.map(mapTx);
}

export async function countTransactions(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
  return r?.n ?? 0;
}

// ---- Categories ----------------------------------------------------------

export async function listCategories(kind?: CategoryKind): Promise<Category[]> {
  const db = await getDb();
  const rows = kind
    ? await db.getAllSync<Category & { isDefault: number }>(
        'SELECT id, name, kind, is_default AS isDefault FROM categories WHERE kind IN (?, \'general\') ORDER BY is_default DESC, name ASC', [kind])
    : await db.getAllSync<Category & { isDefault: number }>(
        'SELECT id, name, kind, is_default AS isDefault FROM categories ORDER BY kind, is_default DESC, name ASC');
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isDefault: r.isDefault }));
}

export async function upsertCategory(name: string, kind: CategoryKind): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name required');
  const db = await getDb();
  const existing = await db.getFirstSync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? AND kind = ?', [trimmed, kind]);
  if (existing) return existing.id;
  const now = isoNow();
  const res = await db.runAsync(
    'INSERT INTO categories (name, kind, is_default, created_at, updated_at) VALUES (?,?,0,?,?)',
    [trimmed, kind, now, now]);
  return res.lastInsertRowId;
}

// ---- People --------------------------------------------------------------

export async function listPeople(): Promise<Person[]> {
  const db = await getDb();
  const rows = await db.getAllSync<Person & { notes: string | null }>(
    'SELECT id, name, notes FROM people ORDER BY name COLLATE NOCASE ASC');
  return rows;
}

export async function upsertPerson(name: string, notes?: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Person name required');
  const db = await getDb();
  const existing = await db.getFirstSync<{ id: number }>('SELECT id FROM people WHERE name = ?', [trimmed]);
  if (existing) return existing.id;
  const now = isoNow();
  const res = await db.runAsync(
    'INSERT INTO people (name, notes, created_at, updated_at) VALUES (?,?,?,?)',
    [trimmed, notes ?? null, now, now]);
  return res.lastInsertRowId;
}

// ---- Debts ---------------------------------------------------------------

interface DebtRow {
  id: number; person_id: number; person_name: string;
  original_amount_minor: number; borrowed_date: string; due_date: string | null;
  notes: string | null; status: 'open' | 'settled';
  repaid_minor: number | null;
  created_at: string; updated_at: string;
}

const DEBT_SELECT = `
SELECT d.id, d.person_id, p.name AS person_name, d.original_amount_minor,
       d.borrowed_date, d.due_date, d.notes, d.status,
       (SELECT COALESCE(SUM(r.amount_minor_units),0) FROM debt_repayments r WHERE r.debt_id = d.id) AS repaid_minor,
       d.created_at, d.updated_at
FROM debts d JOIN people p ON p.id = d.person_id
`;

function mapDebt(r: DebtRow): Debt {
  const repaid = r.repaid_minor ?? 0;
  return {
    id: r.id, personId: r.person_id, personName: r.person_name,
    originalAmountMinor: r.original_amount_minor, borrowedDate: r.borrowed_date,
    dueDate: r.due_date, notes: r.notes,
    status: r.original_amount_minor - repaid <= 0 ? 'settled' : r.status === 'settled' ? 'settled' : 'open',
    repaidMinor: repaid, outstandingMinor: Math.max(r.original_amount_minor - repaid, 0),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Create a borrowing record plus its cash-in transaction atomically. */
export async function createBorrowing(input: {
  personName: string; amountMinor: number; date: string; dueDate?: string | null; notes?: string | null;
}): Promise<{ debtId: number; txId: number }> {
  const db = await getDb();
  return db.withExclusiveTransactionAsync(async () => {
    const personId = await upsertPersonInner(db, input.personName);
    const now = isoNow();
    const debtRes = await db.runAsync(
      `INSERT INTO debts (person_id, original_amount_minor, borrowed_date, due_date, notes, status, created_at, updated_at)
       VALUES (?,?,?,?,?,'open',?,?)`,
      [personId, input.amountMinor, input.date, input.dueDate ?? null, input.notes ?? null, now, now]);
    const debtId = debtRes.lastInsertRowId;
    const txRes = await db.runAsync(
      `INSERT INTO transactions
        (transaction_type, amount_minor_units, currency_code, related_person_id, description, notes,
         transaction_date, created_at, updated_at, related_debt_id)
       VALUES ('borrowed_in', ?, 'PKR', ?, ?, ?, ?, ?, ?, ?)`,
      [input.amountMinor, personId, `Borrowed from ${input.personName.trim()}`, input.notes ?? null,
       input.date, now, now, debtId]);
    return { debtId, txId: txRes.lastInsertRowId };
  });
}

async function upsertPersonInner(db: SQLiteDB, name: string): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.getFirstSync<{ id: number }>('SELECT id FROM people WHERE name = ?', [trimmed]);
  if (existing) return existing.id;
  const now = isoNow();
  const res = await db.runAsync(
    'INSERT INTO people (name, notes, created_at, updated_at) VALUES (?,NULL,?,?)', [trimmed, now, now]);
  return res.lastInsertRowId;
}

type SQLiteDB = Awaited<ReturnType<typeof getDb>>;

/** Record a repayment against a debt: creates repayment row + cash-out tx atomically. */
export async function createRepayment(input: {
  debtId: number; amountMinor: number; date: string; notes?: string | null;
}): Promise<{ repaymentId: number; txId: number }> {
  const db = await getDb();
  return db.withExclusiveTransactionAsync(async () => {
    const debt = await db.getFirstSync<{ id: number; person_id: number; original_amount_minor: number }>(
      'SELECT id, person_id, original_amount_minor FROM debts WHERE id = ?', [input.debtId]);
    if (!debt) throw new Error('Borrowing record not found');
    const repaidRow = await db.getFirstSync<{ s: number }>(
      'SELECT COALESCE(SUM(amount_minor_units),0) AS s FROM debt_repayments WHERE debt_id = ?', [input.debtId]);
    const repaid = repaidRow?.s ?? 0;
    const outstanding = debt.original_amount_minor - repaid;
    if (input.amountMinor <= 0) throw new Error('Repayment amount must be greater than zero');
    if (input.amountMinor > outstanding) throw new Error('Repayment exceeds remaining outstanding amount');
    const now = isoNow();
    const rep = await db.runAsync(
      'INSERT INTO debt_repayments (debt_id, amount_minor_units, repayment_date, notes, created_at) VALUES (?,?,?,?,?)',
      [input.debtId, input.amountMinor, input.date, input.notes ?? null, now]);
    const personName = await db.getFirstSync<{ name: string }>('SELECT name FROM people WHERE id = ?', [debt.person_id]);
    const tx = await db.runAsync(
      `INSERT INTO transactions
        (transaction_type, amount_minor_units, currency_code, related_person_id, description, notes,
         transaction_date, created_at, updated_at, related_debt_id)
       VALUES ('repayment_out', ?, 'PKR', ?, ?, ?, ?, ?, ?, ?)`,
      [input.amountMinor, debt.person_id, `Repaid ${personName?.name ?? 'lender'}`, input.notes ?? null,
       input.date, now, now, input.debtId]);
    const newOutstanding = outstanding - input.amountMinor;
    if (newOutstanding <= 0) {
      await db.runAsync(`UPDATE debts SET status='settled', updated_at=? WHERE id=?`, [now, input.debtId]);
    } else {
      await db.runAsync(`UPDATE debts SET updated_at=? WHERE id=?`, [now, input.debtId]);
    }
    return { repaymentId: rep.lastInsertRowId, txId: tx.lastInsertRowId };
  });
}

export async function listDebts(status?: 'open' | 'settled'): Promise<Debt[]> {
  const db = await getDb();
  const rows = status
    ? await db.getAllSync<DebtRow>(`${DEBT_SELECT} WHERE (CASE WHEN d.original_amount_minor - (SELECT COALESCE(SUM(r.amount_minor_units),0) FROM debt_repayments r WHERE r.debt_id=d.id) <= 0 THEN 'settled' ELSE d.status END) = ? ORDER BY d.borrowed_date DESC, d.id DESC`, [status])
    : await db.getAllSync<DebtRow>(`${DEBT_SELECT} ORDER BY d.borrowed_date DESC, d.id DESC`);
  return rows.map(mapDebt);
}

export async function getDebt(id: number): Promise<Debt | null> {
  const db = await getDb();
  const r = await db.getFirstSync<DebtRow>(`${DEBT_SELECT} WHERE d.id = ?`, [id]);
  return r ? mapDebt(r) : null;
}

export async function listRepaymentsForDebt(debtId: number): Promise<Repayment[]> {
  const db = await getDb();
  const rows = await db.getAllSync<Repayment & { debt_id: number; amount_minor_units: number; repayment_date: string; created_at: string }>(
    'SELECT * FROM debt_repayments WHERE debt_id = ? ORDER BY repayment_date DESC, id DESC', [debtId]);
  return rows.map((r) => ({
    id: r.id, debtId: r.debt_id, amountMinor: r.amount_minor_units,
    date: r.repayment_date, notes: r.notes, createdAt: r.created_at,
  }));
}

export async function listAllRepayments(): Promise<(Repayment & { personName: string })[]> {
  const db = await getDb();
  const rows = await db.getAllSync<{
    id: number; debt_id: number; amount_minor_units: number; repayment_date: string;
    notes: string | null; created_at: string; person_name: string;
  }>(
    `SELECT r.*, p.name AS person_name FROM debt_repayments r
     JOIN debts d ON d.id = r.debt_id JOIN people p ON p.id = d.person_id
     ORDER BY r.repayment_date DESC, r.id DESC`);
  return rows.map((r) => ({
    id: r.id, debtId: r.debt_id, amountMinor: r.amount_minor_units, date: r.repayment_date,
    notes: r.notes, createdAt: r.created_at, personName: r.person_name,
  }));
}

/** Delete a repayment: removes the repayment row and its linked transaction, reopens debt if needed. */
export async function deleteRepayment(repaymentId: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    const rep = await db.getFirstSync<{ id: number; debt_id: number }>(
      'SELECT id, debt_id FROM debt_repayments WHERE id = ?', [repaymentId]);
    if (!rep) return;
    // Delete the linked repayment transaction precisely (one tx per repayment row).
    await db.runAsync(
      `DELETE FROM transactions WHERE related_debt_id = ? AND transaction_type='repayment_out'
       AND transaction_date = (SELECT repayment_date FROM debt_repayments WHERE id = ?)
       AND amount_minor_units = (SELECT amount_minor_units FROM debt_repayments WHERE id = ?)
       AND id = (SELECT MIN(id) FROM transactions WHERE related_debt_id = ? AND transaction_type='repayment_out'
                 AND transaction_date = (SELECT repayment_date FROM debt_repayments WHERE id = ?)
                 AND amount_minor_units = (SELECT amount_minor_units FROM debt_repayments WHERE id = ?))`,
      [rep.debt_id, repaymentId, repaymentId, rep.debt_id, repaymentId, repaymentId]);
    await db.runAsync('DELETE FROM debt_repayments WHERE id = ?', [repaymentId]);
    const sums = await db.getFirstSync<{ orig: number; repaid: number }>(
      `SELECT d.original_amount_minor AS orig,
              (SELECT COALESCE(SUM(amount_minor_units),0) FROM debt_repayments WHERE debt_id = d.id) AS repaid
       FROM debts d WHERE d.id = ?`, [rep.debt_id]);
    if (sums && sums.repaid < sums.orig) {
      await db.runAsync(`UPDATE debts SET status='open', updated_at=? WHERE id=?`, [isoNow(), rep.debt_id]);
    }
  });
}

/** Delete an entire borrowing record along with its transactions and repayments. */
export async function deleteDebt(debtId: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync("DELETE FROM transactions WHERE related_debt_id = ?", [debtId]);
    await db.runAsync('DELETE FROM debt_repayments WHERE debt_id = ?', [debtId]);
    await db.runAsync('DELETE FROM debts WHERE id = ?', [debtId]);
  });
}

/** Update debt metadata (person name, dates, notes). Keeps amounts via transactions in sync. */
export async function updateDebtMeta(debtId: number, input: {
  personName?: string; borrowedDate?: string; dueDate?: string | null; notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    const debt = await db.getFirstSync<{ person_id: number; original_amount_minor: number; borrowed_date: string }>(
      'SELECT person_id, original_amount_minor, borrowed_date FROM debts WHERE id = ?', [debtId]);
    if (!debt) throw new Error('Borrowing record not found');
    let personId = debt.person_id;
    if (input.personName && input.personName.trim()) {
      personId = await upsertPersonInner(db, input.personName);
    }
    await db.runAsync(
      'UPDATE debts SET person_id=?, borrowed_date=?, due_date=?, notes=?, updated_at=? WHERE id=?',
      [personId, input.borrowedDate ?? debt.borrowed_date,
       input.dueDate !== undefined ? input.dueDate : null,
       input.notes !== undefined ? input.notes : null, isoNow(), debtId]);
    if (input.borrowedDate) {
      await db.runAsync(
        "UPDATE transactions SET transaction_date=?, updated_at=? WHERE related_debt_id=? AND transaction_type='borrowed_in'",
        [input.borrowedDate, isoNow(), debtId]);
    }
    if (input.personName) {
      await db.runAsync(
        "UPDATE transactions SET related_person_id=?, description=?, updated_at=? WHERE related_debt_id=? AND transaction_type='borrowed_in'",
        [personId, `Borrowed from ${input.personName.trim()}`, isoNow(), debtId]);
    }
  });
}
