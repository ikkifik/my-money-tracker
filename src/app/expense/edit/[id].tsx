import { router, useLocalSearchParams } from 'expo-router';

import { useDialog } from '@/components/Dialog';
import { ExpenseForm } from '@/components/ExpenseForm';
import { NotFound } from '@/components/NotFound';
import { useStore } from '@/state/store';

export default function EditExpenseScreen() {
  const dialog = useDialog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, updateExpense } = useStore();
  const expense = expenses.find((e) => e.id === id);

  if (!expense) return <NotFound />;

  return (
    <ExpenseForm
      initial={expense}
      submitLabel="Save changes"
      onSubmit={async (input, receipt) => {
        const ok = await dialog.confirm({
          title: 'Save changes?',
          message: `"${input.name}" will be updated with your edits.`,
          confirmLabel: 'Save',
        });
        if (!ok) return;
        updateExpense(expense.id, input, receipt);
        router.back();
      }}
    />
  );
}
