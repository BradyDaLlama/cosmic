import { getSession, type Session } from '../session';
import { withUser } from '../userRoute';

/** `withUser`, plus the session for routes that read Gmail. */
export function withBudget(
    request: Request,
    handler: (email: string, session: Session) => Promise<unknown>,
): Promise<Response> {
    return withUser(request, async (email) => handler(email, (await getSession(request))!));
}
