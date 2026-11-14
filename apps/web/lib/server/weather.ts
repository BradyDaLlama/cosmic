import { conditionOf, worse, type WeatherResponse, type WeatherSlot } from '@/lib/weather/model';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HALF_HOUR = 30 * 60_000;
const SLOTS = 48;
const PAST_SLOTS = 12;
const REVALIDATE_SECONDS = 15 * 60;

type OpenMeteo = {
    utc_offset_seconds: number;
    timezone: string;
    current: { time: string; temperature_2m: number; weather_code: number; is_day: number };
    minutely_15: {
        time: string[];
        temperature_2m: (number | null)[];
        precipitation: (number | null)[];
        snowfall: (number | null)[];
        weather_code: (number | null)[];
        is_day: (number | null)[];
    };
    hourly: { time: string[]; precipitation_probability: (number | null)[] };
};

class WeatherError extends Error {}

/** Open-Meteo gives local wall-clock times plus the UTC offset. */
const instant = (local: string, offsetSeconds: number) => Date.parse(`${local}:00Z`) - offsetSeconds * 1000;

export async function forecast(lat: number, lon: number): Promise<WeatherResponse> {
    const params = new URLSearchParams({
        latitude: lat.toFixed(2),
        longitude: lon.toFixed(2),
        current: 'temperature_2m,weather_code,is_day',
        minutely_15: 'temperature_2m,precipitation,snowfall,weather_code,is_day',
        hourly: 'precipitation_probability',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
        timezone: 'auto',
        forecast_minutely_15: String(SLOTS * 2 + 2),
        forecast_hours: '26',
        past_minutely_15: String(PAST_SLOTS * 2),
        past_hours: String(PAST_SLOTS / 2 + 1),
    });
    const res = await fetch(`${FORECAST_URL}?${params}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new WeatherError(`Open-Meteo responded ${res.status}`);
    const data = (await res.json()) as OpenMeteo;
    const offset = data.utc_offset_seconds;

    const chanceByHour = new Map<number, number>();
    data.hourly.time.forEach((t, i) => {
        const p = data.hourly.precipitation_probability[i];
        if (p != null) chanceByHour.set(instant(t, offset), p);
    });

    const bySlot = new Map<number, WeatherSlot>();
    const m = data.minutely_15;
    m.time.forEach((t, i) => {
        const at = instant(t, offset);
        const start = Math.floor(at / HALF_HOUR) * HALF_HOUR;
        const precip = m.precipitation[i] ?? 0;
        const snow = m.snowfall[i] ?? 0;
        const condition = conditionOf(m.weather_code[i] ?? 0, precip, snow);
        const temp = m.temperature_2m[i];
        const existing = bySlot.get(start);
        if (!existing) {
            bySlot.set(start, {
                start,
                temp: temp ?? NaN,
                precip,
                snow,
                chance: chanceByHour.get(Math.floor(start / 3_600_000) * 3_600_000),
                isDay: m.is_day[i] === 1,
                condition,
            });
        } else {
            existing.precip += precip;
            existing.snow += snow;
            existing.condition = worse(existing.condition, condition);
            if (Number.isNaN(existing.temp) && temp != null) existing.temp = temp;
        }
    });

    const nowSlot = Math.floor(instant(data.current.time, offset) / HALF_HOUR) * HALF_HOUR;
    const first = nowSlot - PAST_SLOTS * HALF_HOUR;
    const end = nowSlot + SLOTS * HALF_HOUR;
    const slots = [...bySlot.values()]
        .filter((s) => !Number.isNaN(s.temp) && s.start >= first && s.start < end)
        .sort((a, b) => a.start - b.start)
        .map((s) => ({ ...s, temp: Math.round(s.temp), precip: round3(s.precip), snow: round3(s.snow) }));

    const c = data.current;
    return {
        now: {
            temp: Math.round(c.temperature_2m),
            condition: conditionOf(c.weather_code, 0, 0),
            isDay: c.is_day === 1,
            at: instant(c.time, offset),
        },
        slots,
        timezone: data.timezone,
        fetchedAt: Date.now(),
    };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
