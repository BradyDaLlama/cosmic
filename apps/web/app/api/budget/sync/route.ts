import { withBudget } from '@/lib/server/budget/route';
import { syncAll } from '@/lib/server/budget/sync';
import { isString, readJson } from '@/lib/server/userRoute';

export const maxDuration = 60;

export const POST = (request: Request) =>
    withBudget(request, async (email) => {
        const body = await readJson<{ itemId?: unknown }>(request).catch(() => ({}) as { itemId?: unknown });
        return syncAll(email, isString(body.itemId, 64) && body.itemId ? body.itemId : undefined);
    });
