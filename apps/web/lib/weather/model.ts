import { formatClock } from '@/lib/dates';

type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';
type Precip = 'dry' | 'rain' | 'snow' | 'thunder';

export type WeatherSlot = {
    start: number;
    temp: number;
    precip: number;
    snow: number;
    chance?: number;
    isDay: boolean;
    condition: Condition;
};

type WeatherNow = { temp: number; condition: Condition; isDay: boolean; at: number };

export type WeatherResponse = {
    now: WeatherNow;
    slots: WeatherSlot[];
    timezone: string;
    fetchedAt: number;
};

export type WeatherChange = {
    at: number;
    from: Precip;
    to: Precip;
};

const RAIN_IN = 0.004;

export function conditionOf(code: number, precip: number, snow: number): Condition {
    if (code >= 95) return 'thunder';
    if (snow > 0 || (code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (precip >= RAIN_IN || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3) return 'cloudy';
    if (code === 2) return 'partly';
    return 'clear';
}

const precipOf = (c: Condition): Precip => (c === 'rain' || c === 'snow' || c === 'thunder' ? c : 'dry');

const SEVERITY: Record<Condition, number> = { clear: 0, partly: 1, fog: 2, cloudy: 3, rain: 4, snow: 5, thunder: 6 };

export const worse = (a: Condition, b: Condition) => (SEVERITY[a] >= SEVERITY[b] ? a : b);

export const conditionLabel: Record<Condition, string> = {
    clear: 'Clear',
    partly: 'Partly cloudy',
    cloudy: 'Cloudy',
    fog: 'Fog',
    rain: 'Rain',
    snow: 'Snow',
    thunder: 'Thunderstorms',
};

export function conditionIcon(c: Condition, isDay: boolean): 'sun' | 'moon' | 'cloud' | 'water' | 'lightning' {
    if (c === 'clear') return isDay ? 'sun' : 'moon';
    if (c === 'rain') return 'water';
    if (c === 'thunder') return 'lightning';
    return 'cloud';
}

const MIN_RUN = 2;

type Run = { state: Precip; from: number; length: number };

function runs(states: Precip[]): Run[] {
    const out: Run[] = [];
    states.forEach((state, i) => {
        const last = out.at(-1);
        if (last && last.state === state) last.length++;
        else out.push({ state, from: i, length: 1 });
    });
    return out;
}

/** A run shorter than `MIN_RUN` takes its neighbours' state when both agree, so brief flickers are ignored. */
function smoothedStates(slots: WeatherSlot[]): Precip[] {
    const states = slots.map((s) => precipOf(s.condition));
    let changed = true;
    while (changed) {
        changed = false;
        const rs = runs(states);
        for (let i = 1; i < rs.length - 1; i++) {
            const r = rs[i];
            if (r.length < MIN_RUN && rs[i - 1].state === rs[i + 1].state) {
                for (let j = r.from; j < r.from + r.length; j++) states[j] = rs[i - 1].state;
                changed = true;
                break;
            }
        }
    }
    return states;
}

export function weatherChanges(slots: WeatherSlot[], now: number): WeatherChange[] {
    const states = smoothedStates(slots);
    const changes: WeatherChange[] = [];
    for (let i = 1; i < slots.length; i++) {
        if (states[i] === states[i - 1]) continue;
        if (slots[i].start <= now) continue;
        changes.push({ at: slots[i].start, from: states[i - 1], to: states[i] });
    }
    return changes;
}

const precipNoun: Record<Exclude<Precip, 'dry'>, { name: string; plural: boolean }> = {
    rain: { name: 'Rain', plural: false },
    snow: { name: 'Snow', plural: false },
    thunder: { name: 'Thunderstorms', plural: true },
};

export function changeLabel(c: WeatherChange): string {
    if (c.from === 'dry' && c.to !== 'dry') {
        const n = precipNoun[c.to];
        return `${n.name} ${n.plural ? 'start' : 'starts'}`;
    }
    if (c.to === 'dry' && c.from !== 'dry') {
        const n = precipNoun[c.from];
        return `${n.name} ${n.plural ? 'stop' : 'stops'}`;
    }
    const from = precipNoun[c.from as Exclude<Precip, 'dry'>];
    const to = precipNoun[c.to as Exclude<Precip, 'dry'>];
    return `${from.name} ${from.plural ? 'turn' : 'turns'} to ${to.name.toLowerCase()}`;
}

export function changeIcon(c: WeatherChange): 'sun' | 'cloud' | 'water' | 'lightning' {
    if (c.to === 'thunder') return 'lightning';
    if (c.to === 'rain') return 'water';
    if (c.to === 'snow') return 'cloud';
    return 'sun';
}

export function whenLabel(at: number, now: number): string {
    const a = new Date(at);
    const n = new Date(now);
    const sameDay = a.toDateString() === n.toDateString();
    return sameDay ? formatClock(at) : `tomorrow ${formatClock(at)}`;
}

export function weatherSentence(data: WeatherResponse, now: number): string | null {
    const states = smoothedStates(data.slots);
    const index = data.slots.findIndex((s) => s.start <= now && now < s.start + 30 * 60_000);
    const current = index >= 0 ? states[index] : precipOf(data.now.condition);
    const changes = weatherChanges(data.slots, now);

    if (current !== 'dry') {
        const name = precipNoun[current].name;
        const ends = changes.find((c) => c.from === current);
        return ends ? `${name} now, until around ${whenLabel(ends.at, now)}.` : `${name} now, through the next day.`;
    }
    const next = changes.find((c) => c.from === 'dry');
    if (!next) return null;
    const stop = changes.find((c) => c.at > next.at && c.to === 'dry');
    const name = precipNoun[next.to as Exclude<Precip, 'dry'>].name;
    return stop
        ? `${name} from around ${whenLabel(next.at, now)} to ${whenLabel(stop.at, now)}.`
        : `${name} from around ${whenLabel(next.at, now)}.`;
}
