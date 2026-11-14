import type { Metadata } from 'next';
import { BudgetScreen } from '@/components/budget/BudgetScreen';

export const metadata: Metadata = { title: 'Budget - Cosmic' };

export default function BudgetPage() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-8 pb-16">
            <h1 className="text-xl text-bubble">Budget</h1>
            <BudgetScreen />
        </main>
    );
}
