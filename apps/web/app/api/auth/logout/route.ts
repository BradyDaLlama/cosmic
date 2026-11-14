import { revoke } from '@/lib/server/google';
import { clearSession, getSession } from '@/lib/server/session';

export async function POST(request: Request) {
    const session = await getSession(request);
    if (session) await revoke(session);
    await clearSession();
    return new Response(null, { status: 204 });
}
