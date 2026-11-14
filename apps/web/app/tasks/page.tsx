import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListsView } from '@/components/tasks/ListsView';

export const metadata: Metadata = { title: 'Lists · Cosmic' };

export default function TasksPage() {
    return (
        <Suspense>
            <ListsView />
        </Suspense>
    );
}
