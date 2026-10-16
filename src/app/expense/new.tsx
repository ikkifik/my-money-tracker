import { router } from 'expo-router';

import { ExpenseForm } from '@/components/ExpenseForm';
import { useStore } from '@/state/store';

export default function NewExpenseScreen() {
  const { addExpense } = useStore();
  return (
    <ExpenseForm
      submitLabel="Save expense"
      onSubmit={(input, receipt) => {
        addExpense(input, receipt.kind === 'replace' ? receipt.draft : null);
        router.back();
      }}
    />
  );
}
