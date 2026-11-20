export type BriefingFacts = {
    name: string;
    now: string;
    events: { title: string; when: string; location?: string; status: 'now' | 'later' | 'all day' }[];
    free?: string;
    tasks: { title: string; overdue: boolean }[];
    habits: { name: string; period: string }[];
    weather?: string;
};

export const MAX_BRIEFING_ITEMS = 30;

/** The time is cut to the hour so a briefing is reused until something changes or the hour turns. */
export function briefingKey(facts: BriefingFacts, at: Date): string {
    const hour = `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}T${at.getHours()}`;
    return JSON.stringify({ ...facts, now: hour });
}
