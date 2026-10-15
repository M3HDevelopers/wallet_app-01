import { TransactionEntryForm } from '../components/TransactionEntryForm';

export default function AddExpense() {
  return (
    <TransactionEntryForm
      successMessage="Expense recorded"
      presetTypes={[{ type: 'expense', title: 'Add Expense', kind: 'expense' }]}
    />
  );
}
