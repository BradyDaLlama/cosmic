import type { CheckIn, Habit, HabitPeriod } from '@/lib/habits/model';
import { collections, type CheckinDoc, type HabitDoc } from './db';
import { invalid, isNumber, isString, newId, notFound, oneOf, optionalText, requiredText } from './userRoute';

const PERIODS = ['daily', 'weekly', 'monthly'] as const;
const PERIOD_KEY = /^(d:\d{4}-\d{2}-\d{2}|w:\d{4}-\d{2}-\d{2}|m:\d{4}-\d{2})$/;

const toHabit = ({ email: _e, _id, ...rest }: HabitDoc): Habit => ({ ...rest, id: _id }) as Habit;
const toCheckin = (c: CheckinDoc): CheckIn => ({ habitId: c.habitId, periodKey: c.periodKey, doneAt: c.doneAt });
const checkinId = (habitId: string, periodKey: string) => `${habitId}|${periodKey}`;

type HabitFields = Pick<HabitDoc, 'name' | 'icon' | 'color' | 'period'> & { description?: string };

function fields(body: Record<string, unknown>, partial: boolean): Partial<HabitFields> {
    const out: Partial<HabitFields> = {};
    if (!partial || 'name' in body) out.name = requiredText(body.name, 'name');
    if ('description' in body) out.description = optionalText(body.description, 'description');
    if (!partial || 'icon' in body) {
        if (!isString(body.icon, 40) || !body.icon) throw invalid('icon is required.');
        out.icon = body.icon;
    }
    if (!partial || 'color' in body) {
        if (!isString(body.color, 32) || !body.color) throw invalid('color is required.');
        out.color = body.color;
    }
    if (!partial || 'period' in body) out.period = oneOf<HabitPeriod>(body.period, PERIODS, 'period');
    return out;
}

export async function listHabits(email: string) {
    const [habits, checkins] = await Promise.all([collections.habits(), collections.checkins()]);
    const [h, c] = await Promise.all([
        habits.find({ email }).sort({ order: 1 }).toArray(),
        checkins.find({ email }).toArray(),
    ]);
    return { habits: h.map(toHabit), checkins: c.map(toCheckin) };
}

export async function createHabit(email: string, body: Record<string, unknown>): Promise<Habit> {
    const habits = await collections.habits();
    const last = await habits.find({ email }).sort({ order: -1 }).limit(1).next();
    const stamp = new Date().toISOString();
    const doc: HabitDoc = {
        ...(fields(body, false) as HabitFields),
        _id: newId(),
        email,
        order: (last?.order ?? 0) + 1,
        createdAt: stamp,
        updatedAt: stamp,
    };
    await habits.insertOne(doc);
    return toHabit(doc);
}

export async function updateHabit(email: string, id: string, body: Record<string, unknown>): Promise<Habit> {
    const habits = await collections.habits();
    const set = { ...fields(body, true), updatedAt: new Date().toISOString() };
    const unset = 'description' in body && !set.description ? { description: '' as const } : undefined;
    if (unset) delete set.description;
    const doc = await habits.findOneAndUpdate(
        { _id: id, email },
        { $set: set, ...(unset ? { $unset: unset } : {}) },
        { returnDocument: 'after' },
    );
    if (!doc) throw notFound();
    return toHabit(doc);
}

export async function deleteHabit(email: string, id: string): Promise<void> {
    const [habits, checkins] = await Promise.all([collections.habits(), collections.checkins()]);
    const { deletedCount } = await habits.deleteOne({ _id: id, email });
    if (!deletedCount) throw notFound();
    await checkins.deleteMany({ email, habitId: id });
}

export async function setDone(email: string, habitId: string, body: Record<string, unknown>): Promise<void> {
    if (!isString(body.periodKey, 20) || !PERIOD_KEY.test(body.periodKey)) throw invalid('periodKey is invalid.');
    if (typeof body.done !== 'boolean') throw invalid('done must be true or false.');
    const [habits, checkins] = await Promise.all([collections.habits(), collections.checkins()]);
    if (!(await habits.countDocuments({ _id: habitId, email }, { limit: 1 }))) throw notFound();
    const _id = checkinId(habitId, body.periodKey);
    if (body.done) {
        await checkins.updateOne(
            { _id, email },
            { $setOnInsert: { email, habitId, periodKey: body.periodKey, doneAt: new Date().toISOString() } },
            { upsert: true },
        );
    } else {
        await checkins.deleteOne({ _id, email });
    }
}

export async function importHabits(email: string, body: Record<string, unknown>) {
    const rawHabits = Array.isArray(body.habits) ? body.habits : [];
    const rawCheckins = Array.isArray(body.checkins) ? body.checkins : [];
    if (rawHabits.length > 200 || rawCheckins.length > 50_000) throw invalid('Too much to import at once.');

    const [habits, checkins] = await Promise.all([collections.habits(), collections.checkins()]);
    const ids = new Set<string>();
    const habitOps = rawHabits.map((raw: Record<string, unknown>) => {
        if (!isString(raw.id, 64) || !raw.id) throw invalid('Each habit needs an id.');
        ids.add(raw.id);
        const stamp = new Date().toISOString();
        const doc: HabitDoc = {
            ...(fields(raw, false) as HabitFields),
            _id: raw.id,
            email,
            order: isNumber(raw.order) ? raw.order : 0,
            createdAt: isString(raw.createdAt, 40) ? raw.createdAt : stamp,
            updatedAt: isString(raw.updatedAt, 40) ? raw.updatedAt : stamp,
        };
        return { updateOne: { filter: { _id: doc._id, email }, update: { $setOnInsert: doc }, upsert: true } };
    });
    const checkinOps = rawCheckins
        .filter((c: Record<string, unknown>) => isString(c.habitId, 64) && ids.has(c.habitId))
        .filter((c: Record<string, unknown>) => isString(c.periodKey, 20) && PERIOD_KEY.test(c.periodKey))
        .map((c: Record<string, unknown>) => {
            const habitId = c.habitId as string;
            const periodKey = c.periodKey as string;
            const doc: CheckinDoc = {
                _id: checkinId(habitId, periodKey),
                email,
                habitId,
                periodKey,
                doneAt: isString(c.doneAt, 40) ? c.doneAt : new Date().toISOString(),
            };
            return { updateOne: { filter: { _id: doc._id, email }, update: { $setOnInsert: doc }, upsert: true } };
        });

    if (habitOps.length) await habits.bulkWrite(habitOps, { ordered: false });
    if (checkinOps.length) await checkins.bulkWrite(checkinOps, { ordered: false });
    return { habits: habitOps.length, checkins: checkinOps.length };
}
