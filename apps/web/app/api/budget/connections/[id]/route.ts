import { removeConnection } from '@/lib/server/budget/connections';
import { withBudget } from '@/lib/server/budget/route';

type Ctx = { params: Promise<{ id: string }> };

/** Accounts and transactions stay unless `?deleteData=1`. */
export const DELETE = (request: Request, { params }: Ctx) =>
    withBudget(request, async (email) =>
        removeConnection(email, (await params).id, new URL(request.url).searchParams.get('deleteData') === '1'),
    );
