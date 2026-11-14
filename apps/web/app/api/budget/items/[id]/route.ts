import { removeItem } from '@/lib/server/budget/items';
import { withBudget } from '@/lib/server/budget/route';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) =>
        removeItem(email, (await params).id, new URL(request.url).searchParams.get('deleteData') === '1'),
    );
