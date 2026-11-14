import { withBudget } from '@/lib/server/budget/route';
import { syncAll } from '@/lib/server/budget/sync';
import { isString, readJson } from '@/lib/server/userRoute';

export const maxDuration = 60;

export const POST = (request: Request) =>
    withBudget(request, async (email, session) => {
        const body = await readJson<{ connectionId?: unknown; onlyStale?: unknown }>(request).catch(
            () => ({}) as { connectionId?: unknown; onlyStale?: unknown },
        );
        return syncAll(email, session, {
            connectionId: isString(body.connectionId, 64) && body.connectionId ? body.connectionId : undefined,
            onlyStale: body.onlyStale === true,
        });
    });
