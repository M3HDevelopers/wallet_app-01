import { TransactionEntryForm } from '../components/TransactionEntryForm';

export default function AddMoney() {
  return (
    <TransactionEntryForm
      successMessage="Money recorded"
      presetTypes={[
        { type: 'earned_income', title: 'Earned Income', kind: 'income' },
        { type: 'gift_allowance', title: 'Gift / Allowance', kind: 'income' },
        { type: 'family_money', title: 'Money From Family', kind: 'income' },
        { type: 'person_money', title: 'Money From a Person', kind: 'income' },
        { type: 'repayment_received', title: 'Repayment Received', kind: 'income' },
        { type: 'other_income', title: 'Other Income', kind: 'income' },
      ]}
    />
  );
}
