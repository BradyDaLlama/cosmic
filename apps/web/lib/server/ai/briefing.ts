import { MAX_BRIEFING_ITEMS, type BriefingFacts } from '@/lib/ai/briefing';
import { invalid, isString } from '../userRoute';
import { streamChat } from './llm';

const MAX_TEXT = 200;
const MAX_BRIEFING_CHARS = 400;

const system = (
    name: string,
) => `You are Cosmic, ${name}'s cheerful companion. Write the short briefing shown in a speech bubble on their Today screen.

Rules:
- 1 or 2 friendly, complete sentences, at most 30 words. Plain text, no emoji.
- Talk to ${name} as "you". Never state the date or the current time.
- Mention only the 2 or 3 facts that matter most: what's on now or next, overdue or due tasks, then weather. Leave the rest out.
- Use only the facts given. Never add events, plans or activities that aren't listed.
- Habits are not tasks.
- Write times and numbers in digits: 9:30 AM, 64°, 100 oz.
- When a high and low are given, include them.

Example facts:
Later: Dentist, 2:00 PM to 3:00 PM
Overdue tasks: Pay rent
Weather: 58°, cloudy. High 63°, low 49°.

Example briefing:
Your dentist visit is at 2:00 PM, and rent is overdue, so maybe knock that out first. It's 58° and cloudy, with a high of 63° and a low of 49°.`;

function text(v: unknown, field: string, max = MAX_TEXT): string {
    if (!isString(v, max)) throw invalid(`${field} must be text up to ${max} characters.`);
    return v.trim();
}

const optional = (v: unknown, field: string) =>
    v === undefined || v === null || v === '' ? undefined : text(v, field);

function list<T>(v: unknown, field: string, each: (item: Record<string, unknown>) => T): T[] {
    if (!Array.isArray(v)) throw invalid(`${field} must be a list.`);
    return v.slice(0, MAX_BRIEFING_ITEMS).map((item) => each((item ?? {}) as Record<string, unknown>));
}

export function parseFacts(raw: unknown): BriefingFacts {
    const body = (raw ?? {}) as Record<string, unknown>;
    const status = (v: unknown) => (v === 'now' || v === 'all day' ? v : 'later');
    return {
        name: text(body.name, 'name', 60),
        now: text(body.now, 'now', 80),
        events: list(body.events, 'events', (e) => ({
            title: text(e.title, 'event title'),
            when: text(e.when, 'event time', 60),
            location: optional(e.location, 'event location'),
            status: status(e.status),
        })),
        free: optional(body.free, 'free'),
        tasks: list(body.tasks, 'tasks', (t) => ({ title: text(t.title, 'task title'), overdue: t.overdue === true })),
        habits: list(body.habits, 'habits', (h) => ({
            name: text(h.name, 'habit'),
            period: text(h.period, 'period', 20),
        })),
        weather: optional(body.weather, 'weather'),
    };
}

/** Labelled lines read more reliably than JSON for a small model. */
function describe(f: BriefingFacts): string {
    const lines = [`Now: ${f.now}`];
    if (!f.events.length) lines.push('Calendar: clear for the rest of today');
    for (const e of f.events) {
        const where = e.location ? ` (${e.location})` : '';
        const label = e.status === 'now' ? 'On now' : e.status === 'all day' ? 'All day' : 'Later';
        lines.push(e.status === 'all day' ? `${label}: ${e.title}` : `${label}: ${e.title}, ${e.when}${where}`);
    }
    if (f.free) lines.push(`Free: ${f.free}`);
    const overdue = f.tasks.filter((t) => t.overdue).map((t) => t.title);
    const due = f.tasks.filter((t) => !t.overdue).map((t) => t.title);
    if (overdue.length) lines.push(`Overdue tasks: ${overdue.join('; ')}`);
    if (due.length) lines.push(`Tasks due today: ${due.join('; ')}`);
    if (f.habits.length) lines.push(`Habits left: ${f.habits.map((h) => h.name).join('; ')}`);
    if (f.weather) lines.push(`Weather: ${f.weather}`);
    return lines.join('\n');
}

/** Drops leading quotes and repeated whitespace as the reply streams, and stops at MAX_BRIEFING_CHARS. */
export async function* streamBriefing(facts: BriefingFacts): AsyncGenerator<string> {
    const reply = streamChat(
        [
            { role: 'system', content: system(facts.name) },
            { role: 'user', content: describe(facts) },
        ],
        { maxTokens: 160, temperature: 0.7 },
    );
    let length = 0;
    let space = false;
    for await (const piece of reply) {
        let out = '';
        for (const char of piece) {
            if (/\s/.test(char)) {
                space = length > 0;
                continue;
            }
            if (length === 0 && /["'“‘]/.test(char)) continue;
            if (space) out += ' ';
            out += char;
            length += (space ? 1 : 0) + 1;
            space = false;
            if (length >= MAX_BRIEFING_CHARS) break;
        }
        if (out) yield out;
        if (length >= MAX_BRIEFING_CHARS) return;
    }
}
