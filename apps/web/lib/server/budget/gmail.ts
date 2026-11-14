import { GMAIL_SCOPE, googleFetch } from '../google';
import type { Session } from '../session';

const GMAIL_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_MESSAGES = 500;

export const hasGmail = (session: Session) => !!session.scopes?.includes(GMAIL_SCOPE);

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type GMessage = {
    id: string;
    internalDate: string;
    payload: Part & { headers?: { name: string; value: string }[] };
};

export type AlertEmail = { id: string; subject: string; text: string; receivedAt: Date };

const decode = (data: string) => Buffer.from(data, 'base64url').toString('utf8');

function htmlToText(html: string): string {
    return html
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
        .replace(/<\/td>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&rsquo;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function bodyText(part: Part): string {
    const find = (p: Part, type: string): string | undefined =>
        p.mimeType === type && p.body?.data ? decode(p.body.data) : p.parts?.map((c) => find(c, type)).find(Boolean);
    const text = find(part, 'text/plain') ?? htmlToText(find(part, 'text/html') ?? '');
    return text
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

/** Chase alert emails received after `after`, oldest first. */
export async function chaseAlerts(session: Session, after: Date): Promise<AlertEmail[]> {
    const q = `from:chase.com after:${Math.floor(after.getTime() / 1000)}`;
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
        const params = new URLSearchParams({ q, maxResults: '100', ...(pageToken && { pageToken }) });
        const page = await googleFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(
            session,
            `${GMAIL_URL}/messages?${params}`,
        );
        ids.push(...(page.messages ?? []).map((m) => m.id));
        pageToken = page.nextPageToken;
    } while (pageToken && ids.length < MAX_MESSAGES);

    const messages: GMessage[] = [];
    // Small batches keep under Gmail's per-user rate limit.
    for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        messages.push(
            ...(await Promise.all(
                batch.map((id) => googleFetch<GMessage>(session, `${GMAIL_URL}/messages/${id}?format=full`)),
            )),
        );
    }
    return messages
        .map((m) => ({
            id: m.id,
            subject: m.payload.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '',
            text: bodyText(m.payload),
            receivedAt: new Date(Number(m.internalDate)),
        }))
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}
