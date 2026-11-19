import { GoalsSection } from '@/components/goals/GoalsSection';
import { HabitsSection } from '@/components/habits/HabitsSection';
import { RoutinesSection } from '@/components/routines/RoutinesSection';
import { TodayTasks } from '@/components/tasks/TodayTasks';
import { TodayHeader } from '@/components/today/TodayHeader';
import { UpNext } from '@/components/today/UpNext';

export default function TodayPage() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-8 pb-16">
            <TodayHeader />

            <UpNext />

            <TodayTasks />

            <RoutinesSection />

            <HabitsSection />

            <GoalsSection />
        </main>
    );
}
